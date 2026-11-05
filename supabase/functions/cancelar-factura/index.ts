// S4-21 · Cancelar una factura con los motivos del SAT [RF-M10-19, RN-18, RN-19, RN-28, ADR-0033].
// Solo para administradores con sesión: se verifica el token y su rol en el servidor [RNF-11]. Un cajero no
// cancela, ni con autorización. La cancelación queda en la bitácora con quién y por qué; nada se borra. La lógica
// vive en el núcleo (`cancelInvoice`); el proveedor de timbrado se pide con `BILLING_PROVIDER=simulated`.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { cancelInvoice, simulatedBilling } from '../_shared/core.mjs';
import {
  almacenDeCancelaciones,
  cabeceras,
  clienteDeServicio,
  proveedorDeTimbrado,
  responder,
  usuarioDeLaPeticion,
} from '../_shared/portal.ts';

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
  if (usuario.role !== 'ADMIN') {
    return responder(403, { error: 'NOT_AUTHORIZED' });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { error: 'INVALID_INPUT' });
  }
  if (typeof cuerpo.folio !== 'string' || typeof cuerpo.motive !== 'string') {
    return responder(400, { error: 'INVALID_INPUT' });
  }

  const proveedor = proveedorDeTimbrado(simulatedBilling);
  if (proveedor === null) {
    return responder(503, { error: 'BILLING_NOT_CONFIGURED' });
  }

  const resultado = await cancelInvoice(
    { provider: proveedor, store: almacenDeCancelaciones(servicio) },
    {
      actor: { userId: usuario.userId, role: usuario.role },
      folio: cuerpo.folio,
      motive: cuerpo.motive,
      substituteFolio: typeof cuerpo.substituteFolio === 'string' ? cuerpo.substituteFolio : null,
    },
  );

  switch (resultado.kind) {
    case 'CANCELLED':
      return responder(200, { status: 'CANCELLED' });
    case 'CANCELLATION_PENDING':
      return responder(202, { status: 'CANCELLATION_PENDING' });
    case 'NOT_AUTHORIZED':
      return responder(403, { error: 'NOT_AUTHORIZED' });
    case 'NOT_FOUND':
      return responder(404, { error: 'NOT_FOUND' });
    case 'NOT_CANCELLABLE':
      return responder(409, { error: 'NOT_CANCELLABLE' });
    case 'INVALID':
      return responder(400, { error: 'INVALID_INPUT', fields: resultado.fields });
    case 'REJECTED':
      return responder(422, { error: 'REJECTED', code: resultado.code });
    default:
      return responder(503, { error: 'INVOICE_UNAVAILABLE' });
  }
});
