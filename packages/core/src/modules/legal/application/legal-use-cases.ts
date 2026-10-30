import type { Clock } from '../../../shared-kernel/clock';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Actor } from '../../identity/domain/auth';
import { defaultPermissionPolicy } from '../../identity/domain/permissions';
import {
  currentVersion,
  type LegalDocument,
  type LegalDocumentType,
  type LegalError,
} from '../domain/legal-document';
import type { LegalDocumentRepository } from './ports';

export interface LegalDeps {
  readonly legal: LegalDocumentRepository;
  readonly clock: Clock;
}

/** Publica una versión nueva del aviso de privacidad o de los términos [RF-M9-01]. Solo quien tiene el
 *  permiso `PRIVACY_NOTICE_EDIT` de la matriz (los administradores). Las versiones anteriores se
 *  conservan. Sin fecha de vigencia rige desde ahora. */
export function publishLegalDocument(
  deps: LegalDeps,
  actor: Actor,
  entrada: {
    readonly type: LegalDocumentType;
    readonly body: string;
    readonly effectiveFrom?: Date;
  },
): Promise<Result<LegalDocument, LegalError>> {
  if (defaultPermissionPolicy.check(actor.role, 'PRIVACY_NOTICE_EDIT') === 'DENY') {
    return Promise.resolve(err({ code: 'NOT_AUTHORIZED' }));
  }
  const body = entrada.body.trim();
  if (body === '') {
    return Promise.resolve(err({ code: 'BODY_REQUIRED' }));
  }
  return deps.legal.publish({
    type: entrada.type,
    body,
    effectiveFrom: entrada.effectiveFrom ?? deps.clock.now(),
  });
}

/** La versión vigente ahora de un documento legal, o `NOT_FOUND` si aún no hay ninguna. */
export async function getCurrentLegalDocument(
  deps: LegalDeps,
  type: LegalDocumentType,
): Promise<Result<LegalDocument, LegalError>> {
  const versiones = await deps.legal.list(type);
  if (!versiones.ok) {
    return versiones;
  }
  const vigente = currentVersion(versiones.value, deps.clock.now());
  return vigente === null ? err({ code: 'NOT_FOUND' }) : ok(vigente);
}
