import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { MIN_HUMAN_FILL_MS } from '../domain/automation-signals';
import { DEFAULT_RATE_LIMIT } from '../domain/self-invoicing';
import {
  lookupInvoiceDocument,
  type PortalDocumentRecord,
  type PortalLookupDeps,
  type PortalLookupInput,
  type PortalStore,
} from './portal-lookup';

const AHORA = new Date('2026-11-20T18:00:00.000Z');

const venta: PortalDocumentRecord = {
  id: 'venta-1',
  type: 'COUNTER_SALE',
  folio: 'V-2026-0001',
  cancelled: false,
  totalCents: 11_600,
  paidCents: 11_600,
  settledAt: '2026-11-03T18:00:00.000Z',
  invoiced: false,
  lines: [{ name: 'Chapa', quantity: 1, lineTotalCents: 11_600 }],
};

interface Almacen extends PortalStore {
  readonly fallos: { kind: 'IP' | 'FOLIO'; key: string }[];
  readonly busquedas: string[];
}

/** Almacén en memoria: un documento por código y los fallos recordados por huella. */
function almacen(documentos: Record<string, PortalDocumentRecord> = { BBBBBBBB: venta }): Almacen {
  const fallos: Almacen['fallos'] = [];
  const busquedas: string[] = [];
  return {
    fallos,
    busquedas,
    findDocument(folio, code) {
      busquedas.push(`${folio}|${code}`);
      const d = documentos[code];
      return Promise.resolve(d?.folio === folio ? d : null);
    },
    failureCounts(ipHash, folioHash) {
      return Promise.resolve({
        ip: fallos.filter((f) => f.kind === 'IP' && f.key === ipHash).length,
        folio: fallos.filter((f) => f.kind === 'FOLIO' && f.key === folioHash).length,
      });
    },
    recordFailure(ipHash, folioHash) {
      fallos.push({ kind: 'IP', key: ipHash }, { kind: 'FOLIO', key: folioHash });
      return Promise.resolve();
    },
  };
}

const hash = (texto: string): Promise<string> => Promise.resolve(`h(${texto})`);

function armar(
  store: PortalStore = almacen(),
  verifyHuman: PortalLookupDeps['verifyHuman'] = () => Promise.resolve(true),
) {
  return {
    store,
    clock: fixedClock(AHORA),
    hash,
    verifyHuman,
  };
}

const bien: PortalLookupInput = {
  folio: 'V-2026-0001',
  code: 'BBBBBBBB',
  ip: '203.0.113.7',
  honeypot: '',
  elapsedMs: 10_000,
};

