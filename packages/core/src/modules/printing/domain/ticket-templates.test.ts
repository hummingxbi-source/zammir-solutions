import { describe, expect, it } from 'vitest';

import { summarizeShift } from '../../cash/domain/cash-shift';
import type { CounterSale } from '../../counter/domain/counter-sale';
import type { WorkOrder } from '../../orders/domain/work-order';
import type { Payment } from '../../payments/domain/payment';
import { pairLine, toPlainLines } from './print-document';
import {
  fechaHoraDeMexico,
  orderPaymentTicket,
  saleTicket,
  shiftCutTicket,
  testPage,
  type TicketLabels,
} from './ticket-templates';

export const ROTULOS_DE_TICKET: TicketLabels = {
  sale: 'VENTA',
  orderPayment: 'COBRO DE ORDEN',
  shiftCut: 'CORTE DE CAJA',
  testPage: 'PRUEBA DE IMPRESORA',
  testPageBody: 'Si ves bien estos acentos y el código QR, la impresora está lista.',
  folio: 'Folio',
  provisional: '(provisional)',
  date: 'Fecha',
  customer: 'Cliente',
  attendedBy: 'Atendió',
  subtotal: 'Subtotal',
  tax: 'IVA',
  total: 'TOTAL',
  change: 'Cambio',
  cashReceived: 'Recibido',
  paid: 'Pagado',
  balance: 'Saldo',
  code: 'Código',
  reprint: 'REIMPRESIÓN',
  cancelled: 'VENTA CANCELADA',
  thanks: 'Gracias por su compra',
  kind: { DEPOSIT: 'Anticipo', BALANCE: 'Saldo', SALE: 'Pago' },
  method: { CASH: 'efectivo', TRANSFER: 'transferencia' },
  opened: 'Abrió',
  closed: 'Cerró',
  openingFloat: 'Fondo',
  cashCollected: 'Efectivo cobrado',
  transferCollected: 'Transferencias',
  expectedCash: 'Efectivo esperado',
  countedCash: 'Efectivo contado',
  difference: 'Diferencia',
  exact: 'Exacto',
  over: 'Sobrante',
  short: 'Faltante',
  cancelledSales: 'Ventas canceladas',
};

const negocio = {
  name: 'ZAMMIR (datos de prueba)',
  phone: '55 0000 0000',
  address: 'Calle Falsa 123, Otumba',
};

