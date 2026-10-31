import { describe, expect, it } from 'vitest';

import {
  codigoPublicoDePrueba,
  createCounterSaleOperation,
  createWorkOrderOperation,
  issueQuoteOperation,
} from '../contracts/operation-receiver.contract';
import { parseOperation } from './operation';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

type Operacion = Record<string, unknown> & { payload: Record<string, unknown> };

function orden(): Operacion {
  return createWorkOrderOperation({
    opId: U(1),
    deviceId: U(2),
    seq: 1,
    userId: U(3),
    customerId: U(4),
    year: 2026,
    newUuid: (() => {
      let n = 100;
      return () => U((n += 1));
    })(),
    publicCode: codigoPublicoDePrueba(1),
    orderId: U(5),
  }) as Operacion;
}

function venta(): Operacion {
  return createCounterSaleOperation({
    opId: U(11),
    deviceId: U(2),
    seq: 1,
    userId: U(3),
    year: 2026,
    newUuid: (() => {
      let n = 200;
      return () => U((n += 1));
    })(),
    publicCode: codigoPublicoDePrueba(2),
    saleId: U(15),
  }) as Operacion;
}

function con(op: Operacion, cambios: Record<string, unknown>): Operacion {
  return { ...op, payload: { ...op.payload, ...cambios } };
}

function tipo(type: string, payload: unknown): unknown {
  return {
    opId: U(20),
    deviceId: U(2),
    seq: 1,
    type,
    schemaVersion: 1,
    userId: U(3),
    clientCreatedAt: '2026-10-31T18:00:00.000Z',
    payload,
  };
}

const ok = (crudo: unknown) => parseOperation(crudo).ok;

describe('sobre y tipo', () => {
  it('un tipo que no existe dice cuál fue; un sobre mal formado lista el campo que falla', () => {
    const r = parseOperation({ ...orden(), type: 'Inventada' });
    expect(!r.ok && r.error).toEqual({ code: 'UNKNOWN_TYPE', problems: ['tipo Inventada'] });
    const mal = parseOperation({ ...orden(), seq: 0 });
    expect(!mal.ok && mal.error.code).toBe('INVALID_ENVELOPE');
    expect(!mal.ok && mal.error.problems.join(' ')).toMatch(/^seq: /);
  });

  it('algo que no es un objeto, o un objeto sin tipo, es un sobre inválido y no un tipo desconocido', () => {
    for (const crudo of [null, 'x', 5, [], {}]) {
      const r = parseOperation(crudo);
      expect(!r.ok && r.error.code).toBe('INVALID_ENVELOPE');
    }
  });

  it('un error en la carga dice la ruta del campo', () => {
    const r = parseOperation(con(orden(), { totalCents: 1 }));
    expect(!r.ok && r.error.problems.some((p) => p.startsWith('payload.'))).toBe(true);
    const campo = parseOperation(con(orden(), { customerId: 'x' }));
    expect(!campo.ok && campo.error.problems.join(' ')).toContain('payload.customerId: ');
  });
});

describe('CreateWorkOrder', () => {
  it('la operación completa es válida', () => {
    expect(ok(orden())).toBe(true);
  });

  it('el total tiene que ser subtotal + IVA', () => {
    expect(ok(con(orden(), { totalCents: 11_601 }))).toBe(false);
  });

  it('el subtotal y el IVA tienen que ser la suma de las líneas, cada uno por su lado', () => {
    expect(ok(con(orden(), { subtotalCents: 9_999, taxCents: 1_601 }))).toBe(false);
    expect(ok(con(orden(), { subtotalCents: 10_001, taxCents: 1_599 }))).toBe(false);
    expect(ok(con(orden(), { subtotalCents: 10_000, taxCents: 1_601, totalCents: 11_601 }))).toBe(
      false,
    );
    expect(ok(con(orden(), { subtotalCents: 10_001, taxCents: 1_600, totalCents: 11_601 }))).toBe(
      false,
    );
  });

  it('el anticipo exigido puede ser igual al total pero no mayor', () => {
    expect(ok(con(orden(), { depositRequiredCents: 11_600 }))).toBe(true);
    expect(ok(con(orden(), { depositRequiredCents: 11_601 }))).toBe(false);
    expect(ok(con(orden(), { depositRequiredCents: 0 }))).toBe(true);
  });

  it('una línea cuyo importe no es base + IVA se rechaza', () => {
    const op = orden();
    const lineas = op.payload.lines as Record<string, unknown>[];
    const mala = { ...lineas[0], lineTotalCents: 11_599 };
    expect(ok(con(op, { lines: [mala] }))).toBe(false);
  });

  it('sin líneas, con un folio provisional mal escrito o un código público mal escrito se rechaza', () => {
    expect(ok(con(orden(), { lines: [] }))).toBe(false);
    expect(ok(con(orden(), { tempFolio: 'T1' }))).toBe(false);
    expect(ok(con(orden(), { publicCode: 'abc' }))).toBe(false);
    expect(ok(con(orden(), { publicCode: 'AAAAAAA0' }))).toBe(false);
  });

  it('el porcentaje de anticipo va de 0 a 10 000 puntos base', () => {
    expect(ok(con(orden(), { depositPercentBps: 10_001 }))).toBe(false);
    expect(ok(con(orden(), { depositPercentBps: -1 }))).toBe(false);
    expect(ok(con(orden(), { depositPercentBps: 10_000, depositRequiredCents: 11_600 }))).toBe(
      true,
    );
  });
});

