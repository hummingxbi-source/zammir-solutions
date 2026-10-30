import { auditLogContract } from '../contracts/audit-log.contract';
import { inMemoryAuditLog } from './in-memory-audit-log';

let contador = 0;

auditLogContract(
  'en memoria',
  () => {
    const bitacora = inMemoryAuditLog();
    return { log: bitacora, leer: () => Promise.resolve(bitacora.entries()) };
  },
  () => {
    contador += 1;
    return `entrada-${String(contador)}`;
  },
);
