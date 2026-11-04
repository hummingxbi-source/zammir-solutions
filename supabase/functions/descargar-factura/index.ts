// S4-19 · Descargar el PDF o el XML de la factura emitida desde el portal [RF-M10-14, ADR-0030].
// Misma puerta que la consulta: solo entrega los archivos a quien tiene el folio y el código del ticket, y
// responde igual si no cuadran o si todavía no hay factura. Devuelve JSON con el contenido (el XML como texto y
// el PDF en base64) para que la página arme la descarga. La lógica vive en el núcleo (`downloadPortalInvoice`).
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { downloadPortalInvoice } from '../_shared/core.mjs';
import {
  almacenDeArchivos,
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
  if (cuerpo === null || (cuerpo.format !== 'xml' && cuerpo.format !== 'pdf')) {
    return responder(400, { error: 'INVALID_INPUT' });
  }

  const servicio = clienteDeServicio();
  const resultado = await downloadPortalInvoice(
    { ...dependenciasDelPortal(servicio), files: almacenDeArchivos(servicio) },
    entradaDelPortal(req, cuerpo),
    cuerpo.format,
  );

  switch (resultado.kind) {
    case 'FILE':
      return responder(200, {
        filename: resultado.filename,
        contentType: resultado.contentType,
        encoding: resultado.encoding,
        content: resultado.content,
      });
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
