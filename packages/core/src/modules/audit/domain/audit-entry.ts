import type { DeviceId, Id, UserId } from '../../../shared-kernel/id';

/** Valor que se puede guardar en la bitácora (se serializa como JSON). */
export type Json = string | number | boolean | null | Json[] | { [clave: string]: Json };

/** Acciones sensibles que se registran [RN-19]. La lista crece con cada historia que agrega una. */
export type AuditAction =
  | 'DEVICE_REGISTERED'
  | 'DEVICE_REVOKED'
  | 'DEVICES_LISTED'
  | 'PRODUCT_PRICE_CHANGED'
  | 'PRODUCT_ACTIVATED'
  | 'PRODUCT_DEACTIVATED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'USER_PIN_RESET';

export type AuditEntryId = Id<'AuditEntry'>;

/** Una entrada de la bitácora: quién, desde dónde, cuándo (UTC), qué y cómo estaba antes y después.
 *  Nada contable ni sensible se borra ni se modifica: solo se agrega [RN-18]. */
export interface AuditEntry {
  readonly id: AuditEntryId;
  readonly occurredAt: Date;
  /** La persona que actuó; `null` si fue una acción del sistema o aún no hay persona identificada. */
  readonly userId: UserId | null;
  readonly deviceId: DeviceId | null;
  /** El administrador que autorizó con su PIN una acción restringida de un cajero [RN-19, ADR-0013]. */
  readonly authorizedBy?: UserId | null;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly oldValue: Json;
  readonly newValue: Json;
}