describe('UpdateWorkOrder, AdvanceWorkOrder, DeliverWorkOrder y CancelWorkOrder', () => {
  it('un parche vacío se rechaza y uno con un dato es válido', () => {
    expect(ok(tipo('UpdateWorkOrder', { id: U(5), patch: {} }))).toBe(false);
    expect(ok(tipo('UpdateWorkOrder', { id: U(5), patch: { notes: 'x' } }))).toBe(true);
    expect(ok(tipo('UpdateWorkOrder', { id: U(5), patch: { measuredBy: null } }))).toBe(true);
    expect(
      ok(tipo('UpdateWorkOrder', { id: U(5), patch: { estimatedDeliveryDate: '2026-11-01' } })),
    ).toBe(true);
    expect(
      ok(tipo('UpdateWorkOrder', { id: U(5), patch: { estimatedDeliveryDate: '01/11/2026' } })),
    ).toBe(false);
  });

  it('avanzar solo va a "en proceso" o a "listo"', () => {
    expect(ok(tipo('AdvanceWorkOrder', { id: U(5), to: 'IN_PROCESS' }))).toBe(true);
    expect(ok(tipo('AdvanceWorkOrder', { id: U(5), to: 'READY' }))).toBe(true);
    expect(ok(tipo('AdvanceWorkOrder', { id: U(5), to: 'DELIVERED' }))).toBe(false);
    expect(ok(tipo('AdvanceWorkOrder', { id: 'x', to: 'READY' }))).toBe(false);
  });

  it('entregar y cancelar piden la orden; cancelar pide además un motivo con texto', () => {
    expect(ok(tipo('DeliverWorkOrder', { id: U(5) }))).toBe(true);
    expect(ok(tipo('DeliverWorkOrder', { id: U(5), reason: 'Paga el viernes' }))).toBe(true);
    expect(ok(tipo('DeliverWorkOrder', {}))).toBe(false);
    expect(ok(tipo('CancelWorkOrder', { id: U(5), reason: 'Duplicada' }))).toBe(true);
    expect(ok(tipo('CancelWorkOrder', { id: U(5), reason: '   ' }))).toBe(false);
    expect(ok(tipo('CancelWorkOrder', { id: U(5) }))).toBe(false);
  });
});

