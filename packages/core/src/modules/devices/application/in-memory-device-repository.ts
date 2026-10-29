import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import type { InMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { recordAuditEntry } from '../../audit/application/record-audit-entry';
import type { Device } from '../domain/device';
import type { DeviceRepository } from './ports';

const MS_POR_MINUTO = 60_000;

interface CodigoGuardado {
  readonly expiresAt: Date;
  usado: boolean;
}

export interface InMemoryDeviceDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly auditLog: InMemoryAuditLog;
}

/** Adaptador en memoria del puerto DeviceRepository, para pruebas. */
export function inMemoryDeviceRepository(deps: InMemoryDeviceDeps): DeviceRepository {
  const codigos = new Map<string, CodigoGuardado>();
  const dispositivos = new Map<string, Device>();
  let consecutivoDeCodigo = 0;
  const auditoria = { auditLog: deps.auditLog, clock: deps.clock, idGenerator: deps.idGenerator };

  return {
    issueCode(validityMinutes) {
      consecutivoDeCodigo += 1;
      const code = `CODIGO${String(consecutivoDeCodigo).padStart(3, '0')}`;
      const expiresAt = new Date(deps.clock.now().getTime() + validityMinutes * MS_POR_MINUTO);
      codigos.set(code, { expiresAt, usado: false });
      return Promise.resolve(ok({ code, expiresAt }));
    },

    async redeemCode({ code, name, authUserId }) {
      const guardado = codigos.get(code);
      if (
        guardado === undefined ||
        guardado.usado ||
        guardado.expiresAt.getTime() <= deps.clock.now().getTime()
      ) {
        return err({ code: 'CODE_INVALID' });
      }
      guardado.usado = true;
      const dispositivo: Device = {
        id: deps.idGenerator.newId<'Device'>(),
        name,
        tempSeries: dispositivos.size + 1,
        status: 'ACTIVE',
        createdAt: deps.clock.now(),
        lastSentAt: null,
        revokedAt: null,
      };
      dispositivos.set(dispositivo.id, dispositivo);
      await recordAuditEntry(auditoria, {
        userId: null,
        deviceId: dispositivo.id,
        action: 'DEVICE_REGISTERED',
        entityType: 'device',
        entityId: dispositivo.id,
        oldValue: null,
        newValue: { nombre: name, estado: 'ACTIVE', cuenta: authUserId },
      });
      return ok(dispositivo);
    },

    async list() {
      await recordAuditEntry(auditoria, {
        userId: null,
        deviceId: null,
        action: 'DEVICES_LISTED',
        entityType: 'device',
        entityId: 'list',
        oldValue: null,
        newValue: null,
      });
      return ok([...dispositivos.values()]);
    },

    async revoke(id) {
      const actual = dispositivos.get(id);
      if (actual === undefined) {
        return err({ code: 'DEVICE_NOT_FOUND' });
      }
      if (actual.status === 'REVOKED') {
        return ok(actual);
      }
      const revocado: Device = { ...actual, status: 'REVOKED', revokedAt: deps.clock.now() };
      dispositivos.set(id, revocado);
      await recordAuditEntry(auditoria, {
        userId: null,
        deviceId: null,
        action: 'DEVICE_REVOKED',
        entityType: 'device',
        entityId: id,
        oldValue: { estado: 'ACTIVE' },
        newValue: { estado: 'REVOKED' },
      });
      return ok(revocado);
    },
  };
}
