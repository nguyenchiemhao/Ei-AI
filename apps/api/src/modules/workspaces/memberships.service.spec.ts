import type { ActorContext } from '../audit/audit-context';
import type { AuditRecord } from '../audit/audit.service';
import type { AuditService } from '../audit/audit.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppException } from '../../common/app-exception';
import type { Database } from '../../database/db';
import { MembershipsService } from './memberships.service';
import type { WorkspaceMembersRepository, WorkspaceRole } from './workspace-members.repository';

const TX = Symbol('tx');
const CALLER_ID = 'u-owner';
const TARGET = 'u-target';

// Absence is spelled `null`, never `undefined`: passing `undefined` takes the default and
// would quietly turn "not a member" into "Owner".
interface Fixture {
  callerRole?: WorkspaceRole | null;
  targetRole?: WorkspaceRole | null;
  owners?: number;
  upsert?: ReturnType<typeof vi.fn>;
  removed?: number;
}

function serviceWith({
  callerRole = 'Owner',
  targetRole = 'Editor',
  owners = 2,
  upsert = vi.fn().mockResolvedValue({ workspaceId: 'w-1', userId: TARGET }),
  removed = 1,
}: Fixture = {}) {
  const findRole = vi.fn(async (_workspace: string, userId: string) =>
    userId === CALLER_ID ? (callerRole ?? undefined) : (targetRole ?? undefined),
  );
  const countOwners = vi.fn().mockResolvedValue(owners);
  const remove = vi.fn().mockResolvedValue(removed);
  const list = vi.fn().mockResolvedValue([]);
  const members = {
    findRole,
    countOwners,
    remove,
    list,
    upsert,
  } as unknown as WorkspaceMembersRepository;
  const db = {
    transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
  } as unknown as Database;
  return {
    service: new MembershipsService(auditDouble, members, db),
    upsert,
    remove,
    countOwners,
    list,
  };
}

// The audit row goes into the same transaction as the action, so a double that records nothing
// still has to be present: a service that cannot record is a service that cannot act.
const recorded: AuditRecord[] = [];
const auditDouble = {
  record: vi.fn((record: AuditRecord) => {
    recorded.push(record);
    return Promise.resolve({} as never);
  }),
} as unknown as AuditService;

const ACTOR: ActorContext = { actorUserId: 'u-1', actorIp: '10.0.0.1', correlationId: 'c-1' };
const actor = (userId: string): ActorContext => ({ ...ACTOR, actorUserId: userId });

beforeEach(() => {
  recorded.length = 0;
  vi.mocked(auditDouble.record).mockClear();
});

async function rejectionOf(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
    return expect.unreachable('the service allowed something it should have refused');
  } catch (error) {
    return error as AppException;
  }
}

