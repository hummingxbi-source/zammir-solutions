import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { createPriceRegistry, defaultRules } from '../../catalog/domain/pricing/registry';
import type { QuoteProduct } from '../../quotes/domain/quote-line';
import {
  addToTicket,
  EMPTY_TICKET,
  removeFromTicket,
  setTicketLinePrice,
  setTicketQuantity,
  ticketTotals,
  type Ticket,
} from './ticket';

const registro = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();
const deps = { registry: registro, taxRateBps: 1600 };

const precio = (c: number) => {
  const r = money(c);
  if (!r.ok) {
    throw new Error('dinero');
  }
  return r.value;
};

const vidrio: QuoteProduct = {
  id: asId<'Product'>('p-vidrio'),
  name: 'Vidrio claro 6 mm',
  chargeUnit: 'SQUARE_METER',
  listPrice: precio(28_000),
  isTaxExempt: false,
  ruleId: 'AREA',
  ruleParams: {},
};
const pieza: QuoteProduct = {
  ...vidrio,
  id: asId<'Product'>('p-pieza'),
  name: 'Chapa de baño',
  chargeUnit: 'PIECE',
  listPrice: precio(11_600),
  ruleId: 'PIECE',
};
const servicio: QuoteProduct = {
  ...vidrio,
  id: asId<'Product'>('p-serv'),
  name: 'Instalación',
  chargeUnit: 'SERVICE',
  listPrice: precio(50_000),
  ruleId: 'SERVICE',
};

let n = 0;
const entrada = (extra: Partial<Parameters<typeof addToTicket>[2]> = {}) => {
  n += 1;
  return {
    id: `l-${String(n)}`,
    widthMm: null,
    heightMm: null,
    quantity: 1,
    displayUnit: 'cm' as const,
    ...extra,
  };
};

function con(...pasos: [QuoteProduct, Partial<Parameters<typeof addToTicket>[2]>][]): Ticket {
  let t = EMPTY_TICKET;
  for (const [p, e] of pasos) {
    const r = addToTicket(t, p, entrada(e), deps);
    if (!r.ok) {
      throw new Error(`no se agregó: ${r.error.code}`);
    }
    t = r.value;
  }
  return t;
}

describe('ticket actual del mostrador', () => {
  it('un ticket vacío vale cero', () => {
    expect(ticketTotals(EMPTY_TICKET)).toEqual({ subtotalCents: 0, taxCents: 0, totalCents: 0 });
  });

  it('piezas, servicios y vidrio a medida se calculan con las reglas de precio', () => {
    const t = con(
      [pieza, { quantity: 2 }],
      [servicio, {}],
      [vidrio, { widthMm: 1200, heightMm: 800, quantity: 2 }],
    );
    expect(t.lines.map((l) => l.lineTotalCents)).toEqual([23_200, 50_000, 53_760]);
    expect(ticketTotals(t).totalCents).toBe(126_960);
    expect(t.lines[2]?.detail).toContain('1.92 m²');
  });

  it('el IVA sale desglosado y subtotal + IVA es el total', () => {
    const t = con([pieza, { quantity: 3 }]);
    const r = ticketTotals(t);
    expect(r.subtotalCents + r.taxCents).toBe(r.totalCents);
    expect(r.totalCents).toBe(34_800);
  });

  it('cambiar una cantidad actualiza el importe de la línea y el total', () => {
    const t = con([pieza, {}]);
    const id = t.lines[0]?.id ?? '';
    const r = setTicketQuantity(t, id, 5, deps);
    expect(r.ok && r.value.lines[0]?.lineTotalCents).toBe(58_000);
    expect(r.ok && ticketTotals(r.value).totalCents).toBe(58_000);
  });

  it('una cantidad que no es entera o es menor a uno se rechaza', () => {
    const t = con([pieza, {}]);
    const id = t.lines[0]?.id ?? '';
    for (const mala of [0, -1, 1.5, Number.NaN]) {
      const r = setTicketQuantity(t, id, mala, deps);
      expect(!r.ok && r.error.code).toBe('QUANTITY_INVALID');
    }
    const falsa = setTicketQuantity(t, 'no-existe', 2, deps);
    expect(!falsa.ok && falsa.error.code).toBe('LINE_NOT_FOUND');
  });

  it('el mismo producto con las mismas medidas suma cantidad; con otras medidas es otra línea', () => {
    const mismo = con([pieza, { quantity: 1 }], [pieza, { quantity: 2 }]);
    expect(mismo.lines).toHaveLength(1);
    expect(mismo.lines[0]?.quantity).toBe(3);
    const medidas = con(
      [vidrio, { widthMm: 1000, heightMm: 1000 }],
      [vidrio, { widthMm: 1000, heightMm: 1200 }],
    );
    expect(medidas.lines).toHaveLength(2);
  });

  it('productos distintos con las mismas medidas no se mezclan', () => {
    const t = con([pieza, {}], [servicio, {}]);
    expect(t.lines).toHaveLength(2);
    expect(t.lines.map((l) => l.name)).toEqual(['Chapa de baño', 'Instalación']);
  });

  it('el mismo vidrio con otro ancho, o con otro alto, es otra línea', () => {
    const base = con([vidrio, { widthMm: 1000, heightMm: 1000 }]);
    const otroAncho = addToTicket(base, vidrio, entrada({ widthMm: 1200, heightMm: 1000 }), deps);
    const otroAlto = addToTicket(base, vidrio, entrada({ widthMm: 1000, heightMm: 1200 }), deps);
    const igual = addToTicket(base, vidrio, entrada({ widthMm: 1000, heightMm: 1000 }), deps);
    expect(otroAncho.ok && otroAncho.value.lines).toHaveLength(2);
    expect(otroAlto.ok && otroAlto.value.lines).toHaveLength(2);
    expect(igual.ok && igual.value.lines).toHaveLength(1);
  });

  it('una pieza con medidas y la misma sin ellas no se mezclan', () => {
    const conMedidas = con([vidrio, { widthMm: 1000, heightMm: 1000 }]);
    const sinMedidas = addToTicket(
      conMedidas,
      vidrio,
      entrada({ widthMm: null, heightMm: null }),
      deps,
    );
    expect(sinMedidas.ok).toBe(false);
  });

  it('el mismo producto a otro precio es otra línea', () => {
    const barato: QuoteProduct = { ...pieza, listPrice: precio(10_000) };
    const t = con([pieza, {}], [barato, {}]);
    expect(t.lines).toHaveLength(2);
    expect(t.lines.map((l) => l.unitPriceCents)).toEqual([11_600, 10_000]);
  });

  it('una cantidad de uno es válida y cambiar una línea no toca las demás', () => {
    const t = con([pieza, { quantity: 4 }], [servicio, { quantity: 2 }]);
    const [a, b] = t.lines;
    const r = setTicketQuantity(t, a?.id ?? '', 1, deps);
    expect(r.ok && r.value.lines[0]?.quantity).toBe(1);
    expect(r.ok && r.value.lines[1]).toEqual(b);
  });

  it('quitar una línea la saca del ticket y del total', () => {
    const t = con([pieza, {}], [servicio, {}]);
    const sin = removeFromTicket(t, t.lines[0]?.id ?? '');
    expect(sin.lines).toHaveLength(1);
    expect(ticketTotals(sin).totalCents).toBe(50_000);
  });

  it('una medida inválida para el producto se rechaza y el ticket no cambia', () => {
    const r = addToTicket(EMPTY_TICKET, vidrio, entrada({ widthMm: null, heightMm: null }), deps);
    expect(r.ok).toBe(false);
  });

  it('propiedad: el total del ticket es siempre la suma de sus líneas, al centavo', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 8 }),
        (cantidades) => {
          let t = EMPTY_TICKET;
          cantidades.forEach((q, i) => {
            const r = addToTicket(
              t,
              i % 2 === 0 ? pieza : servicio,
              entrada({ quantity: q }),
              deps,
            );
            if (r.ok) {
              t = r.value;
            }
          });
          const suma = t.lines.reduce((s, l) => s + l.lineTotalCents, 0);
          const r = ticketTotals(t);
          expect(r.totalCents).toBe(suma);
          expect(r.subtotalCents + r.taxCents).toBe(r.totalCents);
        },
      ),
    );
  });
});

