import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { legalRepositoryContract } from '../contracts/legal-repository.contract';
import { inMemoryLegal } from './in-memory-legal';

legalRepositoryContract('memoria', () => {
  const auditLog = inMemoryAuditLog();
  return {
    legal: inMemoryLegal({
      clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')),
      idGenerator: sequentialIdGenerator('l'),
      auditLog,
    }),
    bitacoraDe: (id) =>
      Promise.resolve(
        auditLog
          .entries()
          .filter((e) => e.entityId === id)
          .map((e) => ({ action: e.action, oldValue: e.oldValue, newValue: e.newValue })),
      ),
  };
});
