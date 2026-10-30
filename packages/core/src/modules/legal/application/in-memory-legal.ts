import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator } from '../../../shared-kernel/id';
import { ok } from '../../../shared-kernel/result';
import type { InMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { recordAuditEntry } from '../../audit/application/record-audit-entry';
import type { LegalDocument, LegalDocumentType } from '../domain/legal-document';
import type { LegalDocumentRepository } from './ports';

export interface InMemoryLegalDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly auditLog: InMemoryAuditLog;
}

/** Adaptador en memoria del puerto LegalDocumentRepository, para pruebas. */
export function inMemoryLegal(deps: InMemoryLegalDeps): LegalDocumentRepository {
  const documentos: LegalDocument[] = [];

  return {
    async publish(entrada) {
      const version =
        Math.max(0, ...documentos.filter((d) => d.type === entrada.type).map((d) => d.version)) + 1;
      const documento: LegalDocument = {
        id: deps.idGenerator.newId<'LegalDocument'>(),
        type: entrada.type,
        version,
        effectiveFrom: entrada.effectiveFrom,
        body: entrada.body,
        editedBy: null,
      };
      documentos.push(documento);
      await recordAuditEntry(
        { auditLog: deps.auditLog, clock: deps.clock, idGenerator: deps.idGenerator },
        {
          userId: null,
          deviceId: null,
          action: 'LEGAL_DOCUMENT_PUBLISHED',
          entityType: 'legal_document',
          entityId: documento.id,
          oldValue: version > 1 ? { version: version - 1 } : null,
          newValue: { tipo: entrada.type, version },
        },
      );
      return ok(documento);
    },

    list(type: LegalDocumentType) {
      return Promise.resolve(
        ok(documentos.filter((d) => d.type === type).sort((a, b) => a.version - b.version)),
      );
    },
  };
}