const linea = (nombre: string, cantidad: number, unitario: number) =>
  ({
    id: nombre,
    name: nombre,
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

const comun = { business: negocio, labels: ROTULOS_DE_TICKET, width: 32 as const };

describe('hora de México en el ticket', () => {
  it('muestra la hora de la Ciudad de México aunque el instante venga en UTC', () => {
    expect(fechaHoraDeMexico('2026-10-31T18:05:00.000Z')).toBe('31/10/2026 12:05');
    expect(fechaHoraDeMexico('2026-11-01T05:30:00.000Z')).toBe('31/10/2026 23:30');
  });
});

describe('ticket de venta', () => {
  const doc = saleTicket({
    ...comun,
    sale: venta(),
    payments: [pago()],
    customerName: 'Ana López',
    cashierName: 'Beto',
    selfInvoicingLegend: 'Factura en 30 días.',
    publicBaseUrl: 'https://pruebas.zammir.invalid',
  });

  it('coincide con la versión aprobada (32 columnas)', () => {
    expect(toPlainLines(doc)).toEqual([
      'ZAMMIR (datos de',
      '    prueba)',
      '    Calle Falsa 123, Otumba',
      '          55 0000 0000',
      '--------------------------------',
      '             VENTA',
      'Folio V-2026-0007',
      'Fecha: 31/10/2026 12:05',
      'Cliente: Ana López',
      'Atendió: Beto',
      '--------------------------------',
      'Chapa de baño',
      '  2 x $116.00            $232.00',
      'Vidrio claro 6 mm, corte a',
      'medida',
      '  1 x $280.00            $280.00',
      '--------------------------------',
      'Subtotal                 $448.28',
      'IVA                       $71.72',
      'TOTAL                    $520.00',
      'Pago efectivo            $520.00',
      '  Recibido               $600.00',
      '  Cambio                  $80.00',
      '--------------------------------',
      'Factura en 30 días.',
      '[QR] https://pruebas.zammir.invalid/f/V-2026-0007/ABCDEFGH',
      '        Código: ABCDEFGH',
      '     Gracias por su compra',
      '',
    ]);
  });

  it('el QR lleva solo el folio y el código, sin datos del cliente', () => {
    const qr = doc.blocks.find((b) => b.kind === 'qr');
    expect(qr).toEqual({
      kind: 'qr',
      text: 'https://pruebas.zammir.invalid/f/V-2026-0007/ABCDEFGH',
    });
  });

  it('sin folio definitivo usa el provisional y lo dice', () => {
    const d = saleTicket({
      ...comun,
      sale: venta({ folio: null }),
      payments: [pago()],
      customerName: null,
      cashierName: 'Beto',
      selfInvoicingLegend: '',
      publicBaseUrl: null,
    });
    const texto = toPlainLines(d).join('\n');
    expect(texto).toContain('Folio T1-0007');
    expect(texto).toContain('(provisional)');
    expect(texto).not.toContain('Cliente:');
    expect(texto).toContain('pruebas.zammir.invalid/f/T1-0007/ABCDEFGH');
  });

  it('una reimpresión se marca, y una venta cancelada también', () => {
    const d = saleTicket({
      ...comun,
      reprint: true,
      sale: venta({ status: 'CANCELLED' }),
      payments: [],
      customerName: null,
      cashierName: 'Beto',
      selfInvoicingLegend: '',
      publicBaseUrl: null,
    });
    const texto = toPlainLines(d).join('\n');
    expect(texto).toContain('REIMPRESIÓN');
    expect(texto).toContain('VENTA CANCELADA');
  });

  it('un pago en transferencia no enseña recibido ni cambio', () => {
    const d = saleTicket({
      ...comun,
      sale: venta(),
      payments: [pago({ method: 'TRANSFER', cashReceivedCents: null, changeCents: null })],
      customerName: null,
      cashierName: 'Beto',
      selfInvoicingLegend: '',
      publicBaseUrl: null,
    });
    const texto = toPlainLines(d).join('\n');
    expect(texto).toContain('Pago transferencia');
    expect(texto).not.toContain('Recibido');
    expect(texto).not.toContain('Cambio');
  });

  it('pagado justo no imprime cambio', () => {
    const d = saleTicket({
      ...comun,
      sale: venta(),
      payments: [pago({ cashReceivedCents: 52_000, changeCents: 0 })],
      customerName: null,
      cashierName: 'Beto',
      selfInvoicingLegend: '',
      publicBaseUrl: null,
    });
    const texto = toPlainLines(d).join('\n');
    expect(texto).toContain('Recibido');
    expect(texto).not.toContain('Cambio');
  });

  it('a 42 columnas los renglones se ensanchan', () => {
    const d = saleTicket({
      ...comun,
      width: 42,
      sale: venta(),
      payments: [pago()],
      customerName: null,
      cashierName: 'Beto',
      selfInvoicingLegend: '',
      publicBaseUrl: null,
    });
    expect(toPlainLines(d).find((r) => r.startsWith('TOTAL'))).toHaveLength(42);
  });
});

describe('comprobante de cobro de una orden', () => {
  const orden = {
    id: 'o1',
    folio: 'OT-2026-0003',
    tempFolio: 'T1-0003',
    publicCode: 'ZXCVBNMA',
    totalCents: 116_000,
  } as WorkOrder;

  it('enseña lo cobrado ahora, lo pagado en total y el saldo', () => {
    const anticipo = pago({
      targetType: 'WORK_ORDER',
      targetId: 'o1',
      kind: 'DEPOSIT',
      amountCents: 58_000,
      cashReceivedCents: 60_000,
      changeCents: 2_000,
    });
    const d = orderPaymentTicket({
      ...comun,
      order: orden,
      payment: anticipo,
      payments: [anticipo],
      customerName: 'Ana López',
      cashierName: 'Beto',
      selfInvoicingLegend: '',
      publicBaseUrl: null,
    });
    const lineas = toPlainLines(d);
    expect(lineas).toContain(pairLine('Anticipo efectivo', '$580.00', 32));
    expect(lineas).toContain(pairLine('TOTAL', '$1,160.00', 32));
    expect(lineas.find((r) => r.startsWith('Saldo'))).toBe(pairLine('Saldo', '$580.00', 32));
    expect(lineas.find((r) => r.startsWith('Pagado'))).toBe(pairLine('Pagado', '$580.00', 32));
  });
});

describe('resumen del corte', () => {
  it('cerrado con faltante enseña esperado, contado y diferencia', () => {
    const summary = summarizeShift({
      openingFloatCents: 50_000,
      payments: [
        {
          method: 'CASH',
          amountCents: 20_000,
          kind: 'SALE',
          targetType: 'COUNTER_SALE',
          targetId: 'a',
        },
        {
          method: 'TRANSFER',
          amountCents: 30_000,
          kind: 'SALE',
          targetType: 'COUNTER_SALE',
          targetId: 'b',
        },
      ],
      cancelledSaleIds: new Set(),
      countedCashCents: 69_000,
    });
    const d = shiftCutTicket({
      ...comun,
      cashierName: 'Beto',
      openedAt: '2026-10-31T15:00:00.000Z',
      closedAt: '2026-10-31T23:00:00.000Z',
      summary,
      countedCashCents: 69_000,
    });
    const lineas = toPlainLines(d);
    expect(lineas).toContain('Abrió: 31/10/2026 09:00');
    expect(lineas).toContain('Cerró: 31/10/2026 17:00');
    expect(lineas).toContain(pairLine('Fondo', '$500.00', 32));
    expect(lineas).toContain(pairLine('Efectivo cobrado', '$200.00', 32));
    expect(lineas).toContain(pairLine('Transferencias', '$300.00', 32));
    expect(lineas).toContain(pairLine('Efectivo esperado', '$700.00', 32));
    expect(lineas).toContain(pairLine('Efectivo contado', '$690.00', 32));
    expect(lineas).toContain(pairLine('Diferencia', 'Faltante $10.00', 32));
  });

  it('exacto, sobrante, sin contar y con ventas canceladas', () => {
    const base = {
      ...comun,
      cashierName: 'Beto',
      openedAt: '2026-10-31T15:00:00.000Z',
      closedAt: null,
    };
    const resumen = (contado: number | null, canceladas = false) =>
      summarizeShift({
        openingFloatCents: 0,
        payments: canceladas
          ? [
              {
                method: 'CASH',
                amountCents: 1_000,
                kind: 'SALE',
                targetType: 'COUNTER_SALE',
                targetId: 'x',
              },
            ]
          : [],
        cancelledSaleIds: canceladas ? new Set(['x']) : new Set(),
        countedCashCents: contado,
      });
    const texto = (contado: number | null, canceladas = false) =>
      toPlainLines(
        shiftCutTicket({
          ...base,
          summary: resumen(contado, canceladas),
          countedCashCents: contado,
        }),
      ).join('\n');
    expect(texto(0)).toContain('Exacto');
    expect(texto(500)).toContain('Sobrante $5.00');
    expect(texto(null)).not.toContain('Diferencia');
    expect(texto(null)).not.toContain('Cerró');
    expect(texto(0, true)).toContain('Ventas canceladas (1)');
  });
});

describe('página de prueba', () => {
  it('trae acentos y un QR para comprobar la impresora', () => {
    const d = testPage(comun);
    const texto = toPlainLines(d).join('\n');
    expect(texto).toContain('PRUEBA DE IMPRESORA');
    expect(texto).toContain('áéíóú ñ Ñ ¿? ¡! ü');
    expect(d.blocks.some((b) => b.kind === 'qr')).toBe(true);
  });
});
