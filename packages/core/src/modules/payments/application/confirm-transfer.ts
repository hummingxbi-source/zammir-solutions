import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { defaultPermissionPolicy, type PermissionPolicy } from '../../identity/domain/permissions';
import { PAYMENTS_COLLECTION } from '../../orders/application/work-order-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { SyncOutbox } from '../../sync/application/ports';
import { CURRENT_SCHEMA_VERSION } from '../../sync/domain/operation';
import type { Payment } from '../domain/payment';
import type { TransferConfirmation } from '../domain/transfer-confirmation';

export const PAYMENT_CONFIRMATIONS_COLLECTION = 'payment_confirmations';

/** Las confirmaciones guardadas en la tablet (propias y las que bajaron de otras). Solo se agregan. */
export interface TransferConfirmationStore {
  list(): Promise<readonly TransferConfirmation[]>;
  /** Ids de los pagos ya confirmados. */
  confirmedIds(): Promise<ReadonlySet<string>>;
}

export function outboxTransferConfirmationStore(outbox: SyncOutbox): TransferConfirmationStore {
  const todas = async (): Promise<readonly TransferConfirmation[]> =>
    (await outbox.transaction((tx) =>
      tx.listDocuments(PAYMENT_CONFIRMATIONS_COLLECTION),
    )) as readonly TransferConfirmation[];
  return {
    list: todas,
    async confirmedIds() {
      return new Set((await todas()).map((c) => c.paymentId));
    },
  };
}

export type ConfirmTransferErrorCode =
  'NOT_AUTHORIZED' | 'NOT_FOUND' | 'NOT_A_TRANSFER' | 'ALREADY_CONFIRMED' | 'STORAGE_FAILED';

export interface ConfirmTransferError {
  readonly code: ConfirmTransferErrorCode;
}

export interface ConfirmTransferDeps {
  readonly outbox: SyncOutbox;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
  readonly device: { readonly id: string };
  readonly policy?: PermissionPolicy;
}

/** Marca que llegó el dinero de una transferencia, después de revisarlo en el banco [RF-M4-11, ADR-0044].
 *  Solo un administrador (o quien tiene la tablet con el PIN de uno). Queda quién y cuándo; funciona sin
 *  internet y sale con la cola. No cambia el pago ni los totales. */
export async function confirmTransfer(
  deps: ConfirmTransferDeps,
  actor: QuoteActor,
  paymentId: string,
  authorization?: Authorization,
): Promise<Result<TransferConfirmation, ConfirmTransferError>> {
  const decision = (deps.policy ?? defaultPermissionPolicy).check(actor.role, 'TRANSFER_CONFIRM');
  let confirma: string;
  if (decision === 'DENY') {
    if (authorization === undefined) {
      return err({ code: 'NOT_AUTHORIZED' });
    }
    confirma = authorization.adminId;
  } else {
    confirma = actor.userId;
  }
  const instante = deps.clock.now().toISOString();
  try {
    return await deps.outbox.transaction(
      async (tx): Promise<Result<TransferConfirmation, ConfirmTransferError>> => {
        const pago = (await tx.getDocument(PAYMENTS_COLLECTION, paymentId)) as Payment | undefined;
        if (pago === undefined) {
          return err({ code: 'NOT_FOUND' });
        }
        if (pago.method !== 'TRANSFER') {
          return err({ code: 'NOT_A_TRANSFER' });
        }
        if ((await tx.getDocument(PAYMENT_CONFIRMATIONS_COLLECTION, paymentId)) !== undefined) {
          return err({ code: 'ALREADY_CONFIRMED' });
        }
        const confirmacion: TransferConfirmation = {
          paymentId,
          confirmedBy: confirma,
          confirmedAt: instante,
          syncStatus: 'SAVED_ON_TABLET',
        };
        const r = await tx.enqueue({
          opId: deps.idGenerator.newId<'Operation'>(),
          deviceId: deps.device.id,
          type: 'ConfirmTransfer',
          schemaVersion: CURRENT_SCHEMA_VERSION,
          userId: actor.userId,
          ...(confirma === actor.userId ? {} : { authorizedBy: confirma }),
          clientCreatedAt: instante,
          payload: { paymentId, confirmedAt: instante },
        });
        if (!r.ok) {
          throw new Error('INVALID_OPERATION');
        }
        await tx.putDocument(PAYMENT_CONFIRMATIONS_COLLECTION, paymentId, confirmacion);
        return ok(confirmacion);
      },
    );
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}
