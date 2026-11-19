import { describe, expect, it } from 'vitest';

import type { CounterSale } from '../../counter/domain/counter-sale';
import type { Payment } from '../../payments/domain/payment';
import { buildSaleDocument, type BuildSaleDocumentInput, type SaleLabels } from './sale-document';

const etiquetas: SaleLabels = {
  document: {
    title: 'Comprobante de venta',
    folio: 'Folio',
    date: 'Fecha',
    validUntil: 'Vigencia',
    customer: 'Cliente',
    phone: 'Teléfono',
    site: 'Obra',
    concept: 'Concepto',
    quantity: 'Cant.',
    unitPrice: 'Precio unit.',
    amount: 'Importe',
    subtotal: 'Subtotal',
    tax: 'IVA',
    total: 'Total',
    conditions: 'Condiciones',
    signature: 'Firma de conformidad',
    publicCode: 'Código',
    page: 'Página {n} de {total}',
    draft: 'BORRADOR',
  },
  extras: {
    payments: 'Pagos',
    depositRequired: 'Anticipo exigido',
    paid: 'Pagado',
    balance: 'Saldo',
    settled: 'Liquidado',
    warranty: 'Garantía',
    selfInvoicing: 'Pida su factura',
    verificationCode: 'Código de verificación',
  },
  saleKind: 'Venta',
  method: { CASH: 'Efectivo', TRANSFER: 'Transferencia' },
  status: { COMPLETED: 'Pagada', CANCELLED: 'Cancelada' },
  counterCustomer: 'Cliente de mostrador',
  attendedBy: 'Atendió: {name}',
  change: 'Cambio {amount}',
  provisionalNote: 'Folio provisional',
};

const linea = (nombre: string, cantidad: number, unitario: number) =>
  ({
    id: nombre,
    name: nombre,
    detail: `${String(cantidad)} × ${String(unitario / 100)}`,
    quantity: cantidad,
    unitPriceCents: unitario,
    lineTotalCents: unitario * cantidad,
  }) as never;

const venta = (cambios: Partial<CounterSale> = {}): CounterSale =>
  ({
    id: 'v1',
    status: 'COMPLETED',
    customerId: null,
    lines: [
      linea('Chapa de baño', 2, 11_600),
      linea('Vidrio claro 6 mm, corte a medida', 1, 28_000),
    ],
    subtotalCents: 44_828,
    taxCents: 7_172,
    totalCents: 52_000,
    tempFolio: 'T1-0007',
    folio: 'V-2026-0007',
    publicCode: 'ABCDEFGH',
    issuedAt: '2026-10-31T18:05:00.000Z',
    userId: 'u1',
    deviceId: 'd1',
    cashShiftId: null,
    cancelledAt: null,
    cancelReason: null,
    cancelledBy: null,
    syncStatus: 'SENT',
    reviewReason: null,
    updatedAt: '2026-10-31T18:05:00.000Z',
    ...cambios,
  }) as CounterSale;

const pago = (cambios: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  groupId: 'g1',
  targetType: 'COUNTER_SALE',
  targetId: 'v1',
  kind: 'SALE',
  method: 'CASH',
  amountCents: 52_000,
  cashReceivedCents: 60_000,
  changeCents: 8_000,
  reference: null,
  userId: 'u1',
  deviceId: 'd1',
  paidAt: '2026-10-31T18:05:00.000Z',
  cashShiftId: null,
  ...cambios,
});

function armar(cambios: Partial<BuildSaleDocumentInput> = {}) {
  return buildSaleDocument({
    sale: venta(),
    payments: [pago()],
    customer: null,
    cashierName: 'Beto',
    business: { name: 'ZAMMIR (datos de prueba)', phone: '55 0000 0000', address: 'Otumba' },
    conditions: 'Sin cambios ni devoluciones en vidrio a medida.',
    privacyNotice: 'Aviso de prueba',
    selfInvoicingLegend: 'Factura antes de fin de mes.',
    publicBaseUrl: null,
    qrMatrix: () => [[true]],
    autofacturacion: false,
    labels: etiquetas,
    ...cambios,
  });
}

