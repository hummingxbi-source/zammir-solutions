import { describe, expect, it, vi } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId, sequentialIdGenerator, type DeviceId, type UserId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import { inMemoryAuditLog } from './in-memory-audit-log';
import type { AuditLog } from './ports';
import { recordAuditEntry } from './record-audit-entry';

const instante = new Date('2026-10-29T18:30:00.000Z');
const usuario: UserId = asId<'User'>('usuario-1');
const dispositivo: DeviceId = asId<'Device'>('dispositivo-1');

function dependencias(auditLog: AuditLog = inMemoryAuditLog()) {
  return { auditLog, clock: fixedClock(instante), idGenerator: sequentialIdGenerator('bit') };
}

const entrada = {
  userId: usuario,
  deviceId: dispositivo,
  action: 'DEVICE_REVOKED',
  entityType: 'device',
  entityId: 'dispositivo-7',
  oldValue: { estado: 'activo' },
  newValue: { estado: 'revocado' },
} as const;

describe('recordAuditEntry', () => {
  it('guarda usuario, dispositivo, hora en UTC y valores anterior y nuevo', async () => {
    const bitacora = inMemoryAuditLog();
    const resultado = await recordAuditEntry(dependencias(bitacora), entrada);

    expect(resultado.ok).toBe(true);
    expect(bitacora.entries()).toEqual([
      {
        id: 'bit-0001',
        occurredAt: instante,
        userId: usuario,
        deviceId: dispositivo,
        action: 'DEVICE_REVOKED',
        entityType: 'device',
        entityId: 'dispositivo-7',
        oldValue: { estado: 'activo' },
        newValue: { estado: 'revocado' },
      },
    ]);
  });

  it('la hora sale del reloj y el identificador del generador, nunca del sistema', async () => {
    const resultado = await recordAuditEntry(dependencias(), entrada);
    expect(resultado.ok && resultado.value.occurredAt.toISOString()).toBe(
      '2026-10-29T18:30:00.000Z',
    );
    expect(resultado.ok && resultado.value.id).toBe('bit-0001');
  });

  it('acepta una acción hecha por el sistema, sin persona ni dispositivo', async () => {
    const bitacora = inMemoryAuditLog();
    await recordAuditEntry(dependencias(bitacora), { ...entrada, userId: null, deviceId: null });
    expect(bitacora.entries()[0]?.userId).toBeNull();
    expect(bitacora.entries()[0]?.deviceId).toBeNull();
  });

  it.each([
    ['sin tipo de entidad', { entityType: '' }],
    ['con tipo de entidad en blanco', { entityType: '   ' }],
    ['sin identificador de entidad', { entityId: '' }],
    ['con identificador de entidad en blanco', { entityId: '  ' }],
  ])('rechaza una entrada %s sin llamar a la bitácora', async (_descripcion, cambio) => {
    const append = vi.fn();
    const resultado = await recordAuditEntry(dependencias({ append }), { ...entrada, ...cambio });
    expect(!resultado.ok && resultado.error.code).toBe('INVALID_AUDIT_INPUT');
    expect(append).not.toHaveBeenCalled();
  });

  it('si la bitácora no puede guardar, devuelve ese error', async () => {
    const auditLog: AuditLog = {
      append: () => Promise.resolve(err({ code: 'AUDIT_UNAVAILABLE' })),
    };
    const resultado = await recordAuditEntry(dependencias(auditLog), entrada);
    expect(!resultado.ok && resultado.error.code).toBe('AUDIT_UNAVAILABLE');
  });

  it('cada entrada recibe un identificador distinto', async () => {
    const deps = dependencias();
    const a = await recordAuditEntry(deps, entrada);
    const b = await recordAuditEntry(deps, entrada);
    expect(a.ok && b.ok && a.value.id !== b.value.id).toBe(true);
  });

  it('el puerto recibe exactamente la entrada que se devuelve', async () => {
    const append = vi.fn(() => Promise.resolve(ok(undefined)));
    const resultado = await recordAuditEntry(dependencias({ append }), entrada);
    expect(append).toHaveBeenCalledWith(resultado.ok ? resultado.value : undefined);
  });
});
