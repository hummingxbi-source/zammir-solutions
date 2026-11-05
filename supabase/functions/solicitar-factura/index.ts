// S4-19 · Pedir la factura desde el portal público [RF-M10-10, RF-M10-13, RF-M10-14, RN-24, ADR-0030].
// Pasa por la misma puerta que la consulta (folio y código, límites de intentos y automatización) y, además,
// exige la casilla del aviso de privacidad, valida los datos fiscales y emite la factura con el proveedor de
// timbrado. Todo se decide aquí aunque la pantalla ya lo haya validado [RNF-11]. Sin `BILLING_PROVIDER` no
// emite nada. La lógica vive en el núcleo (`requestPortalInvoice`).
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { servir } from '../_shared/errores.ts';
import { requestPortalInvoice, simulatedBilling } from '../_shared/core.mjs';
import {
  ajusteDeAnticipos,
  almacenDeFacturas,
  cabeceras,
  clienteDeServicio,
  dependenciasDelPortal,
  entradaDelPortal,
  leerCuerpo,
  proveedorDeTimbrado,
  responder,
} from '../_shared/portal.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

servir('solicitar-factura', async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return responder(405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const cuerpo = await leerCuerpo(req);
  const receptor = cuerpo?.recipient;
  if (
    cuerpo === null ||
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

  const servicio = clienteDeServicio();
  const base = dependenciasDelPortal(servicio);
  const resultado = await requestPortalInvoice(
    {
      ...base,
      issue: { provider: proveedor, store: almacenDeFacturas(servicio), clock: base.clock },
      depositTreatment: await ajusteDeAnticipos(servicio),
    },
    {
      ...entradaDelPortal(req, cuerpo),
      requestId: cuerpo.requestId,
      acceptedPrivacy: cuerpo.acceptedPrivacy === true,
      recipient: {
        rfc: texto(receptor.rfc),
        name: texto(receptor.name),
        fiscalZip: texto(receptor.fiscalZip),
        regime: texto(receptor.regime),
        cfdiUse: texto(receptor.cfdiUse),
      },
    },
  );

  switch (resultado.kind) {
    case 'STAMPED':
      return responder(200, { invoice: { folio: resultado.folio, uuid: resultado.uuid } });
    case 'IN_PROCESS':
      return responder(202, { status: 'IN_PROCESS' });
    case 'PRIVACY_NOT_ACCEPTED':
      return responder(400, { error: 'PRIVACY_NOT_ACCEPTED' });
    case 'INVALID':
      return responder(400, { error: 'INVALID_INPUT', fields: resultado.fields });
    case 'PAYMENT_FORM_UNDEFINED':
      return responder(409, { error: 'PAYMENT_FORM_UNDEFINED' });
    case 'DEPOSIT_TREATMENT_UNSUPPORTED':
      return responder(409, { error: 'DEPOSIT_TREATMENT_UNSUPPORTED' });
    case 'NOT_BILLABLE':
      return responder(409, { error: 'NOT_BILLABLE', reason: resultado.reason });
    case 'INELIGIBLE':
      return responder(409, { error: 'NOT_ELIGIBLE', reason: resultado.reason });
    case 'ALREADY_INVOICED':
      return responder(409, { error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' });
    case 'REJECTED':
      return responder(422, { error: 'REJECTED', code: resultado.code });
    case 'NOT_AVAILABLE':
      return responder(404, { error: 'NOT_AVAILABLE' });
    case 'BLOCKED':
      return responder(
        429,
        { error: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: resultado.retryAfterSeconds },
        { 'retry-after': String(resultado.retryAfterSeconds) },
      );
    default:
      return responder(503, { error: 'PORTAL_UNAVAILABLE' });
  }
});
