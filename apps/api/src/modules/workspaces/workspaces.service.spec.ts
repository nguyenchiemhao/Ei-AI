import type { ActorContext } from '../audit/audit-context';
import type { AuditRecord } from '../audit/audit.service';
import type { AuditService } from '../audit/audit.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/app-exception';
import type { Database } from '../../database/db';
import type { WorkspaceView } from './dto/workspace.dto';
import type { WorkspaceMembersRepository } from './workspace-members.repository';
import type { WorkspacesRepository } from './workspaces.repository';
import { WorkspacesService } from './workspaces.service';

const WORKSPACE: WorkspaceView = {
  id: 'w-1',
  name: 'Hợp đồng',
  description: null,
  languageHint: 'auto',
  status: 'active',
  createdBy: 'u-1',
  createdAt: new Date(),
};

const TX = Symbol('tx');

// `found: undefined` would take the default and quietly mean "found": the absent case is
// spelled `null` so the fixture can express it at all.
interface Fixture {
  insert?: ReturnType<typeof vi.fn>;
  found?: WorkspaceView | null;
  updated?: WorkspaceView | null;
}

function serviceWith({
  insert = vi.fn().mockResolvedValue(WORKSPACE),
  found = WORKSPACE,
  updated = WORKSPACE,
}: Fixture = {}) {
  const upsert = vi.fn().mockResolvedValue(undefined);
  const findById = vi.fn().mockResolvedValue(found ?? undefined);
  const update = vi.fn().mockResolvedValue(updated ?? undefined);
  const listForMember = vi.fn().mockResolvedValue([WORKSPACE]);
  const workspaces = { insert, findById, update, listForMember } as unknown as WorkspacesRepository;
  const members = { upsert } as unknown as WorkspaceMembersRepository;
  const db = {
    transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
  } as unknown as Database;
  return {
    service: new WorkspacesService(workspaces, members, auditDouble, db),
    insert,
    upsert,
    update,
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
    return expect.unreachable('the service resolved where it should have thrown');
  } catch (error) {
    return error as AppException;
  }
}

function uniqueViolation(constraint: string): Error {
  return Object.assign(new Error('duplicate key'), { code: '23505', constraint });
}

describe('WorkspacesService.create', () => {
  it('makes the creator the Owner, in the same transaction as the workspace', async () => {
    const { service, insert, upsert } = serviceWith();

    await service.create({ name: 'Hợp đồng' }, actor('u-1'));

    expect(insert.mock.calls[0]?.[1]).toBe(TX);
    expect(upsert).toHaveBeenCalledWith(
      { workspaceId: 'w-1', userId: 'u-1', role: 'Owner', addedBy: 'u-1' },
      TX,
    );
  });

  it('turns a clash on the unique name into 409, not a server error', async () => {
    const { service } = serviceWith({
      insert: vi.fn().mockRejectedValue(uniqueViolation('workspaces_name_unique')),
    });

    const rejection = await rejectionOf(service.create({ name: 'Hợp đồng' }, actor('u-1')));

    expect(rejection.code).toBe('WORKSPACE_NAME_TAKEN');
    expect(rejection.getStatus()).toBe(409);
    expect(rejection.detail).toContain('Hợp đồng');
  });

  // A different unique index failing is a different bug, and dressing it as a name clash would
  // send the caller looking in the wrong place.
  it('does not dress every unique violation as a name clash', async () => {
    const { service } = serviceWith({
      insert: vi.fn().mockRejectedValue(uniqueViolation('some_other_unique')),
    });

    const rejection = await rejectionOf(service.create({ name: 'Hợp đồng' }, actor('u-1')));

    expect(rejection).not.toBeInstanceOf(AppException);
    expect((rejection as unknown as { constraint: string }).constraint).toBe('some_other_unique');
  });
});

describe('WorkspacesService, reading and changing', () => {
  it('returns the workspace it was asked for', async () => {
    const { service } = serviceWith();

    await expect(service.read('w-1')).resolves.toBe(WORKSPACE);
  });

  it('answers a missing workspace with NOT_FOUND rather than undefined', async () => {
    const { service } = serviceWith({ found: null });

    expect((await rejectionOf(service.read('nope'))).code).toBe('NOT_FOUND');
  });

  it('answers a patch of a missing workspace with NOT_FOUND', async () => {
    const { service } = serviceWith({ updated: null });

    expect((await rejectionOf(service.update('nope', { name: 'x' }, ACTOR))).code).toBe(
      'NOT_FOUND',
    );
  });

  // FR-61: archiving retains the workspace. It is a status change and nothing is deleted.
  it('archives by changing status and passes nothing else', async () => {
    const { service, update } = serviceWith({
      updated: { ...WORKSPACE, status: 'archived' },
    });

    const result = await service.update('w-1', { status: 'archived' }, ACTOR);

    // The third argument is the transaction: archiving and its audit row commit together.
    expect(update).toHaveBeenCalledWith('w-1', { status: 'archived' }, TX);
    expect(result.status).toBe('archived');
  });

  it('lists what the member can see, archived ones included', async () => {
    const { service } = serviceWith();

    await expect(service.listFor('u-1')).resolves.toEqual([WORKSPACE]);
  });

  it('does not treat a unique violation with no constraint name as a name clash', async () => {
    const bare = Object.assign(new Error('duplicate key'), { code: '23505' });
    const { service } = serviceWith({ insert: vi.fn().mockRejectedValue(bare) });

    await expect(service.create({ name: 'Hợp đồng' }, actor('u-1'))).rejects.toBe(bare);
  });
});

describe('what a workspace change records', () => {
  it('records exactly one event when a workspace is created', async () => {
    const { service } = serviceWith();
    await service.create({ name: 'Hợp đồng' }, actor('u-9'));
    expect(recorded).toHaveLength(1);
  });

  it('names the actor, the object and the workspace on that event', async () => {
    const { service } = serviceWith();
    await service.create({ name: 'Hợp đồng' }, actor('u-9'));
    expect(recorded[0]).toMatchObject({
      action: 'workspace.created',
      objectKind: 'workspace',
      objectId: 'w-1',
      workspaceId: 'w-1',
      actorUserId: 'u-9',
      correlationId: 'c-1',
    });
  });

  it('records the archive as an archive, not as a generic update', async () => {
    const { service } = serviceWith({ updated: { ...WORKSPACE, status: 'archived' } });
    await service.update('w-1', { status: 'archived' }, ACTOR);
    expect(recorded[0]).toMatchObject({ action: 'workspace.archived' });
  });

  it('records a rename as an update, naming which fields moved', async () => {
    const { service } = serviceWith({ updated: { ...WORKSPACE, name: 'Khác' } });
    await service.update('w-1', { name: 'Khác' }, ACTOR);
    expect(recorded[0]).toMatchObject({
      action: 'workspace.updated',
      detail: { changed: ['name'] },
    });
  });

  it('records nothing when the workspace does not exist', async () => {
    const { service } = serviceWith({ updated: null });
    await rejectionOf(service.update('missing', { name: 'x' }, ACTOR));
    expect(recorded).toHaveLength(0);
  });

  it('writes the record in the transaction the action uses, never outside it', async () => {
    const { service } = serviceWith();
    await service.create({ name: 'Hợp đồng' }, actor('u-9'));
    expect(vi.mocked(auditDouble.record).mock.calls[0]![1]).toBe(TX);
  });
});
