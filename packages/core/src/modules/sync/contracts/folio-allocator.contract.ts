import { describe, expect, it } from 'vitest';

import type { FolioAllocator } from '../application/folio-allocator';

/** Batería de contrato de FolioAllocator: la pasan el adaptador en memoria y el de Postgres. */
export function folioAllocatorContract(
  nombre: string,
  crear: () => FolioAllocator | Promise<FolioAllocator>,
  /** Un año que no haya usado otra prueba (el servidor real conserva sus contadores entre pruebas). */
  anioNuevo: () => number,
): void {
  describe(`contrato de FolioAllocator: ${nombre}`, () => {
    it('empieza en 1 y avanza de uno en uno dentro de la transacción', async () => {
      const a = await crear();
      const anio = anioNuevo();
      const numeros = await a.withTransaction(async (tx) => [
        await tx.next('QUOTE', anio),
        await tx.next('QUOTE', anio),
        await tx.next('QUOTE', anio),
      ]);
      expect(numeros).toEqual([1, 2, 3]);
    });

    it('cada tipo y cada año llevan su propia cuenta', async () => {
      const a = await crear();
      const anio = anioNuevo();
      const otro = anioNuevo();
      const numeros = await a.withTransaction(async (tx) => [
        await tx.next('QUOTE', anio),
        await tx.next('WORK_ORDER', anio),
        await tx.next('QUOTE', otro),
        await tx.next('QUOTE', anio),
      ]);
      expect(numeros).toEqual([1, 1, 1, 2]);
    });

    it('una transacción que falla no consume números: no hay huecos', async () => {
      const a = await crear();
      const anio = anioNuevo();
      await expect(
        a.withTransaction(async (tx) => {
          await tx.next('QUOTE', anio);
          await tx.next('QUOTE', anio);
          throw new Error('falla a mitad');
        }),
      ).rejects.toThrow('falla a mitad');
      const siguiente = await a.withTransaction((tx) => tx.next('QUOTE', anio));
      expect(siguiente).toBe(1);
    });

    it('al cambiar de año el contador de ese año empieza en 1', async () => {
      const a = await crear();
      const anio = anioNuevo();
      await a.withTransaction((tx) => tx.next('QUOTE', anio));
      const nuevo = await a.withTransaction((tx) => tx.next('QUOTE', anio + 1));
      expect(nuevo).toBe(1);
    });

    it('transacciones simultáneas se turnan: 40 pedidos dan exactamente 1..40, sin repetidos', async () => {
      const a = await crear();
      const anio = anioNuevo();
      const resultados = await Promise.all(
        Array.from({ length: 40 }, () => a.withTransaction((tx) => tx.next('QUOTE', anio))),
      );
      expect([...resultados].sort((x, y) => x - y)).toEqual(
        Array.from({ length: 40 }, (_v, i) => i + 1),
      );
    });

    it('con fallas mezcladas entre los pedidos simultáneos, los que salen bien son 1..N sin huecos', async () => {
      const a = await crear();
      const anio = anioNuevo();
      const intentos = await Promise.allSettled(
        Array.from({ length: 30 }, (_v, i) =>
          a.withTransaction(async (tx) => {
            const n = await tx.next('QUOTE', anio);
            if (i % 3 === 0) {
              throw new Error('falla');
            }
            return n;
          }),
        ),
      );
      const buenos = intentos
        .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
        .sort((x, y) => x - y);
      expect(buenos).toEqual(Array.from({ length: buenos.length }, (_v, i) => i + 1));
      expect(buenos).toHaveLength(20);
    });
  });
}
