// S4-18 · Portal público de autofacturación: consulta de una venta u orden con su folio y código [RF-M10-09
// a RF-M10-12, RNF-12, ADR-0030].
// Es público (sin JWT): lo abre cualquiera con el QR de su ticket. La seguridad no es la sesión sino que
// (1) solo responde datos si el folio y el código cuadran, (2) responde siempre igual cuando no cuadran,
// (3) limita los intentos por IP y por folio y (4) frena a los programas. Toda la lógica vive en el núcleo
// (`lookupInvoiceDocument`); este archivo solo conecta HTTP con las piezas comunes de `_shared/portal.ts`.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { lookupInvoiceDocument } from '../_shared/core.mjs';
import {
  cabeceras,
  clienteDeServicio,
  dependenciasDelPortal,
  entradaDelPortal,
  leerCuerpo,
  responder,
} from '../_shared/portal.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return responder(405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const cuerpo = await leerCuerpo(req);
  if (cuerpo === null) {
    return responder(400, { error: 'INVALID_INPUT' });
  }

  const resultado = await lookupInvoiceDocument(
    dependenciasDelPortal(clienteDeServicio()),
    entradaDelPortal(req, cuerpo),
  );

  switch (resultado.kind) {
    case 'OK':
      return responder(200, { document: resultado.document });
    case 'NOT_AVAILABLE':
      return responder(404, { error: 'NOT_AVAILABLE' });
    case 'BLOCKED':
      return responder(
        429,
        { error: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: resultado.retryAfterSeconds },
        { 'retry-after': String(resultado.retryAfterSeconds) },
      );
    case 'INELIGIBLE':
      return responder(409, { error: 'NOT_ELIGIBLE', reason: resultado.reason });
    default:
      return responder(503, { error: 'PORTAL_UNAVAILABLE' });
  }
});
