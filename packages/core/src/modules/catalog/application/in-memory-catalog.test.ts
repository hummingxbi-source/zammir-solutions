import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import { catalogContract } from '../contracts/catalog.contract';
import { inMemoryCatalog } from './in-memory-catalog';

catalogContract('memoria', () => {
  const ids = sequentialIdGenerator('p');
  const catalogo = inMemoryCatalog(sequentialIdGenerator('c'));
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
  };
});
