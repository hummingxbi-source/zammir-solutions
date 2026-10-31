import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import type { Payment } from '../../payments/domain/payment';
import type { Warranty, WorkOrder } from '../../orders/domain/work-order';
import {
  autoinvoiceUrl,
  buildWorkOrderDocument,
  TEST_SELF_INVOICING_BASE_URL,
  type ReceiptLabels,
} from './work-order-document';

const etiquetas: ReceiptLabels = {
  document: {
    title: 'Comprobante de trabajo',
    folio: 'Folio',
    date: 'Fecha',
    validUntil: 'Vigencia',
    customer: 'Cliente',
    phone: 'WhatsApp',
    site: 'Obra',
    concept: 'Concepto',
    quantity: 'Cant.',
    unitPrice: 'Precio',
    amount: 'Importe',
    subtotal: 'Subtotal',
    tax: 'IVA',
    total: 'Total',
    conditions: 'Condiciones',
    signature: 'Firma',
    publicCode: 'Código',
    page: 'Página {n} de {total}',
    draft: 'Borrador',
  },
  extras: {
    payments: 'Pagos',
    depositRequired: 'Anticipo exigido',
    paid: 'Pagado',
    balance: 'Saldo',
    settled: 'Liquidado',
    warranty: 'Garantía',
    selfInvoicing: 'Facturación',
    verificationCode: 'Código de verificación',
  },
  kind: { DEPOSIT: 'Anticipo', BALANCE: 'Saldo', SALE: 'Venta' },
  method: { CASH: 'Efectivo', TRANSFER: 'Transferencia' },
  status: {
    WAITING: 'En espera',
    IN_PROCESS: 'En proceso',
    READY: 'Listo',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado',
  },
  warrantyStart: 'Inicia el {date}',
  warrantyDuration: 'Duración: {months} meses',
  warrantyCoverage: 'Cubre: {coverage}',
  warrantyExclusions: 'No cubre: {exclusions}',
  provisionalNote: 'Folio provisional',
};

function orden(cambios: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: asId<'WorkOrder'>('00000000-0000-4000-8000-0000000000a1'),
    status: 'WAITING',
    customerId: asId<'Customer'>('00000000-0000-4000-8000-00000000c001'),
    quoteId: null,
    siteAddress: 'Calle 5, Otumba',
    description: null,
    lines: [
      {
        id: 'l1',
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
        baseCents: 46_345,
        taxCents: 7_415,
        lineTotalCents: 53_760,
        isTaxExempt: false,
        detail: '120 cm × 80 cm × 2 = 1.92 m² × $280.00',
      },
    ],
    subtotalCents: 46_345,
    taxCents: 7_415,
    totalCents: 53_760,
    depositPercentBps: 5_000,
    depositRequiredCents: 26_880,
    measuredBy: null,
    builtBy: null,
    installedBy: null,
    estimatedDeliveryDate: null,
    notes: null,
    tempFolio: 'T1-0007',
    folio: null,
    publicCode: 'ABCD2345',
    issuedAt: '2026-10-31T15:00:00.000Z',
    deliveredAt: null,
    deliveredWithBalance: false,
    deliveryReason: null,
    deliveryAuthorizedBy: null,
    cancelledAt: null,
    cancelReason: null,
    cancelledFromStatus: null,
    cancelDepositPaidCents: null,
    userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
    syncStatus: 'SAVED_ON_TABLET',
    reviewReason: null,
    updatedAt: '2026-10-31T15:00:00.000Z',
    ...cambios,
  };
}

function pago(id: string, centavos: number, kind: Payment['kind'], paidAt: string): Payment {
  return {
    id,
    groupId: id,
    targetType: 'WORK_ORDER',
    targetId: 'o1',
    kind,
    method: 'CASH',
    amountCents: centavos,
    cashReceivedCents: centavos,
    changeCents: 0,
    reference: null,
    userId: 'u1',
    deviceId: null,
    paidAt,
    cashShiftId: null,
  };
}

const matrizFalsa = (texto: string): boolean[][] => [[texto.length % 2 === 0]];

function armar(cambios: Partial<Parameters<typeof buildWorkOrderDocument>[0]> = {}) {
  return buildWorkOrderDocument({
    order: orden(),
    payments: [],
    customer: { name: 'Ana López', phone: '5512345678' },
    business: { name: 'ZAMMIR (datos de prueba)', phone: null, address: null },
    warranty: null,
    conditions: 'Uno.\n\nDos.',
    privacyNotice: 'Aviso de prueba',
    selfInvoicingLegend: 'Factura antes de fin de mes.',
    publicBaseUrl: null,
    qrMatrix: matrizFalsa,
    labels: etiquetas,
    ...cambios,
  });
}

