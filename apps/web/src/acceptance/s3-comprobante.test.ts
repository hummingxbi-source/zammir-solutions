import jsQR from 'jsqr';
import {
  advanceWorkOrder,
  asId,
  buildWorkOrderDocument,
  convertQuoteToWorkOrder,
  deliverWorkOrder,
  fixedClock,
  inMemorySyncOutbox,
  outboxPaymentStore,
  outboxQuoteStore,
  outboxWarrantyReader,
  outboxWorkOrderStore,
  registerWorkOrderPayment,
  seededRandom,
  type OrderDeps,
  type Quote,
  type QuoteActor,
  type QuoteLine,
} from '@zammir/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { pdfLibRenderer } from '../modules/documents/infra/pdf-lib-renderer';
import { qrMatrix } from '../modules/documents/infra/qr-matrix';
import { ETIQUETAS_DEL_COMPROBANTE } from '../modules/orders/ui/comprobante';

// S3-09 · El comprobante de trabajo sale del recorrido real (cotización aceptada → orden → anticipo →
// entrega) y su PDF se lee por un camino independiente: lo escrito es lo que dice el dominio, al centavo,
// y el QR lleva exactamente el enlace y el código esperados.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });
beforeAll(async () => {
  await import('pdfjs-dist/legacy/build/pdf.mjs');
});

