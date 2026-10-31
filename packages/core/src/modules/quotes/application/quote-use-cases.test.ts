import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { seededRandom } from '../../../shared-kernel/random';
import { createPriceRegistry, defaultRules } from '../../catalog/domain/pricing/registry';
import type { SellableProduct } from '../../catalog/application/ports';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import {
  applyQuoteDiscount,
  addQuoteLine,
  createQuoteDraft,
  duplicateQuote,
  issueQuote,
  markQuote,
  removeQuoteLine,
  updateQuoteHeader,
  updateQuoteLine,
  type IssueQuoteDeps,
  type QuoteActor,
} from './quote-use-cases';
import { outboxQuoteStore } from './quote-store';

const registro = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();

const precio = (c: number) => {
  const r = money(c);
  if (!r.ok) {
    throw new Error('dinero');
  }
  return r.value;
};

const vidrio: SellableProduct = {
  id: asId<'Product'>('00000000-0000-4000-8000-00000000f001'),
  code: 'VC-6',
  name: 'Vidrio claro 6 mm',
  categoryId: asId<'Category'>('c-1'),
  kind: 'CUSTOM',
  chargeUnit: 'SQUARE_METER',
  listPrice: precio(28_000),
  isTaxExempt: false,
  ruleId: 'AREA',
  ruleParams: {},
};
const instalacion: SellableProduct = {
  id: asId<'Product'>('00000000-0000-4000-8000-00000000f002'),
  code: 'INST',
  name: 'Instalación',
  categoryId: asId<'Category'>('c-11'),
  kind: 'SERVICE',
  chargeUnit: 'SERVICE',
  listPrice: precio(50_000),
  isTaxExempt: false,
  ruleId: 'SERVICE',
  ruleParams: {},
};