describe('consulta del portal de autofacturación', () => {
  it('con folio y código correctos, liquidada, sin facturar y en plazo, muestra conceptos y total', async () => {
    const r = await lookupInvoiceDocument(armar(), bien);
    expect(r).toEqual({
      kind: 'OK',
      document: {
        type: 'COUNTER_SALE',
        folio: 'V-2026-0001',
        totalCents: 11_600,
        lines: [{ name: 'Chapa', quantity: 1, lineTotalCents: 11_600 }],
        deadline: '2026-11-30',
      },
    });
  });

  it('acepta el folio y el código tecleados a mano, con minúsculas, espacios y guion', async () => {
    const r = await lookupInvoiceDocument(armar(), {
      ...bien,
      folio: ' v-2026-0001 ',
      code: 'bbbb-bbbb',
    });
    expect(r.kind).toBe('OK');
  });

  it('un código incorrecto y un folio que no existe responden exactamente lo mismo', async () => {
    const store = almacen();
    const codigoMalo = await lookupInvoiceDocument(armar(store), { ...bien, code: 'CCCCCCCC' });
    const folioInexistente = await lookupInvoiceDocument(armar(store), {
      ...bien,
      folio: 'V-2026-0999',
    });
    expect(codigoMalo).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(folioInexistente).toEqual(codigoMalo);
  });

  it('un código que es de otro documento no revela el documento', async () => {
    const otra: PortalDocumentRecord = { ...venta, id: 'venta-2', folio: 'V-2026-0002' };
    const store = almacen({ BBBBBBBB: venta, DDDDDDDD: otra });
    const r = await lookupInvoiceDocument(armar(store), { ...bien, code: 'DDDDDDDD' });
    expect(r).toEqual({ kind: 'NOT_AVAILABLE' });
  });

  it('un formato inválido responde igual y ni siquiera consulta la base de documentos', async () => {
    const store = almacen();
    const r = await lookupInvoiceDocument(armar(store), { ...bien, folio: 'COT-2026-0001' });
    expect(r).toEqual({ kind: 'NOT_AVAILABLE' });
    const r2 = await lookupInvoiceDocument(armar(store), { ...bien, code: '1234' });
    expect(r2).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(store.busquedas).toEqual([]);
  });

  it('cada intento fallido se cuenta contra la IP y contra el folio escrito', async () => {
    const store = almacen();
    await lookupInvoiceDocument(armar(store), { ...bien, code: 'CCCCCCCC' });
    expect(store.fallos).toEqual([
      { kind: 'IP', key: 'h(ip:203.0.113.7)' },
      { kind: 'FOLIO', key: 'h(folio:V-2026-0001)' },
    ]);
  });

  it('un acierto no cuenta como fallo', async () => {
    const store = almacen();
    await lookupInvoiceDocument(armar(store), bien);
    expect(store.fallos).toEqual([]);
  });

  it('al llegar al tope de fallos de un folio lo bloquea, incluso con el código correcto', async () => {
    const store = almacen();
    for (let i = 0; i < DEFAULT_RATE_LIMIT.maxFailuresPerFolio; i += 1) {
      await lookupInvoiceDocument(armar(store), {
        ...bien,
        code: 'CCCCCCCC',
        ip: `198.51.100.${String(i)}`,
      });
    }
    const r = await lookupInvoiceDocument(armar(store), { ...bien, ip: '192.0.2.1' });
    expect(r).toEqual({ kind: 'BLOCKED', retryAfterSeconds: 900 });
    expect(store.busquedas).toHaveLength(DEFAULT_RATE_LIMIT.maxFailuresPerFolio);
  });

  it('al llegar al tope de fallos de una IP la bloquea, aunque cambie de folio', async () => {
    const store = almacen();
    for (let i = 0; i < DEFAULT_RATE_LIMIT.maxFailuresPerIp; i += 1) {
      await lookupInvoiceDocument(armar(store), {
        ...bien,
        folio: `V-2026-${String(1000 + i)}`,
        code: 'CCCCCCCC',
      });
    }
    const r = await lookupInvoiceDocument(armar(store), { ...bien, folio: 'V-2026-4000' });
    expect(r.kind).toBe('BLOCKED');
  });

  it('el campo trampa lleno frena al programa sin tocar los documentos y cuenta como fallo', async () => {
    const store = almacen();
    const r = await lookupInvoiceDocument(armar(store), { ...bien, honeypot: 'http://spam' });
    expect(r).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(store.busquedas).toEqual([]);
    expect(store.fallos).toHaveLength(2);
  });

  it('enviar demasiado rápido o sin tiempo frena al programa', async () => {
    const store = almacen();
    expect(
      await lookupInvoiceDocument(armar(store), { ...bien, elapsedMs: MIN_HUMAN_FILL_MS - 1 }),
    ).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(await lookupInvoiceDocument(armar(store), { ...bien, elapsedMs: null })).toEqual({
      kind: 'NOT_AVAILABLE',
    });
    expect(store.busquedas).toEqual([]);
  });

  it('la verificación del servicio externo se hace con el token y la IP, y si falla se frena', async () => {
    const vistos: [string | null, string][] = [];
    const store = almacen();
    const rechaza = (token: string | null, ip: string): Promise<boolean> => {
      vistos.push([token, ip]);
      return Promise.resolve(false);
    };
    const r = await lookupInvoiceDocument(armar(store, rechaza), {
      ...bien,
      humanToken: 'tok-123',
    });
    expect(r).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(vistos).toEqual([['tok-123', '203.0.113.7']]);
    expect(store.busquedas).toEqual([]);
    await lookupInvoiceDocument(armar(store, rechaza), bien);
    expect(vistos[1]).toEqual([null, '203.0.113.7']);
  });

  it('con el código correcto pero sin poder facturar, dice por qué (quien llama tiene el ticket)', async () => {
    const casos: [Partial<PortalDocumentRecord>, string][] = [
      [{ cancelled: true }, 'CANCELLED'],
      [{ invoiced: true }, 'ALREADY_INVOICED'],
      [{ paidCents: 5_000, settledAt: null }, 'NOT_SETTLED'],
      [{ settledAt: '2026-10-03T18:00:00.000Z' }, 'EXPIRED'],
    ];
    for (const [cambios, razon] of casos) {
      const store = almacen({ BBBBBBBB: { ...venta, ...cambios } });
      const r = await lookupInvoiceDocument(armar(store), bien);
      expect(r).toEqual({ kind: 'INELIGIBLE', reason: razon });
      expect(store.fallos).toEqual([]);
    }
  });

  it('si la base falla responde que no está disponible, sin detalles', async () => {
    const roto: PortalStore = {
      findDocument: () => Promise.reject(new Error('conexión caída')),
      failureCounts: () => Promise.resolve({ ip: 0, folio: 0 }),
      recordFailure: () => Promise.resolve(),
    };
    expect(await lookupInvoiceDocument(armar(roto), bien)).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('respeta la política de límites que se le dé', async () => {
    const store = almacen();
    const deps = {
      ...armar(store),
      rateLimit: { windowSeconds: 60, maxFailuresPerIp: 99, maxFailuresPerFolio: 1 },
    };
    await lookupInvoiceDocument(deps, { ...bien, code: 'CCCCCCCC' });
    expect(await lookupInvoiceDocument(deps, bien)).toEqual({
      kind: 'BLOCKED',
      retryAfterSeconds: 60,
    });
  });

  it('el folio mal escrito cuenta igual con o sin espacios alrededor', async () => {
    const store = almacen();
    await lookupInvoiceDocument(armar(store), { ...bien, folio: '  hola  ', code: 'CCCCCCCC' });
    await lookupInvoiceDocument(armar(store), { ...bien, folio: 'HOLA', code: 'CCCCCCCC' });
    const claves = store.fallos.filter((f) => f.kind === 'FOLIO').map((f) => f.key);
    expect(claves).toEqual(['h(folio:HOLA)', 'h(folio:HOLA)']);
  });

  it('un folio muy largo se acota antes de convertirse en huella', async () => {
    const store = almacen();
    await lookupInvoiceDocument(armar(store), {
      ...bien,
      folio: 'x'.repeat(500),
      code: 'CCCCCCCC',
    });
    const folioKey = store.fallos.find((f) => f.kind === 'FOLIO')?.key ?? '';
    expect(folioKey).toBe(`h(folio:${'X'.repeat(64)})`);
  });
});
