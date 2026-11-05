import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { supabaseAdminInvoices } from './supabase-admin-invoices';

interface Respuesta {
  data: unknown;
  error: unknown;
}

/** Cliente de Supabase de mentira con solo lo que usa el adaptador. */
function clienteFalso(
  opciones: {
    rpc?: Respuesta;
    fila?: Respuesta;
    token?: string | null;
  } = {},
) {
  const llamadas: { rpc: string[]; tabla: string[]; filtros: [string, unknown][] } = {
    rpc: [],
    tabla: [],
    filtros: [],
  };
  const consulta = {
    select: () => consulta,
    eq: (columna: string, valor: unknown) => {
      llamadas.filtros.push([columna, valor]);
      return consulta;
    },
    maybeSingle: () => Promise.resolve(opciones.fila ?? { data: null, error: null }),
  };
  const cliente = {
    rpc: (nombre: string) => {
      llamadas.rpc.push(nombre);
      return Promise.resolve(opciones.rpc ?? { data: [], error: null });
    },
    from: (tabla: string) => {
      llamadas.tabla.push(tabla);
      return consulta;
    },
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session:
              opciones.token === null
                ? null
                : { access_token: opciones.token ?? 'token-del-administrador' },
          },
        }),
    },
  } as unknown as SupabaseClient;
  return { cliente, llamadas };
}

function adaptador(
  cliente: SupabaseClient,
  fetchImpl: typeof fetch = () => Promise.resolve(new Response('{}', { status: 500 })),
) {
  return supabaseAdminInvoices(cliente, { url: 'https://x.invalid', anonKey: 'anon', fetchImpl });
}

const entrada = {
  source: { type: 'COUNTER_SALE' as const, id: 'venta-1' },
  requestId: '5c000000-0000-4000-8000-000000000001',
  recipient: {
    rfc: 'XAXX010101000',
    name: 'CLIENTE',
    fiscalZip: '55900',
    regime: '616',
    cfdiUse: 'G03',
  },
};

describe('lo facturable', () => {
  it('convierte las filas de la base y los datos fiscales del cliente', async () => {
    const { cliente, llamadas } = clienteFalso({
      rpc: {
        error: null,
        data: [
          {
            source_type: 'COUNTER_SALE',
            source_id: 'v1',
            folio: 'V-2026-0001',
            customer_name: 'Ana',
            customer_fiscal: {
              rfc: 'XAXX010101000',
              name: 'ANA',
              fiscalZip: '55900',
              regime: '616',
              cfdiUse: null,
            },
            total_cents: 11_600,
            settled_at: '2026-11-03T18:00:00Z',
          },
          {
            source_type: 'WORK_ORDER',
            source_id: 'o1',
            folio: 'OT-2026-0001',
            customer_name: null,
            customer_fiscal: null,
            total_cents: 100,
            settled_at: null,
          },
        ],
      },
    });
    const lista = await adaptador(cliente).candidates();
    expect(llamadas.rpc).toEqual(['admin_invoice_candidates']);
    expect(lista).toEqual([
      {
        sourceType: 'COUNTER_SALE',
        sourceId: 'v1',
        folio: 'V-2026-0001',
        customerName: 'Ana',
        customerFiscal: {
          rfc: 'XAXX010101000',
          name: 'ANA',
          fiscalZip: '55900',
          regime: '616',
          cfdiUse: '',
        },
        totalCents: 11_600,
        settledAt: '2026-11-03T18:00:00Z',
      },
      {
        sourceType: 'WORK_ORDER',
        sourceId: 'o1',
        folio: 'OT-2026-0001',
        customerName: null,
        customerFiscal: null,
        totalCents: 100,
        settledAt: null,
      },
    ]);
  });

  it('si la base responde con error no hay lista', async () => {
    const { cliente } = clienteFalso({ rpc: { data: null, error: { code: '42501' } } });
    expect(await adaptador(cliente).candidates()).toBeNull();
  });
});

