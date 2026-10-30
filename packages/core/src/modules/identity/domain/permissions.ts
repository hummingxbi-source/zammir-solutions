import type { UserRole } from './auth';

/** Una fila de la matriz de permisos de `docs/producto/REQUERIMIENTOS.md` [DC §4].
 *  Agregar una acción nueva obliga a decidir qué puede hacer cada rol: la matriz es completa. */
export type Permission =
  | 'QUOTE_CREATE'
  | 'PRICE_OVERRIDE'
  | 'CATALOG_EDIT'
  | 'SALE_REGISTER'
  | 'ORDER_ADVANCE'
  | 'ORDER_DELIVER_WITH_BALANCE'
  | 'CANCEL_SALE_OR_ORDER'
  | 'OWN_CASH_CLOSE'
  | 'OTHERS_CASH_VIEW'
  | 'REPORTS_AND_RECEIVABLES'
  | 'INVOICE_GENERATE'
  | 'USERS_AND_DEVICES'
  | 'PRIVACY_NOTICE_EDIT';

/** Qué pasa cuando alguien intenta una acción:
 *  - `ALLOW`: puede.
 *  - `ALLOW_WITH_REASON`: puede, pero debe escribir el motivo (queda en bitácora).
 *  - `NEEDS_ADMIN_AUTHORIZATION`: solo si un administrador la autoriza con su PIN.
 *  - `DENY`: no puede. */
export type PermissionDecision =
  'ALLOW' | 'ALLOW_WITH_REASON' | 'NEEDS_ADMIN_AUTHORIZATION' | 'DENY';

/** Los roles que la matriz distingue: administrador y cajero/vendedor. */
export type MatrixRole = 'ADMIN' | 'STAFF';

export type PermissionMatrix = Readonly<
  Record<Permission, Readonly<Record<MatrixRole, PermissionDecision>>>
>;

/** La matriz tal como está en `REQUERIMIENTOS.md`. Una fila por permiso, en el mismo orden. */
export const PERMISSION_MATRIX: PermissionMatrix = {
  QUOTE_CREATE: { ADMIN: 'ALLOW', STAFF: 'ALLOW' },
  PRICE_OVERRIDE: { ADMIN: 'ALLOW', STAFF: 'NEEDS_ADMIN_AUTHORIZATION' },
  CATALOG_EDIT: { ADMIN: 'ALLOW', STAFF: 'DENY' },
  SALE_REGISTER: { ADMIN: 'ALLOW', STAFF: 'ALLOW' },
  ORDER_ADVANCE: { ADMIN: 'ALLOW', STAFF: 'ALLOW' },
  ORDER_DELIVER_WITH_BALANCE: { ADMIN: 'ALLOW_WITH_REASON', STAFF: 'DENY' },
  CANCEL_SALE_OR_ORDER: { ADMIN: 'ALLOW_WITH_REASON', STAFF: 'DENY' },
  OWN_CASH_CLOSE: { ADMIN: 'ALLOW', STAFF: 'ALLOW' },
  OTHERS_CASH_VIEW: { ADMIN: 'ALLOW', STAFF: 'DENY' },
  REPORTS_AND_RECEIVABLES: { ADMIN: 'ALLOW', STAFF: 'DENY' },
  INVOICE_GENERATE: { ADMIN: 'ALLOW', STAFF: 'NEEDS_ADMIN_AUTHORIZATION' },
  USERS_AND_DEVICES: { ADMIN: 'ALLOW', STAFF: 'DENY' },
  PRIVACY_NOTICE_EDIT: { ADMIN: 'ALLOW', STAFF: 'DENY' },
};

/** Cambios a la matriz para un negocio concreto (PD-17: si Luis y Ricardo resultaran tener permisos
 *  distintos, se configura aquí sin tocar el código). Sin cambios, rige `PERMISSION_MATRIX`. */
export type PermissionOverrides = Readonly<
  Partial<Record<Permission, Partial<Record<MatrixRole, PermissionDecision>>>>
>;

export interface PermissionPolicy {
  /** Qué puede hacer quien tiene este rol. Un rol que no es de persona (la sesión de la tablet o
   *  nadie) no puede nada: los permisos son de la persona que entró con su PIN o su cuenta. */
  check(role: UserRole | null, permission: Permission): PermissionDecision;
}

/** Política de permisos: dominio puro. La interfaz y la base de datos solo la consultan o la reflejan. */
export function createPermissionPolicy(overrides: PermissionOverrides = {}): PermissionPolicy {
  return {
    check(role, permission) {
      if (role !== 'ADMIN' && role !== 'STAFF') {
        return 'DENY';
      }
      return overrides[permission]?.[role] ?? PERMISSION_MATRIX[permission][role];
    },
  };
}

export const defaultPermissionPolicy: PermissionPolicy = createPermissionPolicy();

/** ¿La decisión deja seguir (aunque pida motivo o autorización)? */
export function isPermitted(decision: PermissionDecision): boolean {
  return decision !== 'DENY';
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_MATRIX) as Permission[];
