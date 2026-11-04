import { folioYear, formatFolio, type FolioError } from '../../../shared-kernel/folio/folio';
import type { UserId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import type { UserRole } from '../../identity/domain/auth';
import { defaultPermissionPolicy, type PermissionPolicy } from '../../identity/domain/permissions';

export interface InvoiceActor {
  readonly userId: UserId;
  readonly role: UserRole | null;
}

export type InvoiceIssueError =
  /** El rol no puede facturar de ninguna manera. */
  | { readonly code: 'NOT_AUTHORIZED' }
  /** Un cajero necesita el PIN de un administrador y no lo trae [RF-M10-08]. */
  | { readonly code: 'AUTHORIZATION_REQUIRED' };

export interface InvoiceIssuePermit {
  /** Quién respalda la factura: un administrador se autoriza a sí mismo; un cajero, con el PIN de otro. Se
   *  guarda en la operación para que el servidor lo verifique y lo deje en la bitácora [RN-19]. */
  readonly authorizedBy: UserId;
}

/** ¿Puede esta persona facturar desde el sistema? Un administrador sí; un cajero solo con la autorización
 *  de un administrador por PIN [RF-M10-08, DC §4, §7.5]. No hace la factura: solo decide si se puede y
 *  quién la respalda. */
export function authorizeInvoiceIssue(
  actor: InvoiceActor,
  authorization?: Authorization,
  policy: PermissionPolicy = defaultPermissionPolicy,
): Result<InvoiceIssuePermit, InvoiceIssueError> {
  const decision = policy.check(actor.role, 'INVOICE_GENERATE');
  if (decision === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  if (decision === 'NEEDS_ADMIN_AUTHORIZATION') {
    return authorization === undefined
      ? err({ code: 'AUTHORIZATION_REQUIRED' })
      : ok({ authorizedBy: authorization.adminId });
  }
  return ok({ authorizedBy: actor.userId });
}

/** Folio de una factura emitida por el sistema: `F-2026-0001`. El año es el de México en que se emitió y el
 *  número lo asigna el servidor, sin huecos ni duplicados [RN-15, RN-16]. */
export function invoiceFolio(emitidaEn: Date, numero: number): Result<string, FolioError> {
  return formatFolio('INVOICE', folioYear(emitidaEn), numero);
}
