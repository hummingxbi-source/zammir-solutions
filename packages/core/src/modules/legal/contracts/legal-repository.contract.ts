import { describe, expect, it } from 'vitest';

import type { LegalDocumentRepository } from '../application/ports';
import { currentVersion } from '../domain/legal-document';

export interface EntradaDeBitacoraLegal {
  readonly action: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

export interface LegalRepositoryDelContrato {
  readonly legal: LegalDocumentRepository;
  /** Entradas de bitácora de un documento, por un camino independiente del puerto. */
  readonly bitacoraDe: (id: string) => Promise<readonly EntradaDeBitacoraLegal[]>;
}

/** Batería de contrato de los documentos legales: la pasan todos los adaptadores. Usa el tipo TERMS
 *  para no depender de las versiones del aviso de privacidad que ya trae la base. */
export function legalRepositoryContract(
  nombre: string,
  crear: () => LegalRepositoryDelContrato | Promise<LegalRepositoryDelContrato>,
): void {
  describe(`contrato de LegalDocumentRepository: ${nombre}`, () => {
    const AYER = new Date('2026-10-29T12:00:00.000Z');
    const DENTRO_DE_MUCHO = new Date('2099-01-01T00:00:00.000Z');

    it('cada publicación crea una versión nueva, siguiente a la más alta', async () => {
      const h = await crear();
      const antes = await h.legal.list('TERMS');
      const base = antes.ok ? Math.max(0, ...antes.value.map((d) => d.version)) : 0;
      const a = await h.legal.publish({ type: 'TERMS', body: 'Términos A', effectiveFrom: AYER });
      const b = await h.legal.publish({ type: 'TERMS', body: 'Términos B', effectiveFrom: AYER });
      expect(a.ok && a.value.version).toBe(base + 1);
      expect(b.ok && b.value.version).toBe(base + 2);
    });

    it('las versiones anteriores se conservan intactas y salen en orden', async () => {
      const h = await crear();
      const a = await h.legal.publish({
        type: 'TERMS',
        body: 'Texto original',
        effectiveFrom: AYER,
      });
      await h.legal.publish({ type: 'TERMS', body: 'Texto nuevo', effectiveFrom: AYER });
      const lista = await h.legal.list('TERMS');
      expect(lista.ok).toBe(true);
      if (!lista.ok || !a.ok) return;
      const versiones = lista.value.map((d) => d.version);
      expect(versiones).toEqual([...versiones].sort((x, y) => x - y));
      expect(lista.value.find((d) => d.id === a.value.id)?.body).toBe('Texto original');
    });

    it('guarda el texto, el tipo y la fecha de vigencia', async () => {
      const h = await crear();
      const r = await h.legal.publish({ type: 'TERMS', body: 'Con vigencia', effectiveFrom: AYER });
      expect(r.ok && r.value).toMatchObject({
        type: 'TERMS',
        body: 'Con vigencia',
        effectiveFrom: AYER,
      });
    });

    it('una versión con vigencia futura todavía no es la vigente', async () => {
      const h = await crear();
      const vigente = await h.legal.publish({
        type: 'TERMS',
        body: 'Vigente',
        effectiveFrom: AYER,
      });
      const futura = await h.legal.publish({
        type: 'TERMS',
        body: 'Futura',
        effectiveFrom: DENTRO_DE_MUCHO,
      });
      const lista = await h.legal.list('TERMS');
      if (!lista.ok || !futura.ok || !vigente.ok) throw new Error('publicación');
      const hoy = currentVersion(lista.value, new Date('2026-10-30T12:00:00.000Z'));
      expect(hoy?.version).toBeGreaterThanOrEqual(vigente.value.version);
      expect(hoy?.id).not.toBe(futura.value.id);
      expect(currentVersion(lista.value, DENTRO_DE_MUCHO)?.id).toBe(futura.value.id);
    });

    it('los tipos tienen versiones independientes', async () => {
      const h = await crear();
      const terminos = await h.legal.publish({ type: 'TERMS', body: 'T', effectiveFrom: AYER });
      const aviso = await h.legal.list('PRIVACY_NOTICE');
      expect(terminos.ok).toBe(true);
      expect(aviso.ok && aviso.value.every((d) => d.type === 'PRIVACY_NOTICE')).toBe(true);
    });

    it('cada publicación deja su entrada de bitácora', async () => {
      const h = await crear();
      const r = await h.legal.publish({ type: 'TERMS', body: 'Con bitácora', effectiveFrom: AYER });
      if (!r.ok) throw new Error('publicación');
      const bitacora = await h.bitacoraDe(r.value.id);
      expect(bitacora.map((e) => e.action)).toEqual(['LEGAL_DOCUMENT_PUBLISHED']);
      expect(bitacora[0]?.newValue).toMatchObject({ tipo: 'TERMS', version: r.value.version });
    });

    it('el puerto no puede editar ni borrar versiones', async () => {
      const h = await crear();
      for (const operacion of ['update', 'edit', 'delete', 'remove']) {
        expect(operacion in h.legal).toBe(false);
      }
    });
  });
}
