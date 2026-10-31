import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { err } from '../../../shared-kernel/result';
import { balanceCents, paymentKindForOrder, planPayment, type PaymentRowInput } from './payment';

const efectivo = (aplicado: number, recibido: number): PaymentRowInput => ({
  method: 'CASH',
  amountCents: aplicado,
  cashReceivedCents: recibido,
});
const transferencia = (aplicado: number, referencia?: string): PaymentRowInput => ({
  method: 'TRANSFER',
  amountCents: aplicado,
  ...(referencia === undefined ? {} : { reference: referencia }),
});

describe('saldo de una orden', () => {
  it('es el total menos la suma de los pagos aplicados', () => {
    expect(balanceCents(11_600, [])).toBe(11_600);
    expect(balanceCents(11_600, [{ amountCents: 5_800 }, { amountCents: 1_000 }])).toBe(4_800);
    expect(balanceCents(11_600, [{ amountCents: 11_600 }])).toBe(0);
  });

  it('propiedad: el saldo más lo pagado siempre es el total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 100_000 }), { maxLength: 30 }),
        (total, montos) => {
          const pagos = montos.map((amountCents) => ({ amountCents }));
          const pagado = montos.reduce((s, m) => s + m, 0);
          expect(balanceCents(total, pagos) + pagado).toBe(total);
        },
      ),
    );
  });
});

describe('planPayment · efectivo', () => {
  it('calcula el cambio: recibido − aplicado', () => {
    const r = planPayment({
      kind: 'DEPOSIT',
      balanceCents: 11_600,
      rows: [efectivo(5_800, 6_000)],
    });
    expect(r.ok && r.value.changeCents).toBe(200);
    expect(r.ok && r.value.appliedCents).toBe(5_800);
    expect(r.ok && r.value.balanceAfterCents).toBe(5_800);
  });

  it('recibir menos de lo que se aplica se rechaza', () => {
    expect(
      planPayment({ kind: 'DEPOSIT', balanceCents: 11_600, rows: [efectivo(5_800, 5_000)] }),
    ).toEqual(err({ code: 'CASH_RECEIVED_INVALID' }));
  });

  it('en efectivo hay que decir cuánto se recibió', () => {
    expect(
      planPayment({
        kind: 'DEPOSIT',
        balanceCents: 11_600,
        rows: [{ method: 'CASH', amountCents: 5_800 }],
      }),
    ).toEqual(err({ code: 'CASH_RECEIVED_INVALID' }));
  });
});

describe('planPayment · transferencia', () => {
  it('guarda la referencia si la hay y no exige confirmación (PD-43)', () => {
    const r = planPayment({
      kind: 'DEPOSIT',
      balanceCents: 11_600,
      rows: [transferencia(5_800, ' SPEI 123 ')],
    });
    expect(r.ok && r.value.rows[0]?.reference).toBe('SPEI 123');
    const sin = planPayment({
      kind: 'DEPOSIT',
      balanceCents: 11_600,
      rows: [transferencia(5_800)],
    });
    expect(sin.ok && sin.value.rows[0]?.reference).toBeNull();
  });

  it('una transferencia no lleva efectivo recibido', () => {
    expect(
      planPayment({
        kind: 'DEPOSIT',
        balanceCents: 11_600,
        rows: [{ method: 'TRANSFER', amountCents: 5_800, cashReceivedCents: 5_800 }],
      }),
    ).toEqual(err({ code: 'CASH_RECEIVED_INVALID' }));
  });
});

describe('planPayment · reglas del cobro', () => {
  it('un pago mixto suma las dos formas: efectivo + transferencia', () => {
    const r = planPayment({
      kind: 'BALANCE',
      balanceCents: 10_000,
      rows: [efectivo(4_000, 5_000), transferencia(6_000, 'REF')],
    });
    expect(r.ok && r.value.appliedCents).toBe(10_000);
    expect(r.ok && r.value.changeCents).toBe(1_000);
    expect(r.ok && r.value.balanceAfterCents).toBe(0);
  });

  it('un pago mayor al saldo se rechaza', () => {
    expect(
      planPayment({ kind: 'BALANCE', balanceCents: 5_000, rows: [transferencia(5_001)] }),
    ).toEqual(err({ code: 'EXCEEDS_BALANCE' }));
  });

  it('sin saldo no hay nada que cobrar', () => {
    expect(planPayment({ kind: 'BALANCE', balanceCents: 0, rows: [transferencia(1)] })).toEqual(
      err({ code: 'NOTHING_DUE' }),
    );
  });

  it('un cobro vacío, de cero o con decimales se rechaza', () => {
    expect(planPayment({ kind: 'DEPOSIT', balanceCents: 100, rows: [] })).toEqual(
      err({ code: 'EMPTY' }),
    );
    expect(planPayment({ kind: 'DEPOSIT', balanceCents: 100, rows: [transferencia(0)] })).toEqual(
      err({ code: 'AMOUNT_INVALID' }),
    );
    expect(planPayment({ kind: 'DEPOSIT', balanceCents: 100, rows: [transferencia(1.5)] })).toEqual(
      err({ code: 'AMOUNT_INVALID' }),
    );
  });

  it('una venta de mostrador se paga completa: no hay anticipo', () => {
    expect(
      planPayment({ kind: 'SALE', balanceCents: 10_000, rows: [transferencia(5_000)] }),
    ).toEqual(err({ code: 'MUST_COVER_BALANCE' }));
    const completa = planPayment({
      kind: 'SALE',
      balanceCents: 10_000,
      rows: [efectivo(10_000, 20_000)],
    });
    expect(completa.ok && completa.value.changeCents).toBe(10_000);
  });

  it('propiedad: aplicado + saldo restante siempre es el saldo inicial, y el cambio nunca es negativo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 0, max: 50_000 }),
        (saldo, aplicado, extra) => {
          const r = planPayment({
            kind: 'BALANCE',
            balanceCents: saldo,
            rows: [efectivo(aplicado, aplicado + extra)],
          });
          if (aplicado > saldo) {
            expect(r.ok).toBe(false);
          } else {
            expect(r.ok).toBe(true);
            if (r.ok) {
              expect(r.value.appliedCents + r.value.balanceAfterCents).toBe(saldo);
              expect(r.value.changeCents).toBe(extra);
            }
          }
        },
      ),
    );
  });
});

describe('tipo de cobro de una orden', () => {
  it('el primero es anticipo; los siguientes, saldo', () => {
    expect(paymentKindForOrder(0)).toBe('DEPOSIT');
    expect(paymentKindForOrder(1)).toBe('BALANCE');
  });
});
