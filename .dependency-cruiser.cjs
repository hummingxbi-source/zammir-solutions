/** Reglas de dependencia entre capas [docs/plan/00-principios-de-ingenieria.md §1.1].
 *  Las dependencias solo apuntan hacia adentro: UI e infraestructura → aplicación → dominio. */
const SDK_EXTERNOS = '^(react|react-dom|@supabase/.+|dexie)(/|$)';

module.exports = {
  forbidden: [
    {
      name: 'dominio-puro',
      comment: 'El dominio y la aplicación (packages/core) no importan React, Supabase ni Dexie.',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: SDK_EXTERNOS },
    },
    {
      name: 'core-no-importa-apps',
      comment: 'packages/core no depende de la aplicación web.',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '^apps/' },
    },
    {
      name: 'dominio-no-importa-aplicacion',
      comment: 'El dominio de un módulo no conoce sus casos de uso.',
      severity: 'error',
      from: { path: '^packages/core/src/modules/[^/]+/domain/' },
      to: { path: '^packages/core/src/modules/[^/]+/application/' },
    },
    {
      name: 'nucleo-compartido-no-importa-modulos',
      comment: 'El núcleo compartido (dinero, folios, reloj) no depende de ningún módulo.',
      severity: 'error',
      from: { path: '^packages/core/src/shared-kernel/' },
      to: { path: '^packages/core/src/modules/' },
    },
    {
      name: 'ui-no-importa-sdk-de-datos',
      comment: 'Las pantallas no hablan con Supabase ni con Dexie: pasan por casos de uso.',
      severity: 'error',
      from: { path: '^apps/web/src/(modules/[^/]+/ui|shared/ui)/' },
      to: { path: '^(@supabase/.+|dexie)(/|$)' },
    },
    {
      name: 'ui-no-importa-infraestructura',
      comment: 'La UI no importa adaptadores: solo la raíz de composición los conoce.',
      severity: 'error',
      from: { path: '^apps/web/src/(modules/[^/]+/ui|shared/ui)/' },
      to: { path: '^apps/web/src/(modules/[^/]+/infra|shared/infra)/' },
    },
    {
      name: 'infraestructura-no-importa-ui',
      comment: 'Los adaptadores no dependen de las pantallas.',
      severity: 'error',
      from: { path: '^apps/web/src/(modules/[^/]+/infra|shared/infra)/' },
      to: { path: '^apps/web/src/(modules/[^/]+/ui|shared/ui)/' },
    },
    {
      name: 'sin-ciclos',
      comment: 'Sin dependencias circulares.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    exclude: { path: '(^|/)(dist|coverage)/' },
  },
};