describe('precio abierto en el mostrador [RF-M1-10, ADR-0048]', () => {
  const reparacion: QuoteProduct = {
    id: asId<'Product'>('p-reparacion'),
    name: 'Reparación de ventana',
    chargeUnit: 'SERVICE',
    listPrice: precio(50_000),
    isTaxExempt: false,
    ruleId: 'SERVICE',
    ruleParams: {},
    isOpenPrice: true,
  };
  const conReparacion = () => {
    const r = addToTicket(
      EMPTY_TICKET,
      reparacion,
      { id: 'l1', widthMm: null, heightMm: null, quantity: 1, displayUnit: 'cm' },
      deps,
    );
    if (!r.ok) throw new Error('ticket');
    return r.value;
  };

  it('fija un precio arriba de la referencia y recalcula el total', () => {
    const r = setTicketLinePrice(conReparacion(), 'l1', 75_000, deps);
    expect(r.ok && r.value.lines[0]?.unitPriceCents).toBe(75_000);
    expect(r.ok && ticketTotals(r.value).totalCents).toBe(75_000);
  });

  it('no baja de la referencia: los descuentos se dan en el cotizador con PIN', () => {
    const r = setTicketLinePrice(conReparacion(), 'l1', 49_999, deps);
    expect(!r.ok && r.error.code).toBe('PRICE_INVALID');
  });

  it('no cambia el precio de un producto de precio fijo', () => {
    const t = addToTicket(
      EMPTY_TICKET,
      vidrio,
      { id: 'l2', widthMm: 1000, heightMm: 1000, quantity: 1, displayUnit: 'cm' },
      deps,
    );
    if (!t.ok) throw new Error('ticket');
    const r = setTicketLinePrice(t.value, 'l2', 30_000, deps);
    expect(!r.ok && r.error.code).toBe('PRICE_INVALID');
  });

  it('avisa si la línea ya no está en el ticket', () => {
    const r = setTicketLinePrice(conReparacion(), 'otra', 60_000, deps);
    expect(!r.ok && r.error.code).toBe('LINE_NOT_FOUND');
  });

  it('el mismo producto con otro precio fijado no se suma a la línea anterior', () => {
    const fijado = setTicketLinePrice(conReparacion(), 'l1', 75_000, deps);
    if (!fijado.ok) throw new Error('precio');
    const r = addToTicket(
      fijado.value,
      reparacion,
      { id: 'l3', widthMm: null, heightMm: null, quantity: 1, displayUnit: 'cm' },
      deps,
    );
    expect(r.ok && r.value.lines.length).toBe(2);
  });
});
