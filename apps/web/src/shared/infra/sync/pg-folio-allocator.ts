import type { Pool } from 'pg';
import type { FolioAllocator } from '@zammir/core';

/** Asignador de folios sobre Postgres con transacciones reales (conexión directa). Solo para pruebas
 *  de integración: en producción los folios los asigna la función `receive_operation` [ADR-0016]. */
export function pgFolioAllocator(pool: Pool): FolioAllocator {
  return {
    async withTransaction(work) {
      const cliente = await pool.connect();
      try {
        await cliente.query('begin');
        const resultado = await work({
          next: async (docType, year) => {
            const r = await cliente.query<{ next_folio: string }>(
              'select private.next_folio($1, $2) as next_folio',
              [docType, year],
            );
            return Number(r.rows[0]?.next_folio);
          },
        });
        await cliente.query('commit');
        return resultado;
      } catch (error) {
        await cliente.query('rollback');
        throw error;
      } finally {
        cliente.release();
      }
    },
  };
}