describe('comprobante de venta de mostrador', () => {
  it('los importes son los de la venta, al centavo, y los conceptos salen en orden', () => {
    const doc = armar();
    expect(doc.subtotal).toBe('$448.28');
    expect(doc.tax).toBe('$71.72');
    expect(doc.total).toBe('$520.00');
    expect(doc.lines.map((l) => [l.position, l.name, l.amount])).toEqual([
      [1, 'Chapa de baño', '$232.00'],
      [2, 'Vidrio claro 6 mm, corte a medida', '$280.00'],
    ]);
    expect(doc.labels.title).toBe('Comprobante de venta');
    expect(doc.folioLabel).toBe('V-2026-0007');
  });

  it('una venta se paga completa: sin anticipo ni garantía, con quién atendió y el pago con su cambio', () => {
    const r = armar().receipt;
    expect(r?.depositRequired).toBeNull();
    expect(r?.warrantyLines).toEqual([]);
    expect(r?.attendedBy).toBe('Atendió: Beto');
    expect(r?.status).toBe('Pagada');
    expect(r?.paid).toBe('$520.00');
    expect(r?.balance).toBe('Liquidado');
    expect(r?.isSettled).toBe(true);
    expect(r?.paymentLines).toEqual(['Venta · Efectivo · $520.00 · 31 oct 2026 · Cambio $80.00']);
  });

  it('con varios pagos, los lista por fecha y suma lo pagado', () => {
    const r = armar({
      payments: [
        pago({
          id: 'p2',
          method: 'TRANSFER',
          amountCents: 20_000,
          cashReceivedCents: null,
          changeCents: null,
          paidAt: '2026-10-31T18:06:00.000Z',
        }),
        pago({
          id: 'p1',
          amountCents: 32_000,
          cashReceivedCents: 32_000,
          changeCents: 0,
          paidAt: '2026-10-31T18:05:00.000Z',
        }),
      ],
    }).receipt;
    expect(r?.paymentLines).toEqual([
      'Venta · Efectivo · $320.00 · 31 oct 2026',
      'Venta · Transferencia · $200.00 · 31 oct 2026',
    ]);
    expect(r?.paid).toBe('$520.00');
    expect(r?.isSettled).toBe(true);
  });

  it('si lo pagado no alcanza, dice lo que falta en vez de Liquidado', () => {
    const r = armar({
      payments: [pago({ amountCents: 40_000, cashReceivedCents: 40_000, changeCents: 0 })],
    }).receipt;
    expect(r?.balance).toBe('$120.00');
    expect(r?.isSettled).toBe(false);
  });

  it('sin cliente sale "Cliente de mostrador" y sin teléfono; con cliente, sus datos', () => {
    expect(armar().customer).toEqual({ name: 'Cliente de mostrador', phone: '' });
    expect(armar({ customer: { name: 'Ana López', phone: '5512345678' } }).customer).toEqual({
      name: 'Ana López',
      phone: '5512345678',
    });
  });

  it('sin folio definitivo usa el provisional y lo dice', () => {
    const doc = armar({ sale: venta({ folio: null }) });
    expect(doc.folioLabel).toBe('Folio provisional T1-0007');
    expect(doc.provisionalNote).toBe('Folio provisional');
  });

  it('con la facturación en pausa no lleva QR, leyenda ni código [ADR-0039]', () => {
    let pidioQr = false;
    const doc = armar({
      autofacturacion: false,
      qrMatrix: () => {
        pidioQr = true;
        return [[true]];
      },
    });
    expect(doc.receipt?.qr).toBeNull();
    expect(doc.publicCode).toBeNull();
    expect(pidioQr).toBe(false);
    expect(JSON.stringify(doc)).not.toContain('Factura antes de fin de mes.');
  });

  it('con la facturación encendida lleva el QR con el folio y el código, y no si la venta está cancelada', () => {
    const doc = armar({ autofacturacion: true, publicBaseUrl: 'https://zammir.example' });
    expect(doc.receipt?.qr?.url).toBe('https://zammir.example/f/V-2026-0007/ABCDEFGH');
    expect(doc.receipt?.qr?.legend).toEqual(['Factura antes de fin de mes.']);
    expect(doc.publicCode).toBe('ABCDEFGH');
    const cancelada = armar({
      autofacturacion: true,
      sale: venta({ status: 'CANCELLED' }),
    });
    expect(cancelada.receipt?.qr).toBeNull();
    expect(cancelada.receipt?.status).toBe('Cancelada');
  });
});
