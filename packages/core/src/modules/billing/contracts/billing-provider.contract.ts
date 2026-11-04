import { describe, expect, it } from 'vitest';

import type { BillingProvider } from '../application/ports';
import type { BillingErrorCode, CancelRequest, StampRequest } from '../domain/invoice';

/** Lo que la batería necesita además del puerto: contar timbres gastados y provocar fallas, por un camino
 *  que el puerto no expone. El adaptador real lo implementa contra su entorno de pruebas. */
export interface BillingProviderDelContrato {
  readonly billing: BillingProvider;
  readonly stampedCount: () => number;
  /** Hace que la siguiente llamada falle como si el PAC no respondiera, después de timbrar. */
  readonly failNextAfterStamping: (code: BillingErrorCode) => void;
}

export const SOLICITUD_DE_PRUEBA: StampRequest = {
  requestId: 'solicitud-0001',
  paymentForm: '01',
  paymentMethod: 'PUE',
  recipient: {
    rfc: 'XAXX010101000',
    name: 'CLIENTE DE PRUEBA',
    fiscalZip: '55900',
    regime: '616',
    cfdiUse: 'S01',
  },
  concepts: [
    {
      productServiceKey: '30171500',
      unitKey: 'MTK',
      description: 'Vidrio claro 6 mm',
      quantity: 2,
      unitValueCents: 25_000,
      amountCents: 50_000,
      taxObject: '02',
      taxCents: 8_000,
    },
  ],
  issuedAt: new Date('2026-11-03T18:00:00.000Z'),
};

/** Batería de contrato de `BillingProvider`: la pasan todos los adaptadores, el simulado y el del PAC
 *  elegido [RF-M10-01, S4-13]. */
export function billingProviderContract(
  nombre: string,
  crear: () => BillingProviderDelContrato | Promise<BillingProviderDelContrato>,
): void {
  describe(`contrato de BillingProvider: ${nombre}`, () => {
    it('timbra y devuelve un UUID con los importes de la solicitud', async () => {
      const h = await crear();
      const r = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.uuid).not.toBe('');
        expect(r.value.subtotalCents).toBe(50_000);
        expect(r.value.taxCents).toBe(8_000);
        expect(r.value.totalCents).toBe(58_000);
      }
    });

    it('la misma solicitud dos veces devuelve la misma factura y gasta un solo timbre [RN-24]', async () => {
      const h = await crear();
      const a = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      const b = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      expect(a.ok && b.ok && a.value.uuid === b.value.uuid).toBe(true);
      expect(h.stampedCount()).toBe(1);
    });

    it('si el PAC timbró pero la respuesta se perdió, reintentar no duplica el timbre [RN-24]', async () => {
      const h = await crear();
      h.failNextAfterStamping('TIMEOUT');
      const primera = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      expect(primera.ok).toBe(false);
      expect(!primera.ok && primera.error.code).toBe('TIMEOUT');
      const segunda = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      expect(segunda.ok).toBe(true);
      expect(h.stampedCount()).toBe(1);
    });

    it('solicitudes distintas son facturas distintas', async () => {
      const h = await crear();
      const a = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      const b = await h.billing.stamp({ ...SOLICITUD_DE_PRUEBA, requestId: 'solicitud-0002' });
      expect(a.ok && b.ok && a.value.uuid !== b.value.uuid).toBe(true);
      expect(h.stampedCount()).toBe(2);
    });

    it('rechaza una solicitud inválida y dice qué campos fallan, sin gastar timbre', async () => {
      const h = await crear();
      const r = await h.billing.stamp({
        ...SOLICITUD_DE_PRUEBA,
        recipient: { ...SOLICITUD_DE_PRUEBA.recipient, rfc: 'CORTO', fiscalZip: '123' },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('INVALID_REQUEST');
        expect(r.error.fields).toEqual(['recipient.rfc', 'recipient.fiscalZip']);
      }
      expect(h.stampedCount()).toBe(0);
    });

    it('consulta el estatus: vigente tras timbrar y cancelada tras cancelar', async () => {
      const h = await crear();
      const f = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      if (!f.ok) {
        throw new Error('no timbró');
      }
      const antes = await h.billing.getStatus(f.value.uuid);
      expect(antes.ok && antes.value).toBe('VALID');
      const cancelacion: CancelRequest = { uuid: f.value.uuid, motive: '02' };
      const c = await h.billing.cancel(cancelacion);
      expect(c.ok && c.value.status).toBe('CANCELLED');
      const despues = await h.billing.getStatus(f.value.uuid);
      expect(despues.ok && despues.value).toBe('CANCELLED');
    });

    it('cancelar con el motivo 01 exige la factura que la sustituye', async () => {
      const h = await crear();
      const f = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      if (!f.ok) {
        throw new Error('no timbró');
      }
      const sin = await h.billing.cancel({ uuid: f.value.uuid, motive: '01' });
      expect(!sin.ok && sin.error.code).toBe('INVALID_REQUEST');
      const con = await h.billing.cancel({
        uuid: f.value.uuid,
        motive: '01',
        substituteUuid: 'uuid-de-la-sustituta',
      });
      expect(con.ok).toBe(true);
    });

    it('no se cancela dos veces ni se cancela lo que no existe', async () => {
      const h = await crear();
      const f = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      if (!f.ok) {
        throw new Error('no timbró');
      }
      await h.billing.cancel({ uuid: f.value.uuid, motive: '03' });
      const otra = await h.billing.cancel({ uuid: f.value.uuid, motive: '03' });
      expect(!otra.ok && otra.error.code).toBe('ALREADY_CANCELLED');
      const fantasma = await h.billing.cancel({ uuid: 'no-existe', motive: '03' });
      expect(!fantasma.ok && fantasma.error.code).toBe('NOT_FOUND');
      const estatus = await h.billing.getStatus('no-existe');
      expect(!estatus.ok && estatus.error.code).toBe('NOT_FOUND');
    });

    it('descarga el XML con su UUID y un PDF', async () => {
      const h = await crear();
      const f = await h.billing.stamp(SOLICITUD_DE_PRUEBA);
      if (!f.ok) {
        throw new Error('no timbró');
      }
      const d = await h.billing.download(f.value.uuid);
      expect(d.ok).toBe(true);
      if (d.ok) {
        expect(d.value.xml).toContain(f.value.uuid);
        expect(d.value.pdf.byteLength).toBeGreaterThan(0);
      }
      const faltante = await h.billing.download('no-existe');
      expect(!faltante.ok && faltante.error.code).toBe('NOT_FOUND');
    });
  });
}
