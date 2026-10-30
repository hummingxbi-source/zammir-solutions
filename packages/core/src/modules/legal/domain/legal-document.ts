import type { Id, UserId } from '../../../shared-kernel/id';

export type LegalDocumentId = Id<'LegalDocument'>;

/** Aviso de privacidad o términos del servicio [RF-M9-01, RF-M9-02]. */
export type LegalDocumentType = 'PRIVACY_NOTICE' | 'TERMS';

/** Una versión de un documento legal. Las versiones solo se agregan: editar un aviso es publicar una
 *  versión nueva con su fecha de vigencia, y las anteriores se conservan intactas. */
export interface LegalDocument {
  readonly id: LegalDocumentId;
  readonly type: LegalDocumentType;
  /** 1, 2, 3… por tipo de documento. */
  readonly version: number;
  /** Desde cuándo rige. Una versión con fecha futura todavía no es la vigente. */
  readonly effectiveFrom: Date;
  readonly body: string;
  readonly editedBy: UserId | null;
}

export type LegalErrorCode = 'BODY_REQUIRED' | 'NOT_FOUND' | 'NOT_AUTHORIZED' | 'LEGAL_UNAVAILABLE';

export interface LegalError {
  readonly code: LegalErrorCode;
}

/** La versión vigente en un momento: la más nueva cuya vigencia ya empezó. */
export function currentVersion<T extends Pick<LegalDocument, 'version' | 'effectiveFrom'>>(
  versiones: readonly T[],
  at: Date,
): T | null {
  const vigentes = versiones.filter((v) => v.effectiveFrom.getTime() <= at.getTime());
  return vigentes.reduce<T | null>(
    (mejor, v) => (mejor === null || v.version > mejor.version ? v : mejor),
    null,
  );
}