describe('RegisterPayment', () => {
  const cobro = (rows: unknown[]) => ({
    groupId: U(30),
    target: { type: 'WORK_ORDER', id: U(5) },
    kind: 'DEPOSIT',
    paidAt: '2026-10-31T18:00:00.000Z',
    rows,
  });
  const efectivo = (aplicado: number, recibido?: number | null) => ({
    id: U(31),
    method: 'CASH',
    amountCents: aplicado,
    ...(recibido === undefined ? {} : { cashReceivedCents: recibido }),
  });

  it('un cobro en efectivo pide lo recibido y que alcance', () => {
    expect(ok(tipo('RegisterPayment', cobro([efectivo(1_000, 1_000)])))).toBe(true);
    expect(ok(tipo('RegisterPayment', cobro([efectivo(1_000, 1_500)])))).toBe(true);
    expect(ok(tipo('RegisterPayment', cobro([efectivo(1_000, 999)])))).toBe(false);
    expect(ok(tipo('RegisterPayment', cobro([efectivo(1_000)])))).toBe(false);
    expect(ok(tipo('RegisterPayment', cobro([efectivo(1_000, null)])))).toBe(false);
  });

  it('una transferencia no lleva efectivo recibido y puede llevar referencia', () => {
    const t = (extra: Record<string, unknown>) => ({
      id: U(32),
      method: 'TRANSFER',
      amountCents: 500,
      ...extra,
    });
    expect(ok(tipo('RegisterPayment', cobro([t({})])))).toBe(true);
    expect(ok(tipo('RegisterPayment', cobro([t({ reference: 'SPEI' })])))).toBe(true);
    expect(ok(tipo('RegisterPayment', cobro([t({ cashReceivedCents: 500 })])))).toBe(false);
    expect(ok(tipo('RegisterPayment', cobro([t({ cashReceivedCents: null })])))).toBe(true);
  });

  it('el monto aplicado es entero y mayor a cero, y hace falta al menos una fila', () => {
    expect(ok(tipo('RegisterPayment', cobro([efectivo(0, 100)])))).toBe(false);
    expect(ok(tipo('RegisterPayment', cobro([efectivo(1.5, 100)])))).toBe(false);
    expect(ok(tipo('RegisterPayment', cobro([])))).toBe(false);
  });

  it('el destino y el tipo de cobro son de la lista', () => {
    const base = cobro([efectivo(1_000, 1_000)]);
    expect(ok(tipo('RegisterPayment', { ...base, kind: 'OTRO' }))).toBe(false);
    expect(ok(tipo('RegisterPayment', { ...base, target: { type: 'OTRO', id: U(5) } }))).toBe(
      false,
    );
    expect(
      ok(tipo('RegisterPayment', { ...base, target: { type: 'COUNTER_SALE', id: U(5) } })),
    ).toBe(true);
  });
});

describe('CreateCounterSale y CancelCounterSale', () => {
  it('la venta completa es válida, con o sin cliente', () => {
    expect(ok(venta())).toBe(true);
    expect(ok(con(venta(), { customerId: U(4) }))).toBe(true);
    expect(ok(con(venta(), { customerId: null }))).toBe(true);
    expect(ok(con(venta(), { customerId: 'x' }))).toBe(false);
  });

  it('el total tiene que ser subtotal + IVA y esos, la suma de las líneas', () => {
    expect(ok(con(venta(), { totalCents: 11_601 }))).toBe(false);
    expect(ok(con(venta(), { subtotalCents: 9_999, taxCents: 1_601 }))).toBe(false);
    expect(ok(con(venta(), { subtotalCents: 10_001, taxCents: 1_599 }))).toBe(false);
    expect(ok(con(venta(), { subtotalCents: 10_000, taxCents: 1_601, totalCents: 11_601 }))).toBe(
      false,
    );
    expect(ok(con(venta(), { subtotalCents: 10_001, taxCents: 1_600, totalCents: 11_601 }))).toBe(
      false,
    );
  });

  it('sin líneas o sin filas de cobro se rechaza', () => {
    expect(ok(con(venta(), { lines: [] }))).toBe(false);
    expect(ok(con(venta(), { payment: { groupId: U(40), rows: [] } }))).toBe(false);
  });

  it('cancelar pide la venta y un motivo con texto', () => {
    expect(ok(tipo('CancelCounterSale', { id: U(15), reason: 'Error' }))).toBe(true);
    expect(ok(tipo('CancelCounterSale', { id: U(15), reason: ' ' }))).toBe(false);
    expect(ok(tipo('CancelCounterSale', { reason: 'Error' }))).toBe(false);
  });
});

describe('IssueQuote', () => {
  it('sigue pidiendo que el total y las líneas cuadren', () => {
    const op = issueQuoteOperation({
      opId: U(50),
      deviceId: U(2),
      seq: 1,
      userId: U(3),
      customerId: U(4),
      year: 2026,
      newUuid: (() => {
        let n = 300;
        return () => U((n += 1));
      })(),
      publicCode: codigoPublicoDePrueba(3),
    });
    expect(ok(op)).toBe(true);
    const payload = op.payload as Record<string, unknown>;
    expect(ok({ ...op, payload: { ...payload, totalCents: 1 } })).toBe(false);
    expect(ok({ ...op, payload: { ...payload, subtotalCents: 9_999, taxCents: 1_601 } })).toBe(
      false,
    );
    expect(ok({ ...op, payload: { ...payload, subtotalCents: 10_001, taxCents: 1_599 } })).toBe(
      false,
    );
    const lineas = payload.lines as Record<string, unknown>[];
    expect(
      ok({ ...op, payload: { ...payload, lines: [{ ...lineas[0], lineTotalCents: 1 }] } }),
    ).toBe(false);
  });
});
