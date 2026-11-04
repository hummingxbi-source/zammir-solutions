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
