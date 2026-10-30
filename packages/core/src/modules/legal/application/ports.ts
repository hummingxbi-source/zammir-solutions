import type { Result } from '../../../shared-kernel/result';
import type { LegalDocument, LegalDocumentType, LegalError } from '../domain/legal-document';

export interface PublishInput {
  readonly type: LegalDocumentType;
  readonly body: string;
  readonly effectiveFrom: Date;
}

/** Puerto: documentos legales versionados. Solo se agregan versiones; nada se edita ni se borra.
 *  Quien lo implementa asigna el número de versión (siguiente al más alto del tipo) y deja la entrada de
 *  bitácora en el mismo paso [RN-19]. */
export interface LegalDocumentRepository {
  publish(entrada: PublishInput): Promise<Result<LegalDocument, LegalError>>;
  /** Todas las versiones del tipo, de la más antigua a la más nueva. */
  list(type: LegalDocumentType): Promise<Result<readonly LegalDocument[], LegalError>>;
}
