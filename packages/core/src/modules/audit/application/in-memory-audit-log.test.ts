import { auditLogContract } from '../contracts/audit-log.contract';
import { auditReaderContract } from '../contracts/audit-reader.contract';
import { inMemoryAuditLog } from './in-memory-audit-log';

let contador = 0;
const nuevoId = (): string => {
  contador += 1;
  return `00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`;
};

auditLogContract(
  'memoria',
  () => {
    const bitacora = inMemoryAuditLog();
    return { log: bitacora, leer: () => Promise.resolve(bitacora.entries()) };
  },
  nuevoId,
);

auditReaderContract(
  'memoria',
  () => {
    const bitacora = inMemoryAuditLog();
    return { log: bitacora, reader: bitacora };
  },
  nuevoId,
);
