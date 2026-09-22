import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../database/db';
import type { AuditRepository } from './audit.repository';
import { type AuditRecord, AuditService } from './audit.service';

const TX = Symbol('tx');

const RECORD: AuditRecord = {
  action: 'workspace.created',
  objectKind: 'workspace',
  objectId: 'w-1',
  actorUserId: 'u-1',
  actorIp: '10.0.0.1',
  correlationId: 'c-1',
  detail: { name: 'Hợp đồng' },
};

function serviceWith(append = vi.fn().mockResolvedValue({ id: '1' })) {
  const db = {
    transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
  } as unknown as Database;
  return {
    service: new AuditService({ append } as unknown as AuditRepository, db),
    append,
  };
}

describe('AuditService.record', () => {
  it('appends through the transaction it was given, opening none of its own', async () => {
    const { service, append } = serviceWith();
    await service.record(RECORD, TX as never);
    expect(append).toHaveBeenCalledWith(RECORD, TX);
  });

  it('lets a failure out, so the action it describes fails with it', async () => {
    const { service } = serviceWith(vi.fn().mockRejectedValue(new Error('chain locked')));
    await expect(service.record(RECORD, TX as never)).rejects.toThrow('chain locked');
  });
});

describe('AuditService.recordIndependently', () => {
  it('opens a transaction of its own', async () => {
    const { service, append } = serviceWith();
    await service.recordIndependently(RECORD);
    expect(append).toHaveBeenCalledWith(RECORD, TX);
  });

  // The action has already failed and its response is written; throwing here would replace one
  // failure with another and tell the caller nothing useful.
  it('swallows a failure rather than throwing over an action that already failed', async () => {
    const { service } = serviceWith(vi.fn().mockRejectedValue(new Error('down')));
    await expect(service.recordIndependently(RECORD)).resolves.toBeUndefined();
  });

  it('swallows a rejection that is not an Error too', async () => {
    const { service } = serviceWith(vi.fn().mockRejectedValue('socket hang up'));
    await expect(service.recordIndependently(RECORD)).resolves.toBeUndefined();
  });
});
