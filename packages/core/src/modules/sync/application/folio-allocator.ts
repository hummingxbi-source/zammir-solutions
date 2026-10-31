import type { FolioDocType } from '../../../shared-kernel/folio/folio';

/** Dentro de una transacción: pide el siguiente número de un tipo de documento y año. */
export interface FolioTransaction {
  next(docType: FolioDocType, year: number): Promise<number>;
}

/** Puerto del servidor: asigna folios definitivos [RN-15, RN-16, ADR-0016].
 *  - Dos transacciones simultáneas se turnan: nunca obtienen el mismo número.
 *  - Si el trabajo falla (rechaza la promesa), los números pedidos en esa transacción se revierten:
 *    no quedan huecos.
 *  - Cada (tipo, año) lleva su propia cuenta y empieza en 1. */
export interface FolioAllocator {
  withTransaction<T>(work: (tx: FolioTransaction) => Promise<T>): Promise<T>;
}

/** Adaptador en memoria para pruebas: las transacciones se atienden una por una, igual que el
 *  bloqueo de fila del servidor, y una que falla deja los contadores como estaban. */
export function inMemoryFolioAllocator(): FolioAllocator {
  const contadores = new Map<string, number>();
  let cola: Promise<unknown> = Promise.resolve();

  return {
    withTransaction<T>(work: (tx: FolioTransaction) => Promise<T>): Promise<T> {
      const turno = cola.then(async () => {
        const copia = new Map(contadores);
        const tx: FolioTransaction = {
          next: (docType, year) => {
            const llave = `${docType}:${String(year)}`;
            const siguiente = (copia.get(llave) ?? 0) + 1;
            copia.set(llave, siguiente);
            return Promise.resolve(siguiente);
          },
        };
        const resultado = await work(tx);
        contadores.clear();
        for (const [llave, valor] of copia) {
          contadores.set(llave, valor);
        }
        return resultado;
      });
      // El siguiente turno espera a este, aunque falle.
      cola = turno.catch(() => undefined);
      return turno;
    },
  };
}