describe('MembershipsService, the Owner rule', () => {
  it.each([['Editor'], ['Reader']] as const)(
    'refuses a %s who tries to add a member',
    async (role) => {
      const { service, upsert } = serviceWith({ callerRole: role });

      const rejection = await rejectionOf(
        service.put('w-1', { userId: TARGET, role: 'Reader' }, actor(CALLER_ID)),
      );

      expect(rejection.code).toBe('AUTHZ_WORKSPACE_FORBIDDEN');
      expect(rejection.getStatus()).toBe(403);
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it('refuses someone who is not a member at all', async () => {
    const { service } = serviceWith({ callerRole: null });

    expect((await rejectionOf(service.list('w-1', CALLER_ID))).code).toBe(
      'AUTHZ_WORKSPACE_FORBIDDEN',
    );
  });

  it('lets an Owner add a member, inside one transaction', async () => {
    const { service, upsert } = serviceWith();

    await service.put('w-1', { userId: TARGET, role: 'Editor' }, actor(CALLER_ID));

    expect(upsert).toHaveBeenCalledWith(
      { workspaceId: 'w-1', userId: TARGET, role: 'Editor', addedBy: CALLER_ID },
      TX,
    );
  });
});

describe('MembershipsService, the last Owner', () => {
  it('refuses to remove the only Owner', async () => {
    const { service, remove } = serviceWith({ targetRole: 'Owner', owners: 1 });

    const rejection = await rejectionOf(service.remove('w-1', TARGET, actor(CALLER_ID)));

    expect(rejection.code).toBe('WORKSPACE_LAST_OWNER');
    expect(rejection.getStatus()).toBe(409);
    expect(remove).not.toHaveBeenCalled();
  });

  it('refuses to demote the only Owner', async () => {
    const { service, upsert } = serviceWith({ targetRole: 'Owner', owners: 1 });

    expect(
      (await rejectionOf(service.put('w-1', { userId: TARGET, role: 'Reader' }, actor(CALLER_ID))))
        .code,
    ).toBe('WORKSPACE_LAST_OWNER');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('allows removing an Owner while another remains', async () => {
    const { service, remove } = serviceWith({ targetRole: 'Owner', owners: 2 });

    await service.remove('w-1', TARGET, actor(CALLER_ID));

    expect(remove).toHaveBeenCalledWith('w-1', TARGET, TX);
  });

  it('does not count Owners when the member is not one', async () => {
    const { service, countOwners } = serviceWith({ targetRole: 'Reader' });

    await service.remove('w-1', TARGET, actor(CALLER_ID));

    expect(countOwners).not.toHaveBeenCalled();
  });

  it('allows promoting the only Owner to Owner again, which changes nothing', async () => {
    const { service, upsert } = serviceWith({ targetRole: 'Owner', owners: 1 });

    await service.put('w-1', { userId: TARGET, role: 'Owner' }, actor(CALLER_ID));

    expect(upsert).toHaveBeenCalled();
  });
});

describe('MembershipsService, the cases that are not there', () => {
  it('answers a removal of somebody who is not a member with NOT_FOUND', async () => {
    const { service } = serviceWith({ targetRole: null, removed: 0 });

    expect((await rejectionOf(service.remove('w-1', TARGET, actor(CALLER_ID)))).code).toBe(
      'NOT_FOUND',
    );
  });

  it('answers an unknown user id with NOT_FOUND rather than a foreign key error', async () => {
    const { service } = serviceWith({
      targetRole: null,
      upsert: vi.fn().mockRejectedValue(Object.assign(new Error('fk'), { code: '23503' })),
    });

    expect(
      (await rejectionOf(service.put('w-1', { userId: TARGET, role: 'Reader' }, actor(CALLER_ID))))
        .code,
    ).toBe('NOT_FOUND');
  });

  it('lets an Owner read the member list', async () => {
    const { service, list } = serviceWith();

    await service.list('w-1', CALLER_ID);

    expect(list).toHaveBeenCalledWith('w-1');
  });

  // Only a foreign-key violation means "no such user". Anything else is a different bug, and
  // renaming it NOT_FOUND would send the reader looking in the wrong place.
  it('lets an error that is not a foreign-key violation through unchanged', async () => {
    const boom = new Error('connection reset');
    const { service } = serviceWith({ targetRole: null, upsert: vi.fn().mockRejectedValue(boom) });

    await expect(
      service.put('w-1', { userId: TARGET, role: 'Reader' }, actor(CALLER_ID)),
    ).rejects.toBe(boom);
  });
});

describe('what a membership change records', () => {
  it('records an addition when the member was not there before', async () => {
    const { service } = serviceWith({ targetRole: null });
    await service.put('w-1', { userId: TARGET, role: 'Reader' }, actor(CALLER_ID));
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      action: 'membership.added',
      objectKind: 'membership',
      objectId: TARGET,
      workspaceId: 'w-1',
      actorUserId: CALLER_ID,
      detail: { role: 'Reader', previousRole: null },
    });
  });

  it('records a role change when they were, and keeps the role they had', async () => {
    const { service } = serviceWith({ targetRole: 'Reader' });
    await service.put('w-1', { userId: TARGET, role: 'Editor' }, actor(CALLER_ID));
    expect(recorded[0]).toMatchObject({
      action: 'membership.role_changed',
      detail: { role: 'Editor', previousRole: 'Reader' },
    });
  });

  it('records a removal, with the role that was lost', async () => {
    const { service } = serviceWith({ targetRole: 'Reader' });
    await service.remove('w-1', TARGET, actor(CALLER_ID));
    expect(recorded[0]).toMatchObject({
      action: 'membership.removed',
      objectId: TARGET,
      detail: { previousRole: 'Reader' },
    });
  });

  it('records nothing when the caller is not an Owner', async () => {
    const { service } = serviceWith({ callerRole: 'Editor' });
    await rejectionOf(service.put('w-1', { userId: TARGET, role: 'Reader' }, actor(CALLER_ID)));
    expect(recorded).toHaveLength(0);
  });

  it('records nothing when removing would leave no Owner', async () => {
    const { service } = serviceWith({ targetRole: 'Owner', owners: 1 });
    await rejectionOf(service.remove('w-1', TARGET, actor(CALLER_ID)));
    expect(recorded).toHaveLength(0);
  });

  it('writes in the transaction the action uses', async () => {
    const { service } = serviceWith({ targetRole: null });
    await service.put('w-1', { userId: TARGET, role: 'Reader' }, actor(CALLER_ID));
    expect(vi.mocked(auditDouble.record).mock.calls[0]![1]).toBe(TX);
  });
});
