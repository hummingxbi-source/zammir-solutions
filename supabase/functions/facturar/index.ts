// S4-16 · Facturar desde el sistema una venta u orden liquidada [RF-M10-04 a RF-M10-08, RN-24, RN-25, ADR-0032].
// Es para administradores con sesión de Supabase Auth: se verifica el token y su rol en el servidor [RNF-11].
// A diferencia del portal no hay plazo de fin de mes (un administrador sí puede facturar fuera de él). La
// lógica vive en el núcleo (`issueSystemInvoice`); aquí solo se conecta HTTP con la base y el proveedor de
// timbrado, que debe pedirse con `BILLING_PROVIDER=simulated` (sin validez fiscal) o no emite nada.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { issueSystemInvoice, simulatedBilling } from '../_shared/core.mjs';
import {
  almacenDeFacturas,
  almacenDeFuentes,
  cabeceras,
  clienteDeServicio,
  proveedorDeTimbrado,
  responder,
  usuarioDeLaPeticion,
} from '../_shared/portal.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return responder(405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const servicio = clienteDeServicio();
  const usuario = await usuarioDeLaPeticion(servicio, req);
  if (usuario === null) {
    return responder(401, { error: 'UNAUTHENTICATED' });
  }
  // Solo administradores con sesión. Un cajero factura con la autorización de un administrador (S4-17), pero el
  // servidor aún no puede comprobar ese PIN: ver ADR-0032.
  if (usuario.role !== 'ADMIN') {
    return responder(403, { error: 'NOT_AUTHORIZED' });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { error: 'INVALID_INPUT' });
  }
  const origen = cuerpo.source;
  const receptor = cuerpo.recipient;
  if (
    typeof origen !== 'object' ||
    origen === null ||
    (origen.type !== 'COUNTER_SALE' && origen.type !== 'WORK_ORDER') ||
    typeof origen.id !== 'string' ||
    !UUID.test(origen.id) ||
    typeof cuerpo.requestId !== 'string' ||
    !UUID.test(cuerpo.requestId) ||
    typeof receptor !== 'object' ||
    receptor === null
  ) {
    return responder(400, { error: 'INVALID_INPUT' });
  }

  const proveedor = proveedorDeTimbrado(simulatedBilling);
  if (proveedor === null) {
    return responder(503, { error: 'BILLING_NOT_CONFIGURED' });
  }

  const resultado = await issueSystemInvoice(
    {
      sources: almacenDeFuentes(servicio),
      issue: {
        provider: proveedor,
        store: almacenDeFacturas(servicio),
        clock: { now: () => new Date() },
      },
    },
    {
      actor: { userId: usuario.userId, role: usuario.role },
      source: { type: origen.type, id: origen.id },
      requestId: cuerpo.requestId,
      recipient: {
        rfc: texto(receptor.rfc),
        name: texto(receptor.name),
        fiscalZip: texto(receptor.fiscalZip),
        regime: texto(receptor.regime),
        cfdiUse: texto(receptor.cfdiUse),
      },
      paymentForm:
        cuerpo.paymentForm === '01' || cuerpo.paymentForm === '03' ? cuerpo.paymentForm : null,
    },
  );

  switch (resultado.kind) {
    case 'STAMPED':
      return responder(200, { invoice: { folio: resultado.folio, uuid: resultado.uuid } });
    case 'IN_PROCESS':
      return responder(202, { status: 'IN_PROCESS' });
    case 'NOT_AUTHORIZED':
    case 'AUTHORIZATION_REQUIRED':
      return responder(403, { error: 'NOT_AUTHORIZED' });
    case 'NOT_FOUND':
      return responder(404, { error: 'NOT_FOUND' });
    case 'INELIGIBLE':
      return responder(409, { error: 'NOT_ELIGIBLE', reason: resultado.reason });
    case 'PAYMENT_FORM_REQUIRED':
      return responder(409, { error: 'PAYMENT_FORM_REQUIRED' });
    case 'NOT_BILLABLE':
      return responder(409, { error: 'NOT_BILLABLE', reason: resultado.reason });
    case 'INVALID':
      return responder(400, { error: 'INVALID_INPUT', fields: resultado.fields });
    case 'REJECTED':
      return responder(422, { error: 'REJECTED', code: resultado.code });
    default:
      return responder(503, { error: 'INVOICE_UNAVAILABLE' });
  }
});
