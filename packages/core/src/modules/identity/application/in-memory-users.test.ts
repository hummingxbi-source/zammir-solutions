import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { pinHasherContract } from '../contracts/pin-hasher.contract';
import { userRepositoryContract } from '../contracts/user-repository.contract';
import { fakePinHasher, inMemoryUsers } from './in-memory-users';

pinHasherContract('falso (pruebas)', () => fakePinHasher());

userRepositoryContract('memoria', () => {
  const auditLog = inMemoryAuditLog();
  const ids = sequentialIdGenerator('u');
  let nombres = 0;
  return {
    users: inMemoryUsers({
      clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')),
      idGenerator: sequentialIdGenerator('b'),
      auditLog,
    }),
    nuevoId: () => ids.newId<'User'>(),
    nombreNuevo: () => {
      nombres += 1;
      return `Persona ${String(nombres)}`;
    },
    bitacoraDe: (id) =>
      Promise.resolve(
        auditLog
          .entries()
          .filter((e) => e.entityId === id)
          .map((e) => ({ action: e.action, oldValue: e.oldValue, newValue: e.newValue })),
      ),
  };
});