describe('emitir', () => {
  it('manda la solicitud a la función con el token de la sesión del administrador', async () => {
    const vistos: { url: string; auth: string; cuerpo: unknown }[] = [];
    const { cliente } = clienteFalso();
    const emitir = adaptador(cliente, (url, init) => {
      vistos.push({
        url: url instanceof Request ? url.url : url.toString(),
        auth: new Headers(init?.headers).get('authorization') ?? '',
        cuerpo: JSON.parse(typeof init?.body === 'string' ? init.body : '{}'),
      });
      return Promise.resolve(
        new Response(JSON.stringify({ invoice: { folio: 'F-2026-0001', uuid: 'u' } })),
      );
    });
    const r = await emitir.issue({ ...entrada, paymentForm: '03' });
    expect(r).toEqual({ kind: 'STAMPED', folio: 'F-2026-0001', uuid: 'u' });
    expect(vistos[0]?.url).toBe('https://x.invalid/functions/v1/facturar');
    expect(vistos[0]?.auth).toBe('Bearer token-del-administrador');
    expect(vistos[0]?.cuerpo).toEqual({
      source: entrada.source,
      requestId: entrada.requestId,
      recipient: entrada.recipient,
      paymentForm: '03',
    });
  });

  it('sin forma de pago elegida no la manda', async () => {
    let cuerpo: Record<string, unknown> = {};
    const { cliente } = clienteFalso();
    await adaptador(cliente, (_url, init) => {
      cuerpo = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
        string,
        unknown
      >;
      return Promise.resolve(new Response('{}', { status: 404 }));
    }).issue(entrada);
    expect('paymentForm' in cuerpo).toBe(false);
  });

  it('sin sesión no llama a la función', async () => {
    let llamadas = 0;
    const { cliente } = clienteFalso({ token: null });
    const r = await adaptador(cliente, () => {
      llamadas += 1;
      return Promise.resolve(new Response('{}'));
    }).issue(entrada);
    expect(r).toEqual({ kind: 'NOT_AUTHORIZED' });
    expect(llamadas).toBe(0);
  });

  it('cada respuesta de la función se traduce a su resultado', async () => {
    const caso = async (estado: number, cuerpo: unknown) => {
      const { cliente } = clienteFalso();
      return adaptador(cliente, () =>
        Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado })),
      ).issue(entrada);
    };
    expect(await caso(202, { status: 'IN_PROCESS' })).toEqual({ kind: 'IN_PROCESS' });
    expect(await caso(401, {})).toEqual({ kind: 'NOT_AUTHORIZED' });
    expect(await caso(403, { error: 'NOT_AUTHORIZED' })).toEqual({ kind: 'NOT_AUTHORIZED' });
    expect(await caso(404, {})).toEqual({ kind: 'NOT_FOUND' });
    expect(await caso(422, { error: 'REJECTED' })).toEqual({ kind: 'REJECTED' });
    expect(await caso(400, { fields: ['recipient.rfc', 3] })).toEqual({
      kind: 'INVALID',
      fields: ['recipient.rfc'],
    });
    expect(await caso(400, {})).toEqual({ kind: 'UNAVAILABLE' });
    expect(await caso(409, { error: 'PAYMENT_FORM_REQUIRED' })).toEqual({
      kind: 'PAYMENT_FORM_REQUIRED',
    });
    expect(await caso(409, { error: 'NOT_BILLABLE', reason: 'FISCAL_DATA_MISSING' })).toEqual({
      kind: 'NOT_BILLABLE',
    });
    expect(await caso(409, { error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' })).toEqual({
      kind: 'INELIGIBLE',
      reason: 'ALREADY_INVOICED',
    });
    expect(await caso(409, {})).toEqual({ kind: 'UNAVAILABLE' });
    expect(await caso(503, {})).toEqual({ kind: 'UNAVAILABLE' });
    expect(await caso(200, {})).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('sin red lo dice aparte y una respuesta que no es JSON no se toma por acierto', async () => {
    const { cliente } = clienteFalso();
    expect(
      await adaptador(cliente, () => Promise.reject(new TypeError('Failed to fetch'))).issue(
        entrada,
      ),
    ).toEqual({ kind: 'NO_NETWORK' });
    expect(
      await adaptador(cliente, () =>
        Promise.resolve(new Response('<html>', { status: 200 })),
      ).issue(entrada),
    ).toEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('archivos de la factura', () => {
  it('lee el XML y el PDF de la factura vigente por su folio', async () => {
    const { cliente, llamadas } = clienteFalso({
      fila: {
        error: null,
        data: { invoice_folio: 'F-2026-0001', xml: '<cfdi/>', pdf_base64: 'cGRm' },
      },
    });
    const archivos = await adaptador(cliente).files('F-2026-0001');
    expect(archivos).toEqual({ folio: 'F-2026-0001', xml: '<cfdi/>', pdfBase64: 'cGRm' });
    expect(llamadas.tabla).toEqual(['invoice_requests']);
    expect(llamadas.filtros).toEqual([
      ['invoice_folio', 'F-2026-0001'],
      ['status', 'STAMPED'],
    ]);
  });

  it('si no existe o no se pudo leer, no hay archivos', async () => {
    expect(await adaptador(clienteFalso().cliente).files('F-2026-0099')).toBeNull();
    const conError = clienteFalso({ fila: { data: null, error: { code: '42501' } } });
    expect(await adaptador(conError.cliente).files('F-2026-0001')).toBeNull();
  });
});
