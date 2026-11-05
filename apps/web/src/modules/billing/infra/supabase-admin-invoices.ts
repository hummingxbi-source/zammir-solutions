import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateStampUsage,
  type AdminCancelResult,
  type AdminInvoiceFiles,
  type AdminInvoices,
  type AdminIssueResult,
  type AdminRetryResult,
  type CancellationMotive,
  type CustomerInvoice,
  type InvoiceCandidate,
  type IssuedInvoice,
  type PortalRecipientInput,
} from '@zammir/core';

export interface SupabaseAdminInvoicesOptions {
  /** Dirección de Supabase, sin diagonal final. */
  readonly url: string;
  readonly anonKey: string;
  /** Solo para pruebas. */
  readonly fetchImpl?: typeof fetch;
}

interface FilaDeFacturable {
  readonly source_type: 'COUNTER_SALE' | 'WORK_ORDER';
  readonly source_id: string;
  readonly folio: string;
  readonly customer_name: string | null;
  readonly customer_fiscal: Partial<Record<keyof PortalRecipientInput, string | null>> | null;
  readonly total_cents: number;
  readonly settled_at: string | null;
}

interface FilaDeFactura {
  readonly request_id: string;
  readonly status: IssuedInvoice['status'];
  readonly invoice_folio: string | null;
  readonly channel: 'SYSTEM' | 'PORTAL';
  readonly source_type: 'COUNTER_SALE' | 'WORK_ORDER';
  readonly source_folio: string | null;
  readonly customer_name: string | null;
  readonly total_cents: number | null;
  readonly stamped_at: string | null;
  readonly created_at: string;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly cancel_motive: CancellationMotive | null;
  readonly cancel_requested_at: string | null;
  readonly cancelled_at: string | null;
}

interface FilaDeFacturaDelCliente {
  readonly invoice_folio: string;
  readonly status: 'STAMPED' | 'CANCELLED';
  readonly source_type: 'COUNTER_SALE' | 'WORK_ORDER';
  readonly source_folio: string | null;
  readonly total_cents: number | null;
  readonly stamped_at: string | null;
}

interface FilaDeArchivos {
  readonly invoice_folio: string;
  readonly xml: string;
  readonly pdf_base64: string;
}

interface FilaDeTimbres {
  readonly used: number;
  readonly yearly_limit: number | null;
  readonly warning_percent: number;
}

function aReceptor(fiscal: FilaDeFacturable['customer_fiscal']): PortalRecipientInput | null {
  if (fiscal === null) {
    return null;
  }
  return {
    rfc: fiscal.rfc ?? '',
    name: fiscal.name ?? '',
    fiscalZip: fiscal.fiscalZip ?? '',
    regime: fiscal.regime ?? '',
    cfdiUse: fiscal.cfdiUse ?? '',
  };
}

type Cuerpo = Record<string, unknown>;

function camposInvalidos(cuerpo: Cuerpo): readonly string[] | null {
  return Array.isArray(cuerpo.fields)
    ? cuerpo.fields.filter((f): f is string => typeof f === 'string')
    : null;
}

function aResultadoDeEmision(estado: number, cuerpo: Cuerpo): AdminIssueResult {
  const factura = cuerpo.invoice as { folio?: unknown; uuid?: unknown } | undefined;
  if (
    estado === 200 &&
    factura !== undefined &&
    typeof factura.folio === 'string' &&
    typeof factura.uuid === 'string'
  ) {
    return { kind: 'STAMPED', folio: factura.folio, uuid: factura.uuid };
  }
  switch (estado) {
    case 202:
      return { kind: 'IN_PROCESS' };
    case 401:
    case 403:
      return { kind: 'NOT_AUTHORIZED' };
    case 404:
      return { kind: 'NOT_FOUND' };
    case 422:
      return { kind: 'REJECTED' };
    case 400: {
      const campos = camposInvalidos(cuerpo);
      return campos === null ? { kind: 'UNAVAILABLE' } : { kind: 'INVALID', fields: campos };
    }
    case 409:
      if (cuerpo.error === 'PAYMENT_FORM_REQUIRED') {
        return { kind: 'PAYMENT_FORM_REQUIRED' };
      }
      if (cuerpo.error === 'DEPOSIT_TREATMENT_UNSUPPORTED') {
        return { kind: 'DEPOSIT_TREATMENT_UNSUPPORTED' };
      }
      if (cuerpo.error === 'NOT_BILLABLE') {
        return { kind: 'NOT_BILLABLE' };
      }
      return typeof cuerpo.reason === 'string'
        ? { kind: 'INELIGIBLE', reason: cuerpo.reason }
        : { kind: 'UNAVAILABLE' };
    default:
      return { kind: 'UNAVAILABLE' };
  }
}

