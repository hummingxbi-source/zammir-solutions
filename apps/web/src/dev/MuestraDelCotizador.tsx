import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  addQuoteLine,
  asId,
  buildCustomer,
  createPriceRegistry,
  createQuoteDraft,
  defaultRules,
  err,
  fixedClock,
  inMemoryAuditLog,
  inMemoryCustomers,
  inMemorySyncOutbox,
  issueQuote,
  markQuote,
  NO_FISCAL_PROFILE,
  ok,
  outboxQuoteStore,
  seededRandom,
  type ManageCustomersDeps,
  type ProductReader,
  type QuoteActor,
} from '@zammir/core';

import { fakeDocumentRenderer } from '../modules/documents/infra/fake-document-renderer';
import { entornoDelNavegador, webShareService } from '../modules/documents/infra/web-share-service';
import { Cotizador, type CotizadorProps } from '../modules/quotes/ui/Cotizador';
import { systemClock } from '../shared/infra/system-clock';
import { uuidIdGenerator } from '../shared/infra/uuid-id-generator';
import { ADMIN, CAJERO, CLIENTE, PRODUCTOS } from './MuestraDelMostrador';

/** Muestra del Cotizador SOLO para desarrollo (`/muestras/cotizador`): una lista con un borrador y dos
 *  cotizaciones emitidas, guardadas en memoria. */
async function armar(): Promise<CotizadorProps> {
  const registro = createPriceRegistry(defaultRules);
  if (!registro.ok) {
    throw new Error('registro');
  }
  const outbox = inMemorySyncOutbox({ clock: systemClock });
  const ids = uuidIdGenerator;
  const customers = inMemoryCustomers({
    clock: fixedClock(new Date()),
    idGenerator: ids,
    auditLog: inMemoryAuditLog(),
  });
  const nuevos: [string, string, typeof CLIENTE | string][] = [
    ['Ana López', '5512345678', CLIENTE],
    ['Arq. Raúl Medina', '5587654321', '00000000-0000-4000-8000-00000000c002'],
  ];
  for (const [name, phone, id] of nuevos) {
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
  const deps = {
    store: outboxQuoteStore(outbox),
    idGenerator: ids,
    clock: systemClock,
    registry: registro.value,
    taxRateBps: 1600,
    outbox,
    random: seededRandom(21),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: {
      validityDays: 15,
      conditionsText:
        'Anticipo del 50 % para iniciar.\nLa vigencia de esta cotización es de 15 días.\nNo incluye obra civil.',
      privacyNoticeVersion: null,
      catalogVersion: 1,
    },
  };
  const actor: QuoteActor = { userId: CAJERO, role: 'STAFF' };
  const vidrio = PRODUCTOS[0];
  const chapa = PRODUCTOS[1];
  const espejo = PRODUCTOS[3];
  const medidas = { widthMm: 1200, heightMm: 800, quantity: 2, displayUnit: 'cm' as const };
  for (const [clienteId, producto, aceptar] of [
    [CLIENTE, vidrio, true],
    ['00000000-0000-4000-8000-00000000c002', espejo, false],
  ] as const) {
    if (producto === undefined) {
      continue;
    }
    const b = await createQuoteDraft(deps, actor, { customerId: asId<'Customer'>(clienteId) });
    if (b.ok) {
      await addQuoteLine(deps, actor, b.value.id, producto, medidas);
      if (chapa !== undefined) {
        await addQuoteLine(deps, actor, b.value.id, chapa, {
          widthMm: null,
          heightMm: null,
          quantity: 1,
          displayUnit: 'cm',
        });
      }
      const emitida = await issueQuote(deps, actor, b.value.id);
      if (emitida.ok && aceptar) {
        await markQuote(deps, actor, emitida.value.id, 'ACCEPTED');
      }
    }
  }
  const borrador = await createQuoteDraft(deps, actor, {
    customerId: asId<'Customer'>('00000000-0000-4000-8000-00000000c002'),
  });
  if (borrador.ok && vidrio !== undefined) {
    await addQuoteLine(deps, actor, borrador.value.id, vidrio, medidas);
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
    actor,
    catalogo,
    clientes,
    renderer: fakeDocumentRenderer(),
    share: webShareService(entornoDelNavegador()),
    negocio: {
      name: 'ZAMMIR (datos de prueba)',
      phone: '55 0000 0000',
      address: 'Otumba, Estado de México',
    },
    condicionesPorDefecto: deps.settings.conditionsText,
    autorizacion: {
      administradores: () => Promise.resolve([{ id: ADMIN, name: 'Luis Zambrano' }]),
      autorizar: () => Promise.resolve(err({ code: 'AUTH_FAILED' as const })),
    },
  };
}

export function MuestraDelCotizador(): ReactElement {
  const [props, setProps] = useState<CotizadorProps | null>(null);
  useEffect(() => {
    void armar().then(setProps);
  }, []);
  return props === null ? <p role="status">Armando la muestra…</p> : <Cotizador {...props} />;
}