const cliente = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
const ana: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};
const luis: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a002'),
  role: 'ADMIN',
};

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`);
  },
};

function entorno(ahora = '2026-10-30T18:00:00.000Z') {
  let instante = new Date(ahora);
  const clock = { now: () => new Date(instante) };
  const outbox = inMemorySyncOutbox({ clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')) });
  const store = outboxQuoteStore(outbox);
  const deps: IssueQuoteDeps = {
    store,
    idGenerator: ids,
    clock,
    registry: registro,
    taxRateBps: 1600,
    outbox,
    random: seededRandom(5),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: {
      validityDays: 15,
      conditionsText: 'Condiciones de prueba',
      privacyNoticeVersion: 1,
      catalogVersion: 3,
    },
  };
  return { deps, outbox, store, mover: (nuevo: string) => (instante = new Date(nuevo)) };
}

async function borradorConVidrio(e: ReturnType<typeof entorno>, actor = ana) {
  const q = await createQuoteDraft(e.deps, actor, { customerId: cliente });
  if (!q.ok) throw new Error('borrador');
  const l = await addQuoteLine(e.deps, actor, q.value.id, vidrio, {
    widthMm: 1200,
    heightMm: 800,
    quantity: 2,
    displayUnit: 'cm',
  });
  if (!l.ok) throw new Error('línea');
  return l.value;
}

describe('borrador y líneas', () => {
  it('un borrador nace sin folio, sin líneas y con estado de borrador', async () => {
    const e = entorno();
    const q = await createQuoteDraft(e.deps, ana, { customerId: cliente, siteAddress: 'Calle 5' });
    expect(q.ok && q.value).toMatchObject({
      status: 'DRAFT',
      tempFolio: null,
      folio: null,
      publicCode: null,
      lines: [],
      syncStatus: 'DRAFT',
      siteAddress: 'Calle 5',
    });
    expect(await e.outbox.pendingCount()).toBe(0);
  });

  it('una línea a medida muestra el cálculo y su importe sale de la regla y del IVA', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const l = q.lines[0];
    // 120 cm × 80 cm × 2 = 1.92 m² × $280.00 = $537.60 (IVA incluido)
    expect(l?.lineTotalCents).toBe(53_760);
    expect(l?.baseCents).toBe(46_345); // 53 760 / 1.16 redondeado
    expect(l?.taxCents).toBe(7_415);
    expect((l?.baseCents ?? 0) + (l?.taxCents ?? 0)).toBe(l?.lineTotalCents);
    expect(l?.detail).toContain('1.92 m²');
    expect(l?.detail).toContain('$280.00');
    expect(l?.detail).toContain('$537.60');
    expect(l?.catalogPriceCents).toBe(28_000);
  });

  it('un servicio se cobra por su unidad', async () => {
    const e = entorno();
    const q = await createQuoteDraft(e.deps, ana, { customerId: cliente });
    if (!q.ok) throw new Error('x');
    const r = await addQuoteLine(e.deps, ana, q.value.id, instalacion, {
      widthMm: null,
      heightMm: null,
      quantity: 1,
      displayUnit: 'cm',
    });
    expect(r.ok && r.value.lines[0]?.lineTotalCents).toBe(50_000);
  });

  it('medidas inválidas no agregan la línea', async () => {
    const e = entorno();
    const q = await createQuoteDraft(e.deps, ana, { customerId: cliente });
    if (!q.ok) throw new Error('x');
    const r = await addQuoteLine(e.deps, ana, q.value.id, vidrio, {
      widthMm: null,
      heightMm: 800,
      quantity: 1,
      displayUnit: 'cm',
    });
    expect(!r.ok && r.error.code).toBe('INPUT_INVALID');
    expect((await e.store.get(q.value.id))?.lines).toHaveLength(0);
  });

  it('cambiar medidas o cantidad recalcula y conserva el precio', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const lineId = q.lines[0]?.id ?? '';
    const r = await updateQuoteLine(e.deps, ana, q.id, lineId, { quantity: 1 });
    expect(r.ok && r.value.lines[0]?.lineTotalCents).toBe(26_880);
    const inexistente = await updateQuoteLine(e.deps, ana, q.id, 'nada', { quantity: 1 });
    expect(!inexistente.ok && inexistente.error.code).toBe('LINE_NOT_FOUND');
  });

  it('quitar una línea la saca del borrador', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const r = await removeQuoteLine(e.deps, ana, q.id, q.lines[0]?.id ?? '');
    expect(r.ok && r.value.lines).toHaveLength(0);
    const otra = await removeQuoteLine(e.deps, ana, q.id, 'nada');
    expect(!otra.ok && otra.error.code).toBe('LINE_NOT_FOUND');
  });

  it('se puede cambiar el cliente y la dirección de la obra de un borrador', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const otro = asId<'Customer'>('00000000-0000-4000-8000-00000000c002');
    const r = await updateQuoteHeader(e.deps, ana, q.id, { customerId: otro, siteAddress: null });
    expect(r.ok && r.value.customerId).toBe(otro);
  });

  it('quien no puede cotizar (la tablet sin persona) no crea ni cambia nada', async () => {
    const e = entorno();
    const sinPersona: QuoteActor = { userId: ana.userId, role: 'DEVICE' };
    const r = await createQuoteDraft(e.deps, sinPersona, { customerId: cliente });
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });

  it('un borrador que no existe avisa', async () => {
    const e = entorno();
    const r = await addQuoteLine(e.deps, ana, asId<'Quote'>('nada'), vidrio, {
      widthMm: 1000,
      heightMm: 1000,
      quantity: 1,
      displayUnit: 'cm',
    });
    expect(!r.ok && r.error.code).toBe('NOT_FOUND');
  });
});

describe('descuentos con autorización [PD-45, RN-19]', () => {
  const autorizacion = (): Authorization => ({
    adminId: luis.userId,
    authorizedAt: new Date('2026-10-30T18:00:00.000Z'),
  });

  it('un cajero sin PIN de administrador no puede dar un descuento', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const r = await applyQuoteDiscount(e.deps, ana, q.id, q.lines[0]?.id ?? '', 25_000);
    expect(!r.ok && r.error.code).toBe('AUTHORIZATION_REQUIRED');
    expect((await e.store.get(q.id))?.lines[0]?.unitPriceCents).toBe(28_000);
  });

  it('con el PIN de un administrador el descuento se aplica, recalcula y guarda quién autorizó', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const r = await applyQuoteDiscount(
      e.deps,
      ana,
      q.id,
      q.lines[0]?.id ?? '',
      25_000,
      autorizacion(),
    );
    expect(r.ok && r.value.lines[0]?.unitPriceCents).toBe(25_000);
    expect(r.ok && r.value.lines[0]?.catalogPriceCents).toBe(28_000);
    expect(r.ok && r.value.lines[0]?.lineTotalCents).toBe(48_000);
    expect(r.ok && r.value.discountAuthorizedBy).toBe(luis.userId);
  });

  it('un administrador lo aplica sin pedir PIN y queda registrado como quien lo hizo', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e, luis);
    const r = await applyQuoteDiscount(e.deps, luis, q.id, q.lines[0]?.id ?? '', 20_000);
    expect(r.ok && r.value.discountAuthorizedBy).toBe(luis.userId);
  });

  it('el precio ajustado no puede ser negativo ni mayor que el del catálogo', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e, luis);
    const id = q.lines[0]?.id ?? '';
    const negativo = await applyQuoteDiscount(e.deps, luis, q.id, id, -1);
    const mayor = await applyQuoteDiscount(e.deps, luis, q.id, id, 28_001);
    expect(!negativo.ok && negativo.error.code).toBe('PRICE_INVALID');
    expect(!mayor.ok && mayor.error.code).toBe('PRICE_INVALID');
  });

  it('la tablet sin persona no puede dar descuentos', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const r = await applyQuoteDiscount(
      e.deps,
      { userId: ana.userId, role: 'DEVICE' },
      q.id,
      q.lines[0]?.id ?? '',
      20_000,
      autorizacion(),
    );
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });
});

describe('emitir la cotización [RN-03, RN-12, RN-13, RN-16]', () => {
  it('congela, da folio provisional y código público, calcula la vigencia y encola la operación', async () => {
    const e = entorno('2026-10-30T18:00:00.000Z');
    const q = await borradorConVidrio(e);
    const r = await issueQuote(e.deps, ana, q.id);
    expect(r.ok && r.value).toMatchObject({
      status: 'SENT',
      tempFolio: 'T1-0001',
      folio: null,
      validUntil: '2026-11-14',
      conditionsText: 'Condiciones de prueba',
      privacyNoticeVersion: 1,
      catalogVersion: 3,
      syncStatus: 'SAVED_ON_TABLET',
      issuedAt: '2026-10-30T18:00:00.000Z',
    });
    expect(r.ok && r.value.publicCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    const ops = await e.outbox.list();
    expect(ops).toHaveLength(1);
    expect(ops[0]?.envelope).toMatchObject({
      type: 'IssueQuote',
      userId: ana.userId,
      payload: {
        id: q.id,
        tempFolio: 'T1-0001',
        totalCents: 53_760,
        subtotalCents: 46_345,
        taxCents: 7_415,
      },
    });
  });

  it('el folio provisional avanza con cada emisión, compartido por todas las cotizaciones del dispositivo', async () => {
    const e = entorno();
    const folios: (string | null)[] = [];
    for (let i = 0; i < 3; i += 1) {
      const q = await borradorConVidrio(e);
      const r = await issueQuote(e.deps, ana, q.id);
      folios.push(r.ok ? r.value.tempFolio : null);
    }
    expect(folios).toEqual(['T1-0001', 'T1-0002', 'T1-0003']);
  });

  it('la vigencia se cuenta en hora de México: emitir a las 23:30 del 30 de octubre vence el 14 de noviembre', async () => {
    const e = entorno('2026-10-31T05:30:00.000Z'); // 23:30 del 30 de octubre en México
    const q = await borradorConVidrio(e);
    const r = await issueQuote(e.deps, ana, q.id);
    expect(r.ok && r.value.validUntil).toBe('2026-11-14');
  });

  it('el precio queda congelado: cambiar el catálogo después no cambia la cotización emitida', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const emitida = await issueQuote(e.deps, ana, q.id);
    if (!emitida.ok) throw new Error('x');
    // El catálogo cambia: otro precio para el mismo producto.
    const nuevoProducto = { ...vidrio, listPrice: precio(99_000) };
    expect(nuevoProducto.listPrice).not.toBe(vidrio.listPrice);
    const guardada = await e.store.get(q.id);
    expect(guardada?.lines[0]?.unitPriceCents).toBe(28_000);
    expect(guardada?.lines[0]?.lineTotalCents).toBe(53_760);
  });

  it('un descuento autorizado viaja en la operación (quién autorizó) y con el precio anterior', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    await applyQuoteDiscount(e.deps, ana, q.id, q.lines[0]?.id ?? '', 25_000, {
      adminId: luis.userId,
      authorizedAt: new Date('2026-10-30T18:00:00.000Z'),
    });
    await issueQuote(e.deps, ana, q.id);
    const op = (await e.outbox.list())[0]?.envelope;
    expect(op?.authorizedBy).toBe(luis.userId);
    const linea = (
      op?.payload as { lines: { unitPriceCents: number; catalogPriceCents: number }[] }
    ).lines[0];
    expect(linea).toMatchObject({ unitPriceCents: 25_000, catalogPriceCents: 28_000 });
  });

  it('sin líneas no se emite', async () => {
    const e = entorno();
    const q = await createQuoteDraft(e.deps, ana, { customerId: cliente });
    if (!q.ok) throw new Error('x');
    const r = await issueQuote(e.deps, ana, q.value.id);
    expect(!r.ok && r.error.code).toBe('EMPTY_QUOTE');
    expect(await e.outbox.pendingCount()).toBe(0);
  });

  it('una cotización ya emitida no se vuelve a emitir ni a editar', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    await issueQuote(e.deps, ana, q.id);
    const otra = await issueQuote(e.deps, ana, q.id);
    expect(!otra.ok && otra.error.code).toBe('NOT_EDITABLE');
    const edicion = await addQuoteLine(e.deps, ana, q.id, vidrio, {
      widthMm: 1000,
      heightMm: 1000,
      quantity: 1,
      displayUnit: 'cm',
    });
    expect(!edicion.ok && edicion.error.code).toBe('NOT_EDITABLE');
    expect(await e.outbox.pendingCount()).toBe(1);
  });
});

describe('estados [RF-M2-07]', () => {
  it('aceptada y rechazada salen como operaciones y son finales', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    await issueQuote(e.deps, ana, q.id);
    const aceptada = await markQuote(e.deps, ana, q.id, 'ACCEPTED');
    expect(aceptada.ok && aceptada.value.status).toBe('ACCEPTED');
    expect((await e.outbox.list()).map((o) => o.envelope.type)).toEqual([
      'IssueQuote',
      'MarkQuoteAccepted',
    ]);
    const otra = await markQuote(e.deps, ana, q.id, 'REJECTED');
    expect(!otra.ok && otra.error.code).toBe('INVALID_TRANSITION');
  });

  it('un borrador no se puede aceptar ni rechazar', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const r = await markQuote(e.deps, ana, q.id, 'ACCEPTED');
    expect(!r.ok && r.error.code).toBe('INVALID_TRANSITION');
    const nada = await markQuote(e.deps, ana, asId<'Quote'>('x'), 'ACCEPTED');
    expect(!nada.ok && nada.error.code).toBe('NOT_FOUND');
  });
});

describe('duplicar [RF-M2-09]', () => {
  it('crea un borrador nuevo sin folio con los mismos conceptos y los precios ACTUALES del catálogo', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    await issueQuote(e.deps, ana, q.id);
    const nuevoPrecio = { ...vidrio, listPrice: precio(30_000) };
    const r = await duplicateQuote(e.deps, ana, q.id, (id) =>
      Promise.resolve(id === vidrio.id ? nuevoPrecio : null),
    );
    expect(r.ok && r.value.quote.status).toBe('DRAFT');
    expect(r.ok && r.value.quote.tempFolio).toBeNull();
    expect(r.ok && r.value.quote.id).not.toBe(q.id);
    expect(r.ok && r.value.quote.lines[0]?.unitPriceCents).toBe(30_000);
    expect(r.ok && r.value.quote.lines[0]?.lineTotalCents).toBe(57_600);
    expect(r.ok && r.value.omitted).toEqual([]);
  });

  it('los productos que ya no se venden se omiten y se avisan', async () => {
    const e = entorno();
    const q = await borradorConVidrio(e);
    const r = await duplicateQuote(e.deps, ana, q.id, () => Promise.resolve(null));
    expect(r.ok && r.value.quote.lines).toHaveLength(0);
    expect(r.ok && r.value.omitted).toEqual(['Vidrio claro 6 mm']);
  });

  it('duplicar una que no existe avisa', async () => {
    const e = entorno();
    const r = await duplicateQuote(e.deps, ana, asId<'Quote'>('nada'), () => Promise.resolve(null));
    expect(!r.ok && r.error.code).toBe('NOT_FOUND');
  });
});

describe('almacén de cotizaciones', () => {
  it('lista por cliente de la más reciente a la más antigua y los borradores por persona', async () => {
    const e = entorno();
    const a = await borradorConVidrio(e);
    e.mover('2026-10-30T19:00:00.000Z');
    const b = await borradorConVidrio(e);
    e.mover('2026-10-30T20:00:00.000Z');
    await issueQuote(e.deps, ana, a.id);
    const delCliente = await e.store.listByCustomer(cliente);
    expect(delCliente.map((q) => q.id)).toEqual([a.id, b.id]);
    expect((await e.store.listDrafts(ana.userId)).map((q) => q.id)).toEqual([b.id]);
    expect(await e.store.listDrafts(luis.userId)).toEqual([]);
    expect(
      await e.store.listByCustomer(asId<'Customer'>('00000000-0000-4000-8000-00000000c003')),
    ).toEqual([]);
  });
});
