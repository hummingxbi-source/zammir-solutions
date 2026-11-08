import { describe, expect, it } from 'vitest';

import { fixedClock } from '../shared-kernel/clock';
import { asId } from '../shared-kernel/id';
import { money } from '../shared-kernel/money/money';
import { seededRandom } from '../shared-kernel/random';
import type { SellableProduct } from '../modules/catalog/application/ports';
import { createPriceRegistry, defaultRules } from '../modules/catalog/domain/pricing/registry';
import { outboxCashShiftStore } from '../modules/cash/application/cash-shift-store';
import {
  closeCashShift,
  dayReport,
  openCashShift,
  visibleShifts,
  type CashDeps,
} from '../modules/cash/application/cash-use-cases';
import { outboxCounterSaleStore } from '../modules/counter/application/counter-sale-store';
import type { Authorization } from '../modules/identity/application/authorize-with-admin-pin';
import { defaultPermissionPolicy, isPermitted } from '../modules/identity/domain/permissions';
import { outboxPaymentStore } from '../modules/orders/application/work-order-store';
import { outboxQuoteStore } from '../modules/quotes/application/quote-store';
import {
  addQuoteLine,
  applyQuoteDiscount,
  createQuoteDraft,
  type IssueQuoteDeps,
  type QuoteActor,
} from '../modules/quotes/application/quote-use-cases';
import { inMemorySyncOutbox } from '../modules/sync/application/in-memory-sync-outbox';

/** E8 · Permisos, segunda parte (Sprint 4) [PRUEBAS_DE_ACEPTACION.md]: el cajero no ve reportes ni cuentas por
 *  cobrar, no cambia precios por su cuenta y no ve ni cierra los cortes de otras personas; un administrador sí.
 *  Se prueba con los casos de uso reales, no con la matriz sola. La primera parte (catálogo, personas y
 *  privacidad) está en `e8-permisos.test.ts`; las pantallas de reportes y cuentas por cobrar que se niegan al
 *  cajero las prueban `reportes.test.tsx` y `cuentas-por-cobrar.test.tsx`. */

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

