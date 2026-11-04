import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  addToTicket,
  asId,
  buildCustomer,
  chargeCounterSale,
  createPriceRegistry,
  defaultRules,
  EMPTY_TICKET,
  err,
  fixedClock,
  inMemoryCustomers,
  inMemoryAuditLog,
  inMemorySyncOutbox,
  money,
  NO_FISCAL_PROFILE,
  ok,
  openCashShift,
  outboxCashShiftStore,
  outboxCounterSaleStore,
  outboxPaymentStore,
  outboxQuoteStore,
  outboxWorkOrderStore,
  seededRandom,
  sequentialIdGenerator,
  WORK_ORDERS_COLLECTION,
  type ManageCustomersDeps,
  type ProductReader,
  type QuoteActor,
  type SellableProduct,
} from '@zammir/core';

import { Mostrador, type MostradorProps } from '../modules/counter/ui/Mostrador';
import { systemClock } from '../shared/infra/system-clock';
import { uuidIdGenerator } from '../shared/infra/uuid-id-generator';

/** Página de muestras SOLO para desarrollo (`/muestras`): arma el Mostrador con datos de ejemplo guardados en
 *  memoria para revisar cómo se ve sin registrar una tablet. No existe en la versión que se instala. */

const precio = (centavos: number) => {
  const m = money(centavos);
  if (!m.ok) {
    throw new Error('dinero');
  }
  return m.value;
};

const base = {
  categoryId: asId<'Category'>('c-1'),
  isTaxExempt: false,
  ruleParams: {},
} as const;

export const PRODUCTOS: readonly SellableProduct[] = [
  {
    ...base,
    id: asId<'Product'>('00000000-0000-4000-8000-00000000f001'),
    code: 'VC-6',
    name: 'Vidrio claro 6 mm',
    kind: 'CUSTOM',
    chargeUnit: 'SQUARE_METER',
    listPrice: precio(28_000),
    ruleId: 'AREA',
  },
  {
    ...base,
    id: asId<'Product'>('00000000-0000-4000-8000-00000000f002'),
    code: 'CH',
    name: 'Chapa de baño',
    kind: 'STANDARD',
    chargeUnit: 'PIECE',
    listPrice: precio(11_600),
    ruleId: 'PIECE',
  },
  {
    ...base,
    id: asId<'Product'>('00000000-0000-4000-8000-00000000f003'),
    code: 'RE',
    name: 'Riel para corrediza',
    kind: 'STANDARD',
    chargeUnit: 'PIECE',
    listPrice: precio(34_800),
    ruleId: 'PIECE',
  },
  {
    ...base,
    id: asId<'Product'>('00000000-0000-4000-8000-00000000f004'),
    code: 'ES-4',
    name: 'Espejo 4 mm',
    kind: 'CUSTOM',
    chargeUnit: 'SQUARE_METER',
    listPrice: precio(41_000),
    ruleId: 'AREA',
  },
  {
    ...base,
    id: asId<'Product'>('00000000-0000-4000-8000-00000000f005'),
    code: 'IN',
    name: 'Instalación a domicilio',
    kind: 'SERVICE',
    chargeUnit: 'PIECE',
    listPrice: precio(58_000),
    ruleId: 'PIECE',
  },
];

export const CLIENTE = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
export const CAJERO = asId<'User'>('00000000-0000-4000-8000-00000000a001');
export const ADMIN = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');

