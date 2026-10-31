import { folioAllocatorContract } from '../contracts/folio-allocator.contract';
import { inMemoryFolioAllocator } from './folio-allocator';

let anio = 2100;

folioAllocatorContract(
  'memoria',
  () => inMemoryFolioAllocator(),
  () => {
    anio += 2;
    return anio;
  },
);
