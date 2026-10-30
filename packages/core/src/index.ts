// Punto de entrada de @zammir/core: lo que el resto del sistema puede importar.
export * from './shared-kernel/clock';
export * from './shared-kernel/id';
export * from './shared-kernel/result';
export * from './modules/settings/application/feature-flags';
export * from './modules/settings/application/in-memory-settings-repository';
export * from './modules/settings/application/ports';
export * from './modules/settings/domain/business-settings';
export * from './modules/identity/application/in-memory-admin-auth';
export * from './modules/identity/application/ports';
export * from './modules/identity/application/sign-in-admin';
export * from './modules/identity/domain/auth';