describe('enlace de autofacturación', () => {
  it('lleva el folio y el código, sin datos personales, con dominio de prueba si no hay otro', () => {
    expect(autoinvoiceUrl(null, 'OT-2026-0012', 'ABCD2345')).toBe(
      `${TEST_SELF_INVOICING_BASE_URL}/f/OT-2026-0012/ABCD2345`,
    );
  });

  it('usa la dirección configurada, sin dobles diagonales', () => {
    expect(autoinvoiceUrl('https://zammir.example/', 'OT-2026-0001', 'ZZZZ9999')).toBe(
      'https://zammir.example/f/OT-2026-0001/ZZZZ9999',
    );
  });

  it('un folio provisional también se codifica bien', () => {
    expect(autoinvoiceUrl('https://x.test', 'T1-0007', 'AAAA2222')).toBe(
      'https://x.test/f/T1-0007/AAAA2222',
    );
  });
});

describe('comprobante de trabajo', () => {
  it('los totales son los de la orden, al centavo, y el cliente y la obra salen tal cual', () => {
    const doc = armar();
    expect(doc.total).toBe('$537.60');
    expect(doc.subtotal).toBe('$463.45');
    expect(doc.tax).toBe('$74.15');
    expect(doc.lines[0]?.detail).toBe('120 cm × 80 cm × 2 = 1.92 m² × $280.00');
    expect(doc.customer.name).toBe('Ana López');
    expect(doc.siteAddress).toBe('Calle 5, Otumba');
    expect(doc.conditions).toEqual(['Uno.', 'Dos.']);
  });

  it('sin enviar lleva el folio provisional; ya enviada, el definitivo', () => {
    const sin = armar();
    expect(sin.folioLabel).toBe('Folio provisional T1-0007');
    expect(sin.provisionalNote).toBe('Folio provisional');
    const con = armar({ order: orden({ folio: 'OT-2026-0012' }) });
    expect(con.folioLabel).toBe('OT-2026-0012');
    expect(con.provisionalNote).toBeNull();
  });

  it('muestra el anticipo exigido, lo pagado y el saldo calculado de los pagos', () => {
    const doc = armar({
      payments: [
        pago('p2', 10_000, 'BALANCE', '2026-11-02T16:00:00.000Z'),
        pago('p1', 26_880, 'DEPOSIT', '2026-10-31T16:00:00.000Z'),
      ],
    });
    expect(doc.receipt?.depositRequired).toBe('$268.80');
    expect(doc.receipt?.paid).toBe('$368.80');
    expect(doc.receipt?.balance).toBe('$168.80');
    expect(doc.receipt?.isSettled).toBe(false);
    expect(doc.receipt?.paymentLines).toEqual([
      'Anticipo · Efectivo · $268.80 · 31 oct 2026',
      'Saldo · Efectivo · $100.00 · 2 nov 2026',
    ]);
  });

  it('al liquidar, el saldo dice Liquidado', () => {
    const doc = armar({
      order: orden({ status: 'DELIVERED' }),
      payments: [pago('p1', 53_760, 'DEPOSIT', '2026-10-31T16:00:00.000Z')],
    });
    expect(doc.receipt?.balance).toBe('Liquidado');
    expect(doc.receipt?.isSettled).toBe(true);
    expect(doc.receipt?.status).toBe('Entregado');
  });

  it('el QR trae exactamente el enlace con el folio y el código de la orden', () => {
    let pedido = '';
    const doc = armar({
      order: orden({ folio: 'OT-2026-0012' }),
      publicBaseUrl: 'https://zammir.example',
      qrMatrix: (t) => {
        pedido = t;
        return [[true]];
      },
    });
    expect(pedido).toBe('https://zammir.example/f/OT-2026-0012/ABCD2345');
    expect(doc.receipt?.qr.url).toBe(pedido);
    expect(doc.receipt?.qr.code).toBe('ABCD2345');
    expect(doc.receipt?.qr.legend).toEqual(['Factura antes de fin de mes.']);
  });

  it('la garantía solo sale con lo que se haya definido: nunca una duración inventada', () => {
    const vacia: Warranty = {
      workOrderId: 'o1',
      startsOn: '2026-11-10',
      durationMonths: null,
      coverage: null,
      exclusions: null,
    };
    expect(armar({ warranty: vacia }).receipt?.warrantyLines).toEqual(['Inicia el 10 nov 2026']);
    expect(armar({ warranty: null }).receipt?.warrantyLines).toEqual([]);
    const completa: Warranty = {
      ...vacia,
      durationMonths: 12,
      coverage: 'Defectos de fabricación',
      exclusions: 'Golpes',
    };
    expect(armar({ warranty: completa }).receipt?.warrantyLines).toEqual([
      'Inicia el 10 nov 2026',
      'Duración: 12 meses',
      'Cubre: Defectos de fabricación',
      'No cubre: Golpes',
    ]);
  });

  it('nunca escribe HummingX en el documento', () => {
    const texto = JSON.stringify(armar());
    expect(texto.toLowerCase()).not.toContain('hummingx');
  });
});