function aResultadoDeReintento(estado: number, cuerpo: Cuerpo): AdminRetryResult {
  const factura = cuerpo.invoice as { folio?: unknown } | undefined;
  if (estado === 200 && factura !== undefined && typeof factura.folio === 'string') {
    return { kind: 'STAMPED', folio: factura.folio };
  }
  switch (estado) {
    case 202:
      return { kind: 'IN_PROCESS' };
    case 401:
    case 403:
      return { kind: 'NOT_AUTHORIZED' };
    case 404:
      return { kind: 'NOT_FOUND' };
    case 422:
      return { kind: 'REJECTED' };
    default:
      return { kind: 'UNAVAILABLE' };
  }
}

function aResultadoDeCancelacion(estado: number, cuerpo: Cuerpo): AdminCancelResult {
  switch (estado) {
    case 200:
      return cuerpo.status === 'CANCELLED' ? { kind: 'CANCELLED' } : { kind: 'UNAVAILABLE' };
    case 202:
      return { kind: 'CANCELLATION_PENDING' };
    case 401:
    case 403:
      return { kind: 'NOT_AUTHORIZED' };
    case 404:
      return { kind: 'NOT_FOUND' };
    case 409:
      return { kind: 'NOT_CANCELLABLE' };
    case 422:
      return { kind: 'REJECTED' };
    case 400: {
      const campos = camposInvalidos(cuerpo);
      return campos === null ? { kind: 'UNAVAILABLE' } : { kind: 'INVALID', fields: campos };
    }
    default:
      return { kind: 'UNAVAILABLE' };
  }
}

/** Adaptador de la pantalla de facturas del administrador sobre Supabase: lo que se ve sale de funciones de la
 *  base que solo ven los administradores; emitir, reintentar y cancelar llaman a funciones de servidor con el
 *  token de su sesión, y los archivos se leen de `invoice_requests`, que solo leen los administradores [S4-16,
 *  S4-20 a S4-22, ADR-0032, ADR-0033]. */
