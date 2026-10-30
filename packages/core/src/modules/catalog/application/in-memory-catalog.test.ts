import { fixedClock } from '../../../shared-kernel/clock';
import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { catalogContract } from '../contracts/catalog.contract';
import { inMemoryCatalog } from './in-memory-catalog';

catalogContract('memoria', () => {
  const ids = sequentialIdGenerator('p');
  const auditLog = inMemoryAuditLog();
  const catalogo = inMemoryCatalog({
    idGenerator: sequentialIdGenerator('c'),
    clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')),
    auditLog,
  });
  let codigos = 0;
  return {
    admin: catalogo,
    reader: catalogo,
    categorias: catalogo,
    nuevoIdDeProducto: () => ids.newId<'Product'>(),
    idDeCategoriaInexistente: asId<'Category'>('no-existe'),
    codigoNuevo: () => {
      codigos += 1;
      return `COD-${String(codigos)}`;
    },
    bitacoraDeProducto: (id) =>
      Promise.resolve(
        auditLog
          .entries()
          .filter((e) => e.entityId === id)
          .map((e) => ({ action: e.action, oldValue: e.oldValue, newValue: e.newValue })),
      ),
  };
});
