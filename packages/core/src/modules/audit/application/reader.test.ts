import { describe, expect, it } from 'vitest';

import { inMemoryAuditLog } from './in-memory-audit-log';
import { DEFAULT_AUDIT_PAGE, listAuditEntries, MAX_AUDIT_PAGE, pageSize } from './reader';

describe('pageSize', () => {
  it.each([
    [undefined, DEFAULT_AUDIT_PAGE],
    [10, 10],
    [0, 1],
    [-5, 1],
    [1, 1],
    [MAX_AUDIT_PAGE, MAX_AUDIT_PAGE],
    [MAX_AUDIT_PAGE + 1, MAX_AUDIT_PAGE],
    [1_000_000, MAX_AUDIT_PAGE],
    [7.9, 7],
  ])('%s → %i', (pedido, esperado) => {
    expect(pageSize(pedido)).toBe(esperado);
  });
});

describe('listAuditEntries', () => {
  it('un administrador consulta la bitácora', async () => {
    const reader = inMemoryAuditLog();
    const r = await listAuditEntries({ reader }, { role: 'ADMIN' });
    expect(r.ok && r.value).toEqual({ entries: [], next: null });
  });

  it.each(['STAFF', 'DEVICE', null] as const)('%s no tiene acceso a la bitácora', async (role) => {
    const reader = inMemoryAuditLog();
    const r = await listAuditEntries({ reader }, { role });
    expect(!r.ok && r.error.code).toBe('AUDIT_REJECTED');
  });
});
