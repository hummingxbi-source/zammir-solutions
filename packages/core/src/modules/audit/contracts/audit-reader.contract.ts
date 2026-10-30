import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import type { AuditLog } from '../application/ports';
import type { AuditCursor, AuditReader } from '../application/reader';
import type { AuditEntry } from '../domain/audit-entry';
import { entradaDePrueba } from './audit-log.contract';

export interface AuditReaderDelContrato {
  readonly log: AuditLog;
  readonly reader: AuditReader;
}

/** Batería de contrato de AuditReader: la pasan todos los adaptadores (memoria, Supabase…).
 *  Cada prueba usa un tipo de entidad propio, así no depende de lo que ya haya en una bitácora compartida. */
export function auditReaderContract(
  nombre: string,
  crear: () => AuditReaderDelContrato | Promise<AuditReaderDelContrato>,
  nuevoId: () => string,
): void {
  describe(`contrato de AuditReader: ${nombre}`, () => {
    const hora = (minutos: number): Date => new Date(Date.UTC(2026, 9, 30, 12, minutos));

    async function guardar(
      h: AuditReaderDelContrato,
      entidad: string,
      cambios: Partial<AuditEntry>,
    ): Promise<AuditEntry> {
      const entrada = entradaDePrueba(nuevoId(), { entityType: entidad, ...cambios });
      const r = await h.log.append(entrada);
      if (!r.ok) throw new Error('no se pudo guardar la entrada de prueba');
      return entrada;
    }

    const entidadUnica = (): string => `prueba-${nuevoId()}`;

    it('devuelve las entradas de la más reciente a la más antigua, con todos sus datos', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      const vieja = await guardar(h, entidad, {
        occurredAt: hora(1),
        action: 'DEVICE_REGISTERED',
        oldValue: null,
        newValue: { nombre: 'Tablet' },
      });
      const nueva = await guardar(h, entidad, {
        occurredAt: hora(2),
        action: 'DEVICE_REVOKED',
        oldValue: { estado: 'activo' },
        newValue: { estado: 'revocado' },
      });
      const r = await h.reader.query({ entityType: entidad });
      expect(r.ok && r.value.entries).toEqual([nueva, vieja]);
      expect(r.ok && r.value.next).toBeNull();
    });

    it('filtra por acción', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      await guardar(h, entidad, { occurredAt: hora(1), action: 'DEVICE_REGISTERED' });
      const revocada = await guardar(h, entidad, { occurredAt: hora(2), action: 'DEVICE_REVOKED' });
      const r = await h.reader.query({ entityType: entidad, action: 'DEVICE_REVOKED' });
      expect(r.ok && r.value.entries).toEqual([revocada]);
    });

    it('filtra por persona y por dispositivo', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      const ana = asId<'User'>('00000000-0000-4000-8000-0000000000a1');
      const luis = asId<'User'>('00000000-0000-4000-8000-0000000000a2');
      const tabletA = asId<'Device'>('00000000-0000-4000-8000-0000000000b1');
      const deAna = await guardar(h, entidad, {
        occurredAt: hora(1),
        userId: ana,
        deviceId: tabletA,
      });
      await guardar(h, entidad, { occurredAt: hora(2), userId: luis, deviceId: null });
      const porPersona = await h.reader.query({ entityType: entidad, userId: ana });
      expect(porPersona.ok && porPersona.value.entries).toEqual([deAna]);
      const porTablet = await h.reader.query({ entityType: entidad, deviceId: tabletA });
      expect(porTablet.ok && porTablet.value.entries).toEqual([deAna]);
    });

    it('filtra por fecha: desde incluida, hasta excluida', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      await guardar(h, entidad, { occurredAt: hora(1) });
      const medio = await guardar(h, entidad, { occurredAt: hora(2) });
      const ultimo = await guardar(h, entidad, { occurredAt: hora(3) });
      const r = await h.reader.query({ entityType: entidad, from: hora(2), to: hora(3) });
      expect(r.ok && r.value.entries).toEqual([medio]);
      const hasta = await h.reader.query({ entityType: entidad, from: hora(3) });
      expect(hasta.ok && hasta.value.entries).toEqual([ultimo]);
    });

    it('combina los filtros: el resultado es la intersección', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      const buscado = await guardar(h, entidad, { occurredAt: hora(5), action: 'DEVICE_REVOKED' });
      await guardar(h, entidad, { occurredAt: hora(1), action: 'DEVICE_REVOKED' });
      await guardar(h, entidad, { occurredAt: hora(5), action: 'DEVICE_REGISTERED' });
      const r = await h.reader.query({
        entityType: entidad,
        action: 'DEVICE_REVOKED',
        from: hora(4),
      });
      expect(r.ok && r.value.entries).toEqual([buscado]);
    });

    it('pagina sin repetir ni saltarse entradas, y la última página no trae siguiente', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      const todas: AuditEntry[] = [];
      for (let i = 1; i <= 5; i += 1) {
        todas.push(await guardar(h, entidad, { occurredAt: hora(i) }));
      }
      const esperado = [...todas].reverse().map((e) => e.id);

      const vistas: string[] = [];
      let siguiente: AuditCursor | null = null;
      for (let paginas = 0; paginas < 10; paginas += 1) {
        const r = await h.reader.query({
          entityType: entidad,
          limit: 2,
          ...(siguiente === null ? {} : { after: siguiente }),
        });
        if (!r.ok) throw new Error('consulta');
        vistas.push(...r.value.entries.map((e) => e.id));
        siguiente = r.value.next;
        if (siguiente === null) break;
      }
      expect(vistas).toEqual(esperado);
    });

    it('entradas con la misma hora se ordenan y paginan de forma estable', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      for (let i = 0; i < 4; i += 1) {
        await guardar(h, entidad, { occurredAt: hora(7) });
      }
      const primera = await h.reader.query({ entityType: entidad, limit: 2 });
      if (!primera.ok || primera.value.next === null) throw new Error('debería haber más páginas');
      const segunda = await h.reader.query({
        entityType: entidad,
        limit: 2,
        after: primera.value.next,
      });
      const ids = [
        ...primera.value.entries.map((e) => e.id),
        ...(segunda.ok ? segunda.value.entries.map((e) => e.id) : []),
      ];
      expect(new Set(ids).size).toBe(4);
    });

    it('un filtro que no coincide con nada da una página vacía', async () => {
      const h = await crear();
      const r = await h.reader.query({ entityType: entidadUnica() });
      expect(r.ok && r.value).toEqual({ entries: [], next: null });
    });

    it('conserva quién autorizó la acción', async () => {
      const h = await crear();
      const entidad = entidadUnica();
      const autorizo = asId<'User'>('00000000-0000-4000-8000-0000000000cc');
      const entrada = await guardar(h, entidad, { occurredAt: hora(1), authorizedBy: autorizo });
      const r = await h.reader.query({ entityType: entidad });
      expect(r.ok && r.value.entries[0]?.authorizedBy).toBe(entrada.authorizedBy);
    });
  });
}
