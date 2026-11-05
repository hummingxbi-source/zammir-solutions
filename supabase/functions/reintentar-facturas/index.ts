// S4-20 · Reintentar las solicitudes de factura que quedaron "en proceso" [RF-M10-15, RN-24, ADR-0033].
// Si el PAC no respondió, la solicitud se reintenta con el MISMO identificador y nunca duplica el timbre. Dos modos:
//   · Pasada automática: se llama con la llave de servicio (la programa el servidor cada pocos minutos).
//   · A petición de un administrador con sesión, sobre una solicitud en particular (`requestId`).
// La lógica vive en el núcleo (`retryPendingInvoices` y `retryInvoice`).
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { servir } from '../_shared/errores.ts';
import {
  DEFAULT_RETRY_POLICY,
  retryInvoice,
  retryPendingInvoices,
  simulatedBilling,
} from '../_shared/core.mjs';
import {
  almacenDeFacturas,
  almacenDePendientes,
  cabeceras,
  clienteDeServicio,
  proveedorDeTimbrado,
  responder,
  usuarioDeLaPeticion,
} from '../_shared/portal.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const entero = (valor: string | undefined, porOmision: number): number => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porOmision;
};

servir('reintentar-facturas', async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return responder(405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const llave = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const llaveDeServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const esServidor = llave !== '' && llave === llaveDeServicio;

  const servicio = clienteDeServicio();
  if (!esServidor) {
    const usuario = await usuarioDeLaPeticion(servicio, req);
    if (usuario === null) {
      return responder(401, { error: 'UNAUTHENTICATED' });
    }
    if (usuario.role !== 'ADMIN') {
      return responder(403, { error: 'NOT_AUTHORIZED' });
    }
  }

  const proveedor = proveedorDeTimbrado(simulatedBilling);
  if (proveedor === null) {
    return responder(503, { error: 'BILLING_NOT_CONFIGURED' });
  }
  const deps = {
    provider: proveedor,
    store: almacenDeFacturas(servicio),
    clock: { now: () => new Date() },
    pending: almacenDePendientes(servicio),
  };

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = await req.json();
  } catch {
    cuerpo = {};
  }

  // A petición de un administrador: una solicitud en particular.
  if (typeof cuerpo.requestId === 'string') {
    if (!UUID.test(cuerpo.requestId)) {
      return responder(400, { error: 'INVALID_INPUT' });
    }
    let pendiente;
    try {
      pendiente = await deps.pending.getPending(cuerpo.requestId);
    } catch {
      return responder(503, { error: 'INVOICE_UNAVAILABLE' });
    }
    if (pendiente === null) {
      return responder(404, { error: 'NOT_FOUND' });
    }
    const r = await retryInvoice(deps, pendiente);
    switch (r.kind) {
      case 'STAMPED':
        return responder(200, { invoice: { folio: r.folio, uuid: r.uuid } });
      case 'IN_PROCESS':
        return responder(202, { status: 'IN_PROCESS' });
      case 'REJECTED':
        return responder(422, { error: 'REJECTED', code: r.code });
      default:
        return responder(503, { error: 'INVOICE_UNAVAILABLE' });
    }
  }

  // Pasada automática: solo con la llave de servicio.
  if (!esServidor) {
    return responder(403, { error: 'NOT_AUTHORIZED' });
  }
  const resumen = await retryPendingInvoices(deps, {
    waitSeconds: entero(
      Deno.env.get('INVOICE_RETRY_WAIT_SECONDS'),
      DEFAULT_RETRY_POLICY.waitSeconds,
    ),
    maxAttempts: entero(
      Deno.env.get('INVOICE_RETRY_MAX_ATTEMPTS'),
      DEFAULT_RETRY_POLICY.maxAttempts,
    ),
    limit: DEFAULT_RETRY_POLICY.limit,
  });
  return responder(200, { summary: resumen });
});