export function supabaseAdminInvoices(
  cliente: SupabaseClient,
  opciones: SupabaseAdminInvoicesOptions,
): AdminInvoices {
  const peticion = opciones.fetchImpl ?? fetch;

  /** Llama a una función de servidor con el token del administrador. `null` si no hay sesión; `'NO_NETWORK'` si no
   *  hay red; si no, el estado y el cuerpo de la respuesta (vacío si no era JSON). */
  async function llamar(
    funcion: string,
    cuerpo: unknown,
  ): Promise<{ estado: number; cuerpo: Cuerpo } | 'NO_SESSION' | 'NO_NETWORK'> {
    const sesion = await cliente.auth.getSession();
    const token = sesion.data.session?.access_token;
    if (token === undefined) {
      return 'NO_SESSION';
    }
    let respuesta: Response;
    try {
      respuesta = await peticion(`${opciones.url}/functions/v1/${funcion}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: opciones.anonKey,
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cuerpo),
      });
    } catch {
      return 'NO_NETWORK';
    }
    try {
      return { estado: respuesta.status, cuerpo: (await respuesta.json()) as Cuerpo };
    } catch {
      return { estado: respuesta.status, cuerpo: {} };
    }
  }

  return {
    async candidates() {
      const r = await cliente.rpc('admin_invoice_candidates');
      if (r.error !== null) {
        return null;
      }
      return (r.data as FilaDeFacturable[]).map((f): InvoiceCandidate => ({
        sourceType: f.source_type,
        sourceId: f.source_id,
        folio: f.folio,
        customerName: f.customer_name,
        customerFiscal: aReceptor(f.customer_fiscal),
        totalCents: f.total_cents,
        settledAt: f.settled_at,
      }));
    },

    async issue(entrada) {
      const r = await llamar('facturar', {
        source: entrada.source,
        requestId: entrada.requestId,
        recipient: entrada.recipient,
        ...(entrada.paymentForm === undefined ? {} : { paymentForm: entrada.paymentForm }),
      });
      if (r === 'NO_SESSION') {
        return { kind: 'NOT_AUTHORIZED' };
      }
      return r === 'NO_NETWORK' ? { kind: 'NO_NETWORK' } : aResultadoDeEmision(r.estado, r.cuerpo);
    },

    async list() {
      const r = await cliente.rpc('admin_invoice_list');
      if (r.error !== null) {
        return null;
      }
      return (r.data as FilaDeFactura[]).map((f): IssuedInvoice => ({
        requestId: f.request_id,
        status: f.status,
        folio: f.invoice_folio,
        channel: f.channel,
        sourceType: f.source_type,
        sourceFolio: f.source_folio,
        customerName: f.customer_name,
        totalCents: f.total_cents,
        stampedAt: f.stamped_at,
        createdAt: f.created_at,
        attempts: f.attempts,
        lastError: f.last_error,
        cancelMotive: f.cancel_motive,
        cancellationRequested: f.cancel_requested_at !== null && f.cancelled_at === null,
        cancelledAt: f.cancelled_at,
      }));
    },

    async retry(requestId) {
      const r = await llamar('reintentar-facturas', { requestId });
      if (r === 'NO_SESSION') {
        return { kind: 'NOT_AUTHORIZED' };
      }
      return r === 'NO_NETWORK'
        ? { kind: 'NO_NETWORK' }
        : aResultadoDeReintento(r.estado, r.cuerpo);
    },

    async cancel(entrada) {
      const r = await llamar('cancelar-factura', {
        folio: entrada.folio,
        motive: entrada.motive,
        ...(entrada.substituteFolio === undefined
          ? {}
          : { substituteFolio: entrada.substituteFolio }),
      });
      if (r === 'NO_SESSION') {
        return { kind: 'NOT_AUTHORIZED' };
      }
      return r === 'NO_NETWORK'
        ? { kind: 'NO_NETWORK' }
        : aResultadoDeCancelacion(r.estado, r.cuerpo);
    },

    async usage() {
      const r = await cliente.rpc('admin_stamp_usage');
      const fila = (r.data as FilaDeTimbres[] | null)?.[0];
      if (r.error !== null || fila === undefined) {
        return null;
      }
      return evaluateStampUsage({
        used: fila.used,
        limit: fila.yearly_limit,
        warningPercent: fila.warning_percent,
      });
    },

    async customerInvoices(customerId) {
      const r = await cliente.rpc('admin_customer_invoices', { p_customer_id: customerId });
      if (r.error !== null) {
        return null;
      }
      return (r.data as FilaDeFacturaDelCliente[]).map((f): CustomerInvoice => ({
        folio: f.invoice_folio,
        status: f.status,
        sourceType: f.source_type,
        sourceFolio: f.source_folio,
        totalCents: f.total_cents,
        stampedAt: f.stamped_at,
      }));
    },

    async files(folio): Promise<AdminInvoiceFiles | null> {
      const r = await cliente
        .from('invoice_requests')
        .select('invoice_folio, xml, pdf_base64')
        .eq('invoice_folio', folio)
        .eq('status', 'STAMPED')
        .maybeSingle<FilaDeArchivos>();
      const fila = r.data;
      if (r.error !== null || fila === null) {
        return null;
      }
      return { folio: fila.invoice_folio, xml: fila.xml, pdfBase64: fila.pdf_base64 };
    },
  };
}
