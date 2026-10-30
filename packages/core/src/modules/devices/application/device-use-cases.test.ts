import { describe, expect, it, vi } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { ok } from '../../../shared-kernel/result';
import type { Device } from '../domain/device';
import {
  issueRegistrationCode,
  listDevices,
  redeemRegistrationCode,
  revokeDevice,
} from './device-use-cases';
import type { DeviceRepository } from './ports';

const dispositivo: Device = {
  id: asId<'Device'>('d-1'),
  name: 'Tablet',
  tempSeries: 1,
  status: 'ACTIVE',
  createdAt: new Date('2026-10-29T12:00:00.000Z'),
  lastSentAt: null,
  revokedAt: null,
};

function repositorio(): { [K in keyof DeviceRepository]: ReturnType<typeof vi.fn> } {
  return {
    issueCode: vi.fn(() =>
      Promise.resolve(ok({ code: 'ABC', expiresAt: new Date('2026-10-29T12:15:00.000Z') })),
    ),
    redeemCode: vi.fn(() => Promise.resolve(ok(dispositivo))),
    list: vi.fn(() => Promise.resolve(ok([dispositivo]))),
    revoke: vi.fn(() => Promise.resolve(ok(dispositivo))),
  };
}

describe('casos de uso de dispositivos', () => {
  describe.each([
    ['un cajero', 'STAFF'],
    ['un dispositivo', 'DEVICE'],
    ['alguien sin rol', null],
  ] as const)('%s', (_quien, role) => {
    it('no puede emitir, listar ni revocar, y la base ni se entera', async () => {
      const repo = repositorio();
      const deps = { devices: repo as unknown as DeviceRepository };
      const resultados = [
        await issueRegistrationCode(deps, { role }, 15),
        await listDevices(deps, { role }),
        await revokeDevice(deps, { role }, dispositivo.id),
      ];
      for (const r of resultados) {
        expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
      }
      expect(repo.issueCode).not.toHaveBeenCalled();
      expect(repo.list).not.toHaveBeenCalled();
      expect(repo.revoke).not.toHaveBeenCalled();
    });
  });

  it('un administrador emite, lista y revoca', async () => {
    const repo = repositorio();
    const deps = { devices: repo as unknown as DeviceRepository };
    expect((await issueRegistrationCode(deps, { role: 'ADMIN' }, 15)).ok).toBe(true);
    expect((await listDevices(deps, { role: 'ADMIN' })).ok).toBe(true);
    expect((await revokeDevice(deps, { role: 'ADMIN' }, dispositivo.id)).ok).toBe(true);
    expect(repo.issueCode).toHaveBeenCalledWith(15);
    expect(repo.revoke).toHaveBeenCalledWith(dispositivo.id);
  });

  it.each([0, -5, 1.5, Number.NaN])('rechaza una vigencia de %s minutos', async (minutos) => {
    const repo = repositorio();
    const r = await issueRegistrationCode(
      { devices: repo as unknown as DeviceRepository },
      { role: 'ADMIN' },
      minutos,
    );
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
    expect(repo.issueCode).not.toHaveBeenCalled();
  });

  it.each([
    ['sin código', { code: '  ', name: 'Tablet', authUserId: 'u-1' }],
    ['sin nombre', { code: 'ABC', name: '  ', authUserId: 'u-1' }],
    ['sin cuenta', { code: 'ABC', name: 'Tablet', authUserId: ' ' }],
  ])('el canje %s se rechaza', async (_caso, entrada) => {
    const repo = repositorio();
    const r = await redeemRegistrationCode(
      { devices: repo as unknown as DeviceRepository },
      entrada,
    );
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
    expect(repo.redeemCode).not.toHaveBeenCalled();
  });

  it('el canje quita los espacios sobrantes del código y del nombre', async () => {
    const repo = repositorio();
    await redeemRegistrationCode(
      { devices: repo as unknown as DeviceRepository },
      { code: ' ABC ', name: ' Tablet ', authUserId: 'u-1' },
    );
    expect(repo.redeemCode).toHaveBeenCalledWith({
      code: 'ABC',
      name: 'Tablet',
      authUserId: 'u-1',
    });
  });
});