const ADMIN_ID = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');
const ana: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};
const beto: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a002'),
  role: 'STAFF',
};
const admin: QuoteActor = { userId: ADMIN_ID, role: 'ADMIN' };
const tabletSola: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000d001'),
  role: null,
};

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador + 90000).padStart(12, '0')}`);
  },
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

function entorno() {
  const clock = fixedClock(new Date('2026-11-12T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock });
  const dispositivo = { id: '00000000-0000-4000-8000-0000000000d1', series: 1 };
  const cotizaciones: IssueQuoteDeps = {
    store: outboxQuoteStore(outbox),
    idGenerator: ids,
    clock,
    registry: registro,
    taxRateBps: 1600,
    outbox,
    random: seededRandom(5),
    device: dispositivo,
    settings: {
      validityDays: 15,
      conditionsText: 'Condiciones de prueba',
      privacyNoticeVersion: 1,
      catalogVersion: 1,
    },
  };
  const caja: CashDeps = {
    outbox,
    idGenerator: ids,
    clock,
    device: dispositivo,
    shifts: outboxCashShiftStore(outbox),
    payments: outboxPaymentStore(outbox),
    sales: outboxCounterSaleStore(outbox),
  };
  return { cotizaciones, caja };
}

async function cotizacionConVidrio(e: ReturnType<typeof entorno>) {
  const q = await createQuoteDraft(e.cotizaciones, ana, {
    customerId: asId<'Customer'>('00000000-0000-4000-8000-00000000c001'),
  });
  if (!q.ok) throw new Error('borrador');
  const l = await addQuoteLine(e.cotizaciones, ana, q.value.id, vidrio, {
    widthMm: 1000,
    heightMm: 1000,
    quantity: 1,
    displayUnit: 'cm',
  });
  if (!l.ok) throw new Error('línea');
  return l.value;
}

describe('E8 · reportes y cuentas por cobrar', () => {
  it('el cajero no los ve; el administrador sí', () => {
    expect(defaultPermissionPolicy.check('STAFF', 'REPORTS_AND_RECEIVABLES')).toBe('DENY');
    expect(isPermitted(defaultPermissionPolicy.check('ADMIN', 'REPORTS_AND_RECEIVABLES'))).toBe(
      true,
    );
  });

  it('la tablet sin persona (nadie ha entrado con su PIN) tampoco', () => {
    expect(defaultPermissionPolicy.check(null, 'REPORTS_AND_RECEIVABLES')).toBe('DENY');
    expect(defaultPermissionPolicy.check('DEVICE', 'REPORTS_AND_RECEIVABLES')).toBe('DENY');
  });
});

describe('E8 · precios', () => {
  const conPin = (): Authorization => ({
    adminId: ADMIN_ID,
    authorizedAt: new Date('2026-11-12T18:00:00.000Z'),
  });

  it('el cajero no cambia un precio por su cuenta: el precio de catálogo no se mueve', async () => {
    const e = entorno();
    const q = await cotizacionConVidrio(e);
    const r = await applyQuoteDiscount(e.cotizaciones, ana, q.id, q.lines[0]?.id ?? '', 25_000);
    expect(!r.ok && r.error.code).toBe('AUTHORIZATION_REQUIRED');
    expect((await e.cotizaciones.store.get(q.id))?.lines[0]?.unitPriceCents).toBe(28_000);
  });

  it('con el PIN de un administrador sí, y queda quién autorizó', async () => {
    const e = entorno();
    const q = await cotizacionConVidrio(e);
    const r = await applyQuoteDiscount(
      e.cotizaciones,
      ana,
      q.id,
      q.lines[0]?.id ?? '',
      25_000,
      conPin(),
    );
    expect(r.ok && r.value.lines[0]?.unitPriceCents).toBe(25_000);
    expect(r.ok && r.value.discountAuthorizedBy).toBe(ADMIN_ID);
  });

  it('un administrador lo hace sin pedir nada más', async () => {
    const e = entorno();
    const q = await cotizacionConVidrio(e);
    const r = await applyQuoteDiscount(e.cotizaciones, admin, q.id, q.lines[0]?.id ?? '', 26_000);
    expect(r.ok).toBe(true);
  });

  it('ni siquiera con PIN se puede poner un precio mayor al del catálogo', async () => {
    const e = entorno();
    const q = await cotizacionConVidrio(e);
    const r = await applyQuoteDiscount(
      e.cotizaciones,
      ana,
      q.id,
      q.lines[0]?.id ?? '',
      30_000,
      conPin(),
    );
    expect(!r.ok && r.error.code).toBe('PRICE_INVALID');
  });

  it('la tablet sin persona no cambia precios', async () => {
    const e = entorno();
    const q = await cotizacionConVidrio(e);
    const r = await applyQuoteDiscount(
      e.cotizaciones,
      tabletSola,
      q.id,
      q.lines[0]?.id ?? '',
      25_000,
      conPin(),
    );
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });
});

describe('E8 · cortes de caja ajenos', () => {
  async function dosTurnos() {
    const e = entorno();
    const tAna = await openCashShift(e.caja, ana, { openingFloatCents: 50_000 });
    const tBeto = await openCashShift(e.caja, beto, { openingFloatCents: 20_000 });
    if (!tAna.ok || !tBeto.ok) throw new Error('turnos');
    return { e, tAna: tAna.value, tBeto: tBeto.value };
  }

  it('el cajero solo ve su propio turno; el administrador ve todos', async () => {
    const { e, tAna } = await dosTurnos();
    expect((await visibleShifts(e.caja, ana)).map((t) => t.id)).toEqual([tAna.id]);
    expect(await visibleShifts(e.caja, admin)).toHaveLength(2);
  });

  it('el cajero no cierra el corte de otra persona; el administrador sí', async () => {
    const { e, tAna } = await dosTurnos();
    const ajeno = await closeCashShift(e.caja, beto, tAna.id, 50_000);
    expect(!ajeno.ok && ajeno.error.code).toBe('NOT_AUTHORIZED');
    expect((await e.caja.shifts.get(tAna.id))?.status).toBe('OPEN');
    const propio = await closeCashShift(e.caja, ana, tAna.id, 50_000);
    expect(propio.ok).toBe(true);
  });

  it('el corte consolidado del día es solo de administradores', async () => {
    const { e } = await dosTurnos();
    const comoCajero = await dayReport(e.caja, ana);
    expect(!comoCajero.ok && comoCajero.error.code).toBe('NOT_AUTHORIZED');
    const comoAdmin = await dayReport(e.caja, admin);
    expect(comoAdmin.ok && comoAdmin.value.shiftCount).toBe(2);
  });

  it('quien no ha entrado con su PIN no abre ni cierra turnos', async () => {
    const e = entorno();
    const r = await openCashShift(e.caja, tabletSola);
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });
});
