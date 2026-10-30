import { describe, expect, it } from 'vitest';

import type { AuditLog } from '../application/ports';
import type { AuditEntry } from '../domain/audit-entry';

export interface AuditLogDelContrato {
  readonly log: AuditLog;
  /** Lee lo que quedó guardado, por un camino independiente del puerto. */
  readonly leer: () => Promise<readonly AuditEntry[]>;
}

export function entradaDePrueba(id: string, cambios: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: id as AuditEntry['id'],
    occurredAt: new Date('2026-10-29T12:00:00.000Z'),
    userId: null,
    deviceId: null,
    action: 'DEVICE_REGISTERED',
    entityType: 'device',
    entityId: 'dispositivo-1',
    oldValue: null,
    newValue: { nombre: 'Tablet del mostrador' },
    ...cambios,
  };
}

/** Batería de contrato de AuditLog: la pasan todos los adaptadores (memoria, Supabase…).
 *  `crear` devuelve una bitácora nueva; `id` debe ser único por prueba si el almacén es compartido. */
export function auditLogContract(
  nombre: string,
  crear: () => AuditLogDelContrato | Promise<AuditLogDelContrato>,
  nuevoId: () => string,
): void {
  describe(`contrato de AuditLog: ${nombre}`, () => {
    it('guarda todos los datos de la entrada: quién, dónde, cuándo y valores anterior y nuevo', async () => {
      const { log, leer } = await crear();
      const id = nuevoId();
      const entrada = entradaDePrueba(id, {
        action: 'DEVICE_REVOKED',
        entityId: `dispositivo-${id}`,
        oldValue: { estado: 'activo' },
        newValue: { estado: 'revocado' },
        occurredAt: new Date('2026-11-02T03:04:05.678Z'),
      });
      const resultado = await log.append(entrada);
      expect(resultado.ok).toBe(true);

      const guardada = (await leer()).find((e) => e.id === id);
      expect(guardada).toEqual(entrada);
    });

    it('guarda a quién actuó y desde qué dispositivo cuando se conocen', async () => {
      const { log, leer } = await crear();
      const id = nuevoId();
      const usuario = '00000000-0000-4000-8000-0000000000aa' as AuditEntry['userId'];
      const dispositivo = '00000000-0000-4000-8000-0000000000bb' as AuditEntry['deviceId'];
      await log.append(entradaDePrueba(id, { userId: usuario, deviceId: dispositivo }));

      const guardada = (await leer()).find((e) => e.id === id);
      expect(guardada?.userId).toBe(usuario);
      expect(guardada?.deviceId).toBe(dispositivo);
    });

    it('una entrada ya guardada no se cambia: otra con el mismo identificador no la sustituye', async () => {
      const { log, leer } = await crear();
      const id = nuevoId();
      await log.append(entradaDePrueba(id, { newValue: { estado: 'original' } }));
      await log.append(entradaDePrueba(id, { newValue: { estado: 'alterado' } }));
      const guardada = (await leer()).find((e) => e.id === id);
      expect(guardada?.newValue).toEqual({ estado: 'original' });
    });

    it('agregar dos veces la misma entrada deja una sola y no falla', async () => {
      const { log, leer } = await crear();
      const id = nuevoId();
      const entrada = entradaDePrueba(id);
      expect((await log.append(entrada)).ok).toBe(true);
      expect((await log.append(entrada)).ok).toBe(true);
      expect((await leer()).filter((e) => e.id === id)).toHaveLength(1);
    });
  });
}
