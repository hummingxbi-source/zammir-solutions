import type { Clock } from '../../../shared-kernel/clock';
import type { CustomerId, IdGenerator } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { SyncOutbox } from '../../sync/application/ports';
import { CURRENT_SCHEMA_VERSION, type UpsertCustomerPayload } from '../../sync/domain/operation';
import { NO_FISCAL_PROFILE, type Customer, type CustomerError } from '../domain/customer';
import type { CustomerRepository } from './ports';

export const CUSTOMERS_COLLECTION = 'customers';
const META_COLLECTION = 'customers-meta';
const CURSOR_ID = 'cursor';

/** Cómo se guarda un cliente en la tablet (sin fechas de objeto: viaja como texto). */
interface StoredCustomer {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly notes: string | null;
  readonly privacyNoticeVersion: number | null;
  readonly anonymizedAt: string | null;
}

function aGuardado(c: Customer): StoredCustomer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    privacyNoticeVersion: c.privacyNoticeVersion,
    anonymizedAt: c.anonymizedAt === null ? null : c.anonymizedAt.toISOString(),
  };
}

function aCliente(g: StoredCustomer): Customer {
  return {
    id: g.id as CustomerId,
    name: g.name,
    phone: g.phone,
    email: g.email,
    notes: g.notes,
    fiscal: NO_FISCAL_PROFILE,
    privacyNoticeVersion: g.privacyNoticeVersion,
    anonymizedAt: g.anonymizedAt === null ? null : new Date(g.anonymizedAt),
  };
}

export interface OutboxCustomersDeps {
  readonly outbox: SyncOutbox;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly device: { readonly id: string };
  /** Quién usa la tablet ahora (la persona que entró con su PIN); `null` si nadie. */
  readonly currentUserId: () => string | null;
}

/** Clientes de la tablet [S2-10, ADR-0023]: se guardan en la tablet y cada alta o corrección sale como
 *  operación `UpsertCustomer`, en el mismo paso, así que funcionan sin internet. Los datos fiscales no
 *  viven aquí [RNF-06] y anonimizar requiere a un administrador en línea. */
export function outboxCustomers(deps: OutboxCustomersDeps): CustomerRepository {
  async function guardar(cliente: Customer): Promise<Result<Customer, CustomerError>> {
    const userId = deps.currentUserId();
    if (userId === null) {
      return err({ code: 'NOT_AUTHORIZED' });
    }
    const carga: UpsertCustomerPayload = {
      id: cliente.id,
      name: cliente.name,
      phone: cliente.phone,
      email: cliente.email,
      notes: cliente.notes,
      privacyNoticeVersion: cliente.privacyNoticeVersion,
    };
    try {
      await deps.outbox.transaction(async (tx) => {
        const operacion = await tx.enqueue({
          opId: deps.idGenerator.newId<'Operation'>(),
          deviceId: deps.device.id,
          type: 'UpsertCustomer',
          schemaVersion: CURRENT_SCHEMA_VERSION,
          userId,
          clientCreatedAt: deps.clock.now().toISOString(),
          payload: carga,
        });
        if (!operacion.ok) {
          throw new Error('INVALID_OPERATION');
        }
        await tx.putDocument(CUSTOMERS_COLLECTION, cliente.id, aGuardado(cliente));
      });
    } catch {
      return err({ code: 'CUSTOMERS_UNAVAILABLE' });
    }
    return ok(cliente);
  }

  const todos = async (): Promise<readonly Customer[]> =>
    (
      (await deps.outbox.transaction((tx) =>
        tx.listDocuments(CUSTOMERS_COLLECTION),
      )) as readonly StoredCustomer[]
    ).map(aCliente);

  return {
    create: guardar,

    async update(cliente) {
      const actual = await deps.outbox.transaction((tx) =>
        tx.getDocument(CUSTOMERS_COLLECTION, cliente.id),
      );
      if (actual === undefined) {
        return err({ code: 'NOT_FOUND' });
      }
      if ((actual as StoredCustomer).anonymizedAt !== null) {
        return err({ code: 'ANONYMIZED' });
      }
      return guardar(cliente);
    },

    async get(id) {
      const g = await deps.outbox.transaction((tx) => tx.getDocument(CUSTOMERS_COLLECTION, id));
      return g === undefined ? err({ code: 'NOT_FOUND' }) : ok(aCliente(g as StoredCustomer));
    },

    async list() {
      return ok(await todos());
    },

    async findByPhone(telefono) {
      return ok((await todos()).filter((c) => c.phone === telefono));
    },

    // Anonimizar es de un administrador y requiere el servidor: desde la tablet no se ofrece.
    anonymize: () => Promise.resolve(err({ code: 'CUSTOMERS_UNAVAILABLE' })),
  };
}

/** Un cliente tal como baja del servidor, con su número de cambio. Sin datos fiscales [RNF-06]. */
export interface ReplicatedCustomer {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly notes: string | null;
  readonly privacyNoticeVersion: number | null;
  readonly anonymizedAt: string | null;
  readonly changeSeq: number;
}

export interface CustomerReplicaSource {
  /** Clientes nuevos o cambiados después de `seq`, en orden de cambio, hasta `limit`. */
  changedAfter(
    seq: number,
    limit: number,
  ): Promise<Result<readonly ReplicatedCustomer[], CustomerError>>;
}

export const CUSTOMER_REPLICA_PAGE_SIZE = 500;

/** Baja los clientes nuevos o cambiados y los guarda en la tablet. Un cliente con un cambio que aún no
 *  salió NO se sobrescribe (lo que se capturó en la tablet manda hasta enviarse, y luego el servidor
 *  tiene la última palabra por campo). Si falla a la mitad, lo guardado se queda y continúa desde ahí. */
export async function refreshCustomers(deps: {
  readonly source: CustomerReplicaSource;
  readonly outbox: SyncOutbox;
}): Promise<Result<{ readonly received: number }, CustomerError>> {
  let recibidos = 0;
  for (;;) {
    const desde = Number(
      (await deps.outbox.transaction((tx) => tx.getDocument(META_COLLECTION, CURSOR_ID))) ?? 0,
    );
    const pagina = await deps.source.changedAfter(desde, CUSTOMER_REPLICA_PAGE_SIZE);
    if (!pagina.ok) {
      return err(pagina.error);
    }
    if (pagina.value.length > 0) {
      const pendientes = new Set(
        (await deps.outbox.list())
          .filter((o) => o.status === 'PENDING' && o.envelope.type === 'UpsertCustomer')
          .map((o) => (o.envelope.payload as { readonly id?: string }).id),
      );
      const mayor = Math.max(...pagina.value.map((c) => c.changeSeq));
      await deps.outbox.transaction(async (tx) => {
        for (const c of pagina.value) {
          if (!pendientes.has(c.id)) {
            await tx.putDocument(CUSTOMERS_COLLECTION, c.id, {
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: c.email,
              notes: c.notes,
              privacyNoticeVersion: c.privacyNoticeVersion,
              anonymizedAt: c.anonymizedAt,
            } satisfies StoredCustomer);
          }
        }
        await tx.putDocument(META_COLLECTION, CURSOR_ID, mayor);
      });
      recibidos += pagina.value.length;
    }
    if (pagina.value.length < CUSTOMER_REPLICA_PAGE_SIZE) {
      break;
    }
  }
  return ok({ received: recibidos });
}
