import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  asId,
  buildCustomer,
  err,
  fixedClock,
  inMemoryAuditLog,
  inMemoryCustomers,
  inMemorySyncOutbox,
  NO_FISCAL_PROFILE,
  outboxCashShiftStore,
  outboxPaymentStore,
  outboxQuoteStore,
  outboxWorkOrderStore,
  PAYMENTS_COLLECTION,
  seededRandom,
  WORK_ORDERS_COLLECTION,
  type ManageCustomersDeps,
  type OrderDeps,
} from '@zammir/core';

import { Ordenes, type OrdenesProps } from '../modules/orders/ui/Ordenes';
import { systemClock } from '../shared/infra/system-clock';
import { uuidIdGenerator } from '../shared/infra/uuid-id-generator';
import { ADMIN, CAJERO } from './MuestraDelMostrador';

/** Muestra de Órdenes SOLO para desarrollo (`/muestras/ordenes`): órdenes en cada estatus, con anticipos y un
 *  saldo por cobrar. */
const CLIENTES: readonly [string, string, string][] = [
  ['00000000-0000-4000-8000-00000000c001', 'Ana López', '5512345678'],
  ['00000000-0000-4000-8000-00000000c002', 'Arq. Raúl Medina', '5587654321'],
  ['00000000-0000-4000-8000-00000000c003', 'Carpintería Los Pinos', '5544332211'],
];

