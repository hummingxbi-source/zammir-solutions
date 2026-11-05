import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminInvoiceFiles,
  AdminInvoices,
  AdminIssueResult,
  InvoiceCandidate,
  PortalRecipientInput,
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

interface FilaDeArchivos {
  readonly invoice_folio: string;
  readonly xml: string;
  readonly pdf_base64: string;
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

function aResultado(estado: number, cuerpo: Record<string, unknown>): AdminIssueResult {
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
    case 400:
      return Array.isArray(cuerpo.fields)
        ? {
            kind: 'INVALID',
            fields: cuerpo.fields.filter((f): f is string => typeof f === 'string'),
          }
        : { kind: 'UNAVAILABLE' };
    case 409:
      if (cuerpo.error === 'PAYMENT_FORM_REQUIRED') {
        return { kind: 'PAYMENT_FORM_REQUIRED' };
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

/** Adaptador de la pantalla de facturas del administrador sobre Supabase: lo facturable sale de una función de la
 *  base que solo ven los administradores; emitir llama a la función de servidor `facturar` con el token de su
 *  sesión, y los archivos se leen de `invoice_requests`, que solo leen los administradores [S4-16, ADR-0032]. */
export function supabaseAdminInvoices(
  cliente: SupabaseClient,
  opciones: SupabaseAdminInvoicesOptions,
): AdminInvoices {
  const peticion = opciones.fetchImpl ?? fetch;
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
      const sesion = await cliente.auth.getSession();
      const token = sesion.data.session?.access_token;
      if (token === undefined) {
        return { kind: 'NOT_AUTHORIZED' };
      }
      let respuesta: Response;
      try {
        respuesta = await peticion(`${opciones.url}/functions/v1/facturar`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: opciones.anonKey,
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            source: entrada.source,
            requestId: entrada.requestId,
            recipient: entrada.recipient,
            ...(entrada.paymentForm === undefined ? {} : { paymentForm: entrada.paymentForm }),
          }),
        });
      } catch {
        return { kind: 'NO_NETWORK' };
      }
      try {
        return aResultado(respuesta.status, (await respuesta.json()) as Record<string, unknown>);
      } catch {
        return { kind: 'UNAVAILABLE' };
      }
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