async function armar(): Promise<MostradorProps> {
  const registro = createPriceRegistry(defaultRules);
  if (!registro.ok) {
    throw new Error('registro');
  }
  const reloj = systemClock;
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const ids = uuidIdGenerator;
  const comunes = {
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(11),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
  };
  const turnos = outboxCashShiftStore(outbox);
  const pagos = outboxPaymentStore(outbox);
  const ventas = outboxCounterSaleStore(outbox);
  const deps = { ...comunes, sales: ventas, payments: pagos, shifts: turnos };
  const orderDeps = {
    ...comunes,
    orders: outboxWorkOrderStore(outbox),
    payments: pagos,
    quotes: outboxQuoteStore(outbox),
    shifts: turnos,
    settings: {
      depositPercentBps: 5_000,
      requireDepositToStart: true,
      warrantyMonthsDefault: null,
    },
  };
  const cash = { ...comunes, shifts: turnos, payments: pagos, sales: ventas };

  const customers = inMemoryCustomers({
    clock: fixedClock(new Date()),
    idGenerator: sequentialIdGenerator('c'),
    auditLog: inMemoryAuditLog(),
  });
  const cliente = buildCustomer(CLIENTE, {
    name: 'Ana López',
    phone: '5512345678',
    email: null,
    notes: null,
    fiscal: NO_FISCAL_PROFILE,
    privacyNoticeVersion: null,
  });
  if (cliente.ok) {
    await customers.create(cliente.value);
  }
  const clientes: ManageCustomersDeps = { customers, idGenerator: ids };

  // Una orden con saldo por cobrar, para ver "Saldos de órdenes".
  const ahora = new Date().toISOString();
  await outbox.transaction((tx) =>
    tx.putDocument(WORK_ORDERS_COLLECTION, '00000000-0000-4000-8000-00000000b001', {
      id: '00000000-0000-4000-8000-00000000b001',
      status: 'IN_PROCESS',
      customerId: CLIENTE,
      quoteId: null,
      siteAddress: null,
      description: null,
      lines: [],
      subtotalCents: 100_000,
      taxCents: 16_000,
      totalCents: 116_000,
      depositPercentBps: 5_000,
      depositRequiredCents: 58_000,
      tempFolio: 'T1-0001',
      folio: 'OT-2026-0001',
      publicCode: 'ABCDEFGH',
      issuedAt: ahora,
      userId: CAJERO,
      syncStatus: 'SENT',
      reviewReason: null,
      updatedAt: ahora,
    }),
  );

  const cajero: QuoteActor = { userId: CAJERO, role: 'STAFF' };
  const turno = await openCashShift(cash, cajero, { openingFloatCents: 50_000 });
  if (turno.ok) {
    const linea = (producto: SellableProduct, cantidad: number) => {
      const r = addToTicket(
        EMPTY_TICKET,
        producto,
        {
          id: ids.newId<'Line'>(),
          widthMm: producto.chargeUnit === 'SQUARE_METER' ? 1200 : null,
          heightMm: producto.chargeUnit === 'SQUARE_METER' ? 800 : null,
          quantity: cantidad,
          displayUnit: 'cm',
        },
        { registry: registro.value, taxRateBps: 1600 },
      );
      return r.ok ? r.value : EMPTY_TICKET;
    };
    for (const [producto, n, metodo] of [
      [PRODUCTOS[1], 1, 'CASH'],
      [PRODUCTOS[2], 2, 'TRANSFER'],
      [PRODUCTOS[0], 1, 'CASH'],
    ] as const) {
      if (producto === undefined) {
        continue;
      }
      const ticket = linea(producto, n);
      const total = ticket.lines.reduce((s, l) => s + l.lineTotalCents, 0);
      await chargeCounterSale(deps, cajero, {
        ticket,
        customerId: null,
        rows: [
          metodo === 'CASH'
            ? { method: 'CASH', amountCents: total, cashReceivedCents: total }
            : { method: 'TRANSFER', amountCents: total },
        ],
      });
    }
  }

  const catalogo: ProductReader = {
    listSellable: () => Promise.resolve(ok(PRODUCTOS)),
    findSellable: (id) => {
      const p = PRODUCTOS.find((x) => x.id === id);
      return Promise.resolve(p === undefined ? err({ code: 'NOT_FOUND' as const }) : ok(p));
    },
  };

  return {
    deps,
    orderDeps,
    cash,
    personas: [
      { id: CAJERO, name: 'Beto Martínez' },
      { id: ADMIN, name: 'Luis Zambrano' },
    ],
    actor: cajero,
    catalogo,
    clientes,
    registry: registro.value,
    taxRateBps: 1600,
    autorizacion: {
      administradores: () => Promise.resolve([{ id: ADMIN, name: 'Luis Zambrano' }]),
      autorizar: () => Promise.resolve(err({ code: 'AUTH_FAILED' as const })),
    },
    impresion: {
      width: 32,
      business: { name: 'ZAMMIR (datos de prueba)', phone: null, address: null },
      selfInvoicingLegend: '',
      publicBaseUrl: null,
      estado: () => Promise.resolve({ state: 'READY', name: 'PT-210' }),
      conectar: () => Promise.resolve(null),
      imprimir: () => Promise.resolve({ via: 'Impresora Bluetooth' }),
    },
  };
}

export function MuestraDelMostrador(): ReactElement {
  const [props, setProps] = useState<MostradorProps | null>(null);
  useEffect(() => {
    void armar().then(setProps);
  }, []);
  return props === null ? <p role="status">Armando la muestra…</p> : <Mostrador {...props} />;
}