export async function armarOrdenes(): Promise<OrdenesProps> {
  const outbox = inMemorySyncOutbox({ clock: systemClock });
  const ids = uuidIdGenerator;
  const turnos = outboxCashShiftStore(outbox);
  const deps: OrderDeps = {
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
    shifts: turnos,
    outbox,
    idGenerator: ids,
    clock: systemClock,
    random: seededRandom(31),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: { depositPercentBps: 5_000, requireDepositToStart: true, warrantyMonthsDefault: 12 },
  };

  const customers = inMemoryCustomers({
    clock: fixedClock(new Date()),
    idGenerator: ids,
    auditLog: inMemoryAuditLog(),
  });
  for (const [id, name, phone] of CLIENTES) {
    const c = buildCustomer(asId<'Customer'>(id), {
      name,
      phone,
      email: null,
      notes: null,
      fiscal: NO_FISCAL_PROFILE,
      privacyNoticeVersion: null,
    });
    if (c.ok) {
      await customers.create(c.value);
    }
  }
  const clientes: ManageCustomersDeps = { customers, idGenerator: ids };

  const hace = (dias: number): string => new Date(Date.now() - dias * 86_400_000).toISOString();
  const ordenes = [
    ['WAITING', 0, 'Vidrio claro 6 mm · 120 cm × 80 cm × 2', 107_520, 0, 1],
    ['IN_PROCESS', 1, 'Cancel de baño fijo', 232_000, 116_000, 2],
    ['READY', 2, 'Ventana corrediza 2 hojas', 348_000, 174_000, 5],
    ['DELIVERED', 0, 'Espejo 4 mm con biselado', 82_000, 82_000, 12],
    ['IN_PROCESS', 2, 'Puerta de aluminio con vidrio', 464_000, 232_000, 3],
  ] as const;
  let n = 0;
  for (const [status, cliente, concepto, total, pagado, dias] of ordenes) {
    n += 1;
    const id = `00000000-0000-4000-8000-0000000b${String(n).padStart(4, '0')}`;
    const emitida = hace(dias);
    await outbox.transaction((tx) =>
      tx.putDocument(WORK_ORDERS_COLLECTION, id, {
        id,
        status,
        customerId: CLIENTES[cliente]?.[0],
        quoteId: null,
        siteAddress: n === 2 ? 'Calle Hidalgo 12, Otumba' : null,
        description: null,
        lines: [
          {
            id: `${id}-l1`,
            productId: null,
            name: concepto.split(' · ')[0] ?? concepto,
            detail: concepto,
            quantity: 1,
            unitPriceCents: total,
            lineTotalCents: total,
          },
        ],
        subtotalCents: Math.round(total / 1.16),
        taxCents: total - Math.round(total / 1.16),
        totalCents: total,
        depositPercentBps: 5_000,
        depositRequiredCents: Math.round(total / 2),
        measuredBy: null,
        builtBy: null,
        installedBy: null,
        estimatedDeliveryDate: null,
        notes: null,
        tempFolio: `T1-${String(n).padStart(4, '0')}`,
        folio: `OT-2026-${String(n).padStart(4, '0')}`,
        publicCode: `ABCD${String(1000 + n)}`,
        issuedAt: emitida,
        deliveredAt: null,
        deliveredWithBalance: false,
        deliveryReason: null,
        deliveryAuthorizedBy: null,
        cancelledAt: null,
        cancelReason: null,
        cancelledFromStatus: null,
        cancelDepositPaidCents: null,
        userId: CAJERO,
        syncStatus: 'SENT',
        reviewReason: null,
        updatedAt: emitida,
      }),
    );
    if (pagado > 0) {
      const pago = {
        id: `00000000-0000-4000-8000-0000000c${String(n).padStart(4, '0')}`,
        groupId: `00000000-0000-4000-8000-0000000d${String(n).padStart(4, '0')}`,
        targetType: 'WORK_ORDER',
        targetId: id,
        kind: 'DEPOSIT',
        method: n % 2 === 0 ? 'TRANSFER' : 'CASH',
        amountCents: pagado,
        cashReceivedCents: n % 2 === 0 ? null : pagado,
        changeCents: n % 2 === 0 ? null : 0,
        reference: null,
        userId: CAJERO,
        deviceId: null,
        paidAt: emitida,
        cashShiftId: null,
      };
      await outbox.transaction((tx) => tx.putDocument(PAYMENTS_COLLECTION, pago.id, pago));
    }
  }

  // Historia de un mes en marcha (solo para ver las gráficas): cobros repartidos en los últimos 31 días,
  // más fuertes entre semana y con un empujón hoy, y varias cuentas viejas por cobrar.
  const azar = seededRandom(7);
  const ordenBase = `00000000-0000-4000-8000-0000000b0001`;
  let k = 100;
  for (let dia = 0; dia < 31; dia++) {
    const fecha = new Date(Date.now() - dia * 86_400_000);
    const finDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
    const cuantos = dia === 0 ? 5 : finDeSemana ? azar.nextInt(2) : 1 + azar.nextInt(3);
    for (let i = 0; i < cuantos; i++) {
      k += 1;
      const monto = (800 + azar.nextInt(5200)) * 100 + (dia === 0 ? 120_000 : 0);
      const pago = {
        id: `00000000-0000-4000-8000-0000000c${String(k).padStart(4, '0')}`,
        groupId: `00000000-0000-4000-8000-0000000d${String(k).padStart(4, '0')}`,
        targetType: 'WORK_ORDER',
        targetId: ordenBase,
        kind: 'DEPOSIT',
        method: azar.nextInt(10) < 6 ? 'CASH' : 'TRANSFER',
        amountCents: monto,
        cashReceivedCents: null,
        changeCents: null,
        reference: null,
        userId: azar.nextInt(10) < 6 ? CAJERO : ADMIN,
        deviceId: null,
        paidAt: new Date(fecha.getTime() - i * 3_600_000).toISOString(),
        cashShiftId: null,
      };
      await outbox.transaction((tx) => tx.putDocument(PAYMENTS_COLLECTION, pago.id, pago));
    }
  }
  // Cuentas por cobrar de distinta antigüedad
  for (const [dias, total] of [
    [4, 640_000],
    [9, 410_000],
    [16, 1_250_000],
    [27, 890_000],
    [41, 1_560_000],
    [58, 720_000],
  ] as const) {
    n += 1;
    const id = `00000000-0000-4000-8000-0000000b${String(n).padStart(4, '0')}`;
    const emitida = hace(dias);
    await outbox.transaction((tx) =>
      tx.putDocument(WORK_ORDERS_COLLECTION, id, {
        id,
        status: dias > 30 ? 'READY' : 'IN_PROCESS',
        customerId: CLIENTES[n % 3]?.[0],
        quoteId: null,
        siteAddress: null,
        description: null,
        lines: [
          {
            id: `${id}-l1`,
            productId: null,
            name: 'Trabajo a medida',
            detail: 'Trabajo a medida',
            quantity: 1,
            unitPriceCents: total,
            lineTotalCents: total,
          },
        ],
        subtotalCents: Math.round(total / 1.16),
        taxCents: total - Math.round(total / 1.16),
        totalCents: total,
        depositPercentBps: 5_000,
        depositRequiredCents: Math.round(total / 2),
        measuredBy: null,
        builtBy: null,
        installedBy: null,
        estimatedDeliveryDate: null,
        notes: null,
        tempFolio: `T1-${String(n).padStart(4, '0')}`,
        folio: `OT-2026-${String(n).padStart(4, '0')}`,
        publicCode: `ABCD${String(1000 + n)}`,
        issuedAt: emitida,
        deliveredAt: null,
        deliveredWithBalance: false,
        deliveryReason: null,
        deliveryAuthorizedBy: null,
        cancelledAt: null,
        cancelReason: null,
        cancelledFromStatus: null,
        cancelDepositPaidCents: null,
        userId: CAJERO,
        syncStatus: 'SENT',
        reviewReason: null,
        updatedAt: emitida,
      }),
    );
  }

  return {
    deps,
    actor: { userId: ADMIN, role: 'ADMIN' },
    clientes,
    personas: [
      { id: CAJERO, name: 'Beto Martínez' },
      { id: ADMIN, name: 'Luis Zambrano' },
    ],
    autorizacion: {
      administradores: () => Promise.resolve([{ id: ADMIN, name: 'Luis Zambrano' }]),
      autorizar: () => Promise.resolve(err({ code: 'AUTH_FAILED' as const })),
    },
    fotos: {
      listar: () => Promise.resolve([]),
      agregar: () => Promise.resolve(null),
    },
    onComprobante: () => Promise.resolve(null),
  };
}

export function MuestraDeOrdenes(): ReactElement {
  const [props, setProps] = useState<OrdenesProps | null>(null);
  useEffect(() => {
    void armarOrdenes().then(setProps);
  }, []);
  return props === null ? <p role="status">Armando la muestra…</p> : <Ordenes {...props} />;
}
