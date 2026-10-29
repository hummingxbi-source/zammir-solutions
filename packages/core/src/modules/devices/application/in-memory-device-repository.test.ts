import { asId, sequentialIdGenerator, type Clock } from '../../../index';
import { deviceRepositoryContract } from '../contracts/device-repository.contract';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { inMemoryDeviceRepository } from './in-memory-device-repository';

deviceRepositoryContract(
  'memoria',
  () => {
    let ahora = new Date('2026-10-29T12:00:00.000Z').getTime();
    const clock: Clock = { now: () => new Date(ahora) };
    const auditLog = inMemoryAuditLog();
    const idGenerator = sequentialIdGenerator('d');
    let cuentas = 0;
    return {
      repo: inMemoryDeviceRepository({ clock, idGenerator, auditLog }),
      vencerCodigo: () => {
        ahora += 24 * 60 * 60_000;
        return Promise.resolve();
      },
      nuevaCuenta: () => {
        cuentas += 1;
        return Promise.resolve(`cuenta-${String(cuentas)}`);
      },
      consultasDeLista: () =>
        Promise.resolve(auditLog.entries().filter((e) => e.action === 'DEVICES_LISTED').length),
      bitacoraDe: (id) =>
        Promise.resolve(
          auditLog
            .entries()
            .filter((e) => e.entityId === id)
            .map((e) => e.action),
        ),
    };
  },
  () => asId<'Device'>('no-existe'),
);
