// Baterías de contrato y datos de prueba para quien escribe adaptadores. Solo para pruebas:
// importan Vitest y no forman parte de la API de producción de @zammir/core.
export * from './modules/identity/contracts/admin-auth.contract';
export * from './modules/settings/contracts/settings-repository.contract';
export * from './modules/settings/domain/business-settings.fixtures';
export * from './modules/audit/contracts/audit-log.contract';
export * from './modules/devices/contracts/device-repository.contract';
export * from './modules/catalog/contracts/catalog.contract';
export * from './modules/identity/contracts/pin-hasher.contract';
export * from './modules/identity/contracts/user-repository.contract';
export * from './modules/customers/contracts/customer-repository.contract';
export * from './modules/legal/contracts/legal-repository.contract';
export * from './modules/audit/contracts/audit-reader.contract';
export * from './modules/catalog/contracts/catalog-local-store.contract';
export * from './modules/identity/contracts/pin-attempt-guard.contract';
export * from './modules/identity/contracts/local-login-store.contract';
export * from './modules/sync/contracts/folio-allocator.contract';
export * from './modules/sync/contracts/operation-receiver.contract';
export * from './modules/sync/contracts/sync-outbox.contract';
export * from './modules/documents/contracts/document-renderer.contract';
export * from './modules/printing/contracts/ticket-printer.contract';