const CLIENTE = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
const ADMIN = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};
const admin: QuoteActor = { userId: ADMIN, role: 'ADMIN' };

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`);
  },
};

const linea: QuoteLine = {
  id: '00000000-0000-4000-8000-0000000000b1',
  productId: null,
  name: 'Vidrio claro 6 mm',
  chargeUnit: 'SQUARE_METER',
  unitPriceCents: 28_000,
  catalogPriceCents: 28_000,
  ruleId: 'AREA',
  ruleParams: {},
  widthMm: 1200,
  heightMm: 800,
  quantity: 2,
  displayUnit: 'cm',
  baseCents: 46_345,
  taxCents: 7_415,
  lineTotalCents: 53_760,
  isTaxExempt: false,
  detail: '120 cm × 80 cm × 2 = 1.92 m² × $280.00',
};

const cotizacion: Quote = {
  id: asId<'Quote'>('00000000-0000-4000-8000-00000000f001'),
  status: 'ACCEPTED',
  customerId: CLIENTE,
  siteAddress: 'Calle 5 número 12, Otumba',
  lines: [linea],
  userId: cajero.userId,
  tempFolio: 'T1-0001',
  folio: 'COT-2026-0001',
  publicCode: 'QQQQ2222',
  issuedAt: '2026-10-31T15:00:00.000Z',
  validUntil: '2026-11-15',
  conditionsText: 'x',
  privacyNoticeVersion: null,
  catalogVersion: null,
  discountAuthorizedBy: null,
  syncStatus: 'SENT',
  reviewReason: null,
  updatedAt: '2026-10-31T15:00:00.000Z',
};

async function abrir(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 })
    .promise;
}

async function textoDe(bytes: Uint8Array): Promise<string> {
  const doc = await abrir(bytes);
  const partes: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const contenido = await (await doc.getPage(n)).getTextContent();
    partes.push(contenido.items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  return partes.join(' ').replace(/\s+/g, ' ');
}

/** Dibuja la matriz como imagen (con margen blanco) y la lee con un lector de QR independiente. */
function leerQr(matriz: readonly (readonly boolean[])[]): string | null {
  const escala = 6;
  const margen = 4;
  const lado = (matriz.length + 2 * margen) * escala;
  const pixeles = new Uint8ClampedArray(lado * lado * 4).fill(255);
  matriz.forEach((fila, i) => {
    fila.forEach((oscuro, j) => {
      if (!oscuro) {
        return;
      }
      for (let y = 0; y < escala; y += 1) {
        for (let x = 0; x < escala; x += 1) {
          const p = (((i + margen) * escala + y) * lado + (j + margen) * escala + x) * 4;
          pixeles[p] = 0;
          pixeles[p + 1] = 0;
          pixeles[p + 2] = 0;
        }
      }
    });
  });
  return jsQR(pixeles, lado, lado)?.data ?? null;
}

async function recorrido(semilla = 8) {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const deps: OrderDeps = {
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(semilla),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: { depositPercentBps: 5_000, requireDepositToStart: true, warrantyMonthsDefault: 12 },
  };
  await deps.quotes.save(cotizacion);
  const creada = await convertQuoteToWorkOrder(deps, cajero, cotizacion.id);
  if (!creada.ok) {
    throw new Error('no se creó la orden');
  }
  return { deps, id: creada.value.id };
}

async function comprobante(deps: OrderDeps, id: string, opciones: { baseUrl?: string } = {}) {
  const orden = await deps.orders.get(id);
  if (orden === null) {
    throw new Error('orden');
  }
  const documento = buildWorkOrderDocument({
    order: orden,
    payments: await deps.payments.listByTarget(id),
    customer: { name: 'Ana López Ñandú', phone: '5512345678' },
    business: {
      name: 'ZAMMIR (datos de prueba)',
      phone: '5598765432',
      address: 'Otumba, Edo. Méx.',
    },
    warranty: await outboxWarrantyReader(deps.outbox).get(id),
    conditions: 'Anticipo del 50%.\nSaldo contra entrega.',
    privacyNotice: 'Aviso de prueba',
    selfInvoicingLegend: 'Pide tu factura antes de que termine el mes.',
    publicBaseUrl: opciones.baseUrl ?? null,
    qrMatrix,
    labels: ETIQUETAS_DEL_COMPROBANTE,
  });
  const pdf = await pdfLibRenderer().render(documento);
  if (!pdf.ok) {
    throw new Error('no se generó el PDF');
  }
  return { documento, texto: await textoDe(pdf.value), orden };
}

describe('comprobante de trabajo (PDF con QR)', () => {
  it('al cobrar el anticipo trae folio, cliente, medidas, total, anticipo, saldo, condiciones y QR', async () => {
    const { deps, id } = await recorrido();
    const cobro = await registerWorkOrderPayment(deps, cajero, id, [
      { method: 'CASH', amountCents: 26_880, cashReceivedCents: 30_000 },
    ]);
    expect(cobro.ok).toBe(true);
    const { texto, orden, documento } = await comprobante(deps, id);

    expect(texto).toContain('COMPROBANTE DE TRABAJO');
    expect(texto).toContain('Folio provisional T1-0001');
    expect(texto).toContain('Ana López Ñandú');
    expect(texto).toContain('55 1234 5678');
    expect(texto).toContain('Calle 5 número 12, Otumba');
    expect(texto).toContain('120 cm × 80 cm × 2 = 1.92 m² × $280.00');
    expect(texto).toContain('$463.45');
    expect(texto).toContain('$74.15');
    expect(texto).toContain('$537.60');
    expect(texto).toContain('Anticipo · Efectivo · $268.80 · 31 oct 2026');
    expect(texto).toMatch(/Anticipo exigido\s+\$268\.80/);
    expect(texto).toMatch(/Pagado\s+\$268\.80/);
    expect(texto).toMatch(/Saldo\s+\$268\.80/);
    expect(texto).toContain('1. Anticipo del 50%.');
    expect(texto).toContain('2. Saldo contra entrega.');
    expect(texto).toContain('Pide tu factura');
    expect(texto).toContain(`Código de verificación: ${orden.publicCode}`);
    expect(texto).toContain('Pide tu factura antes de que termine el mes.');
    expect(documento.receipt?.isSettled).toBe(false);
  });

  it('el QR lee exactamente el enlace con el folio y el código de la orden', async () => {
    const { deps, id } = await recorrido();
    const { documento, orden } = await comprobante(deps, id, { baseUrl: 'https://zammir.example' });
    const esperado = `https://zammir.example/f/${orden.tempFolio}/${orden.publicCode}`;
    expect(documento.receipt?.qr.url).toBe(esperado);
    expect(leerQr(documento.receipt?.qr.matrix ?? [])).toBe(esperado);
  });

  it('el QR de la orden ya enviada usa el folio definitivo', async () => {
    const { deps, id } = await recorrido();
    const o = await deps.orders.get(id);
    if (o === null) {
      throw new Error('orden');
    }
    await deps.orders.save({ ...o, folio: 'OT-2026-0042', syncStatus: 'SENT' });
    const { documento, orden } = await comprobante(deps, id);
    const esperado = `https://pruebas.zammir.invalid/f/OT-2026-0042/${orden.publicCode}`;
    expect(leerQr(documento.receipt?.qr.matrix ?? [])).toBe(esperado);
    expect(documento.folioLabel).toBe('OT-2026-0042');
  });

  it('el código del comprobante es distinto en cada orden y no sale del folio', async () => {
    const a = await recorrido();
    const b = await recorrido(9);
    const ordenA = await a.deps.orders.get(a.id);
    const ordenB = await b.deps.orders.get(b.id);
    expect(ordenA?.publicCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(ordenA?.publicCode).not.toBe(ordenB?.publicCode);
    expect(ordenA?.publicCode).not.toContain(ordenA?.tempFolio ?? '#');
  });

  it('al entregar con el saldo liquidado, el comprobante nuevo muestra saldo cero y la garantía', async () => {
    const { deps, id } = await recorrido();
    await registerWorkOrderPayment(deps, cajero, id, [
      { method: 'TRANSFER', amountCents: 26_880, reference: 'R1' },
    ]);
    await advanceWorkOrder(deps, cajero, id);
    await advanceWorkOrder(deps, cajero, id);
    await registerWorkOrderPayment(deps, cajero, id, [
      { method: 'CASH', amountCents: 26_880, cashReceivedCents: 26_880 },
    ]);
    const entrega = await deliverWorkOrder(deps, admin, id);
    expect(entrega.ok).toBe(true);
    const { texto, documento } = await comprobante(deps, id);

    expect(documento.receipt?.isSettled).toBe(true);
    expect(texto).toMatch(/Saldo\s+Liquidado/);
    expect(texto).toMatch(/Pagado\s+\$537\.60/);
    expect(texto).toContain('Entregado');
    expect(texto).toContain('Anticipo · Transferencia · $268.80');
    expect(texto).toContain('Saldo · Efectivo · $268.80');
    // Garantía escrita [RN-14]: inicio de la entrega y la duración configurada.
    expect(texto).toContain('Inicia el 31 oct 2026');
    expect(texto).toContain('Duración: 12 meses');
  });

  it('sin duración de garantía definida no se escribe ninguna: solo el inicio', async () => {
    const { deps, id } = await recorrido();
    const sinDuracion: OrderDeps = {
      ...deps,
      settings: { ...deps.settings, warrantyMonthsDefault: null },
    };
    await registerWorkOrderPayment(sinDuracion, cajero, id, [
      { method: 'TRANSFER', amountCents: 53_760, reference: 'R1' },
    ]);
    await advanceWorkOrder(sinDuracion, cajero, id);
    await advanceWorkOrder(sinDuracion, cajero, id);
    await deliverWorkOrder(sinDuracion, cajero, id);
    const { texto } = await comprobante(sinDuracion, id);
    expect(texto).toContain('Inicia el 31 oct 2026');
    expect(texto).not.toContain('Duración:');
  });
});
