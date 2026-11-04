import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import {
  invoiceTotals,
  validateCancelRequest,
  validateStampRequest,
  type BillingErrorCode,
  type InvoiceStatus,
  type StampedInvoice,
  type StampRequest,
} from '../domain/invoice';
import type { BillingProvider } from './ports';

export interface SimulatedBillingDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  /** Si es verdadero, una cancelación queda "pendiente" (como cuando el receptor debe aceptarla) en lugar de
   *  completarse. Con `resolveCancellation` se completa. */
  readonly cancellationNeedsAcceptance?: boolean;
}

/** Cómo falla la siguiente llamada: antes de timbrar (no pasó nada) o **después** (el PAC sí timbró pero la
 *  respuesta se perdió, el caso peligroso de [RN-24]). */
export interface FailureOptions {
  readonly afterStamping?: boolean;
}

export interface SimulatedBilling extends BillingProvider {
  /** Hace que la siguiente llamada falle con este código. */
  failNext(code: BillingErrorCode, opciones?: FailureOptions): void;
  /** Cuántos timbres se gastaron de verdad. Las solicitudes repetidas no cuentan. */
  stampedCount(): number;
  /** Completa una cancelación que quedó pendiente. */
  resolveCancellation(uuid: string): void;
}

interface Registro {
  readonly factura: StampedInvoice;
  readonly solicitud: StampRequest;
  estado: InvoiceStatus;
}

/** Adaptador simulado de `BillingProvider`: responde como un PAC, en memoria, para construir y probar todo
 *  el flujo de facturación sin depender del PAC real [ADR-0007]. Valida igual que lo haría el PAC y respeta
 *  la idempotencia por `requestId`. Los archivos que devuelve son de mentira y no tienen validez fiscal. */
export function simulatedBilling(deps: SimulatedBillingDeps): SimulatedBilling {
  const porSolicitud = new Map<string, Registro>();
  const porUuid = new Map<string, Registro>();
  let falla: { code: BillingErrorCode; afterStamping: boolean } | null = null;

  function tomarFalla(): { code: BillingErrorCode; afterStamping: boolean } | null {
    const actual = falla;
    falla = null;
    return actual;
  }

  return {
    failNext(code, opciones) {
      falla = { code, afterStamping: opciones?.afterStamping ?? false };
    },

    stampedCount: () => porUuid.size,

    resolveCancellation(uuid) {
      const registro = porUuid.get(uuid);
      if (registro?.estado === 'CANCELLATION_PENDING') {
        registro.estado = 'CANCELLED';
      }
    },

    stamp(solicitud) {
      const falla1 = tomarFalla();
      if (falla1 !== null && !falla1.afterStamping) {
        return Promise.resolve(err({ code: falla1.code }));
      }
      const valida = validateStampRequest(solicitud);
      if (!valida.ok) {
        return Promise.resolve(err(valida.error));
      }
      let registro = porSolicitud.get(solicitud.requestId);
      if (registro === undefined) {
        const totales = invoiceTotals(solicitud.concepts);
        registro = {
          factura: {
            uuid: deps.idGenerator.newId<'Invoice'>(),
            stampedAt: deps.clock.now(),
            ...totales,
          },
          solicitud,
          estado: 'VALID',
        };
        porSolicitud.set(solicitud.requestId, registro);
        porUuid.set(registro.factura.uuid, registro);
      }
      if (falla1 !== null) {
        return Promise.resolve(err({ code: falla1.code }));
      }
      return Promise.resolve(ok(registro.factura));
    },

    cancel(solicitud) {
      const falla1 = tomarFalla();
      if (falla1 !== null) {
        return Promise.resolve(err({ code: falla1.code }));
      }
      const valida = validateCancelRequest(solicitud);
      if (!valida.ok) {
        return Promise.resolve(err(valida.error));
      }
      const registro = porUuid.get(solicitud.uuid);
      if (registro === undefined) {
        return Promise.resolve(err({ code: 'NOT_FOUND' }));
      }
      if (registro.estado === 'CANCELLED') {
        return Promise.resolve(err({ code: 'ALREADY_CANCELLED' }));
      }
      registro.estado =
        deps.cancellationNeedsAcceptance === true ? 'CANCELLATION_PENDING' : 'CANCELLED';
      return Promise.resolve(ok({ uuid: solicitud.uuid, status: registro.estado }));
    },

    getStatus(uuid) {
      const falla1 = tomarFalla();
      if (falla1 !== null) {
        return Promise.resolve(err({ code: falla1.code }));
      }
      const registro = porUuid.get(uuid);
      return Promise.resolve(
        registro === undefined ? err({ code: 'NOT_FOUND' as const }) : ok(registro.estado),
      );
    },

    download(uuid) {
      const falla1 = tomarFalla();
      if (falla1 !== null) {
        return Promise.resolve(err({ code: falla1.code }));
      }
      const registro = porUuid.get(uuid);
      if (registro === undefined) {
        return Promise.resolve(err({ code: 'NOT_FOUND' as const }));
      }
      const xml =
        `<cfdi:Comprobante Version="4.0" Total="${centavosATexto(registro.factura.totalCents)}">` +
        `<cfdi:Receptor Rfc="${registro.solicitud.recipient.rfc}"/>` +
        `<tfd:TimbreFiscalDigital UUID="${uuid}"/></cfdi:Comprobante>`;
      return Promise.resolve(ok({ xml, pdf: aBytes(`%PDF-1.4 FACTURA SIMULADA ${uuid}`) }));
    },
  };
}

/** Texto ASCII a bytes; el PDF simulado no necesita más. */
function aBytes(texto: string): Uint8Array {
  return Uint8Array.from(texto, (c) => c.charCodeAt(0) % 256);
}

function centavosATexto(centavos: number): string {
  return `${String(Math.floor(centavos / 100))}.${String(centavos % 100).padStart(2, '0')}`;
}
