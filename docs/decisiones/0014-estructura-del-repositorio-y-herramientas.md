# ADR-0014: Estructura del repositorio y herramientas

- **Estado:** Aceptada el 2026-10-27 (Juanito la aprobó al iniciar el Sprint 0). Las versiones concretas se fijan al crear el repositorio
- **Fecha:** 2026-10-26
- **Decide:** Juanito
- **Detalle en:** `docs/arquitectura/ARCHITECTURE.md`
- **Completa:** [ADR-0003]; confirma o ajusta las propuestas de `docs/plan/00-principios-de-ingenieria.md`

## Contexto

Un solo desarrollador, cinco semanas y reglas críticas (dinero, folios, permisos) que deben correr igual en la tablet y en el servidor. Los principios piden dominio puro, dependencias hacia adentro y pruebas rápidas.

## Decisión

### Estructura
Monorepo con tres áreas: `apps/web` (PWA), `packages/core` (dominio y aplicación en TypeScript puro) y `supabase/` (migraciones, funciones, pruebas de base). Se confirma la propuesta de los principios §1.2.

### Herramientas

| Necesidad | Elección propuesta | Por qué | Se confirma en |
|---|---|---|---|
| Gestor de paquetes y workspaces | pnpm | Workspaces simples y rápidos | Sprint 0 |
| Lenguaje | TypeScript estricto (`strict`, `noUncheckedIndexedAccess`) | [Principios §3] | — |
| Pruebas unitarias, casos de uso y contrato | Vitest | Mismo ecosistema que Vite | Sprint 0 |
| Pruebas de propiedades | fast-check | Invariantes de dinero y folios | Sprint 0 |
| Pruebas de mutación | Stryker | Umbrales de [principios §4.2] | Sprint 0 |
| Componentes y extremo a extremo | Testing Library; Playwright con axe-core | Tamaño de tablet y modo sin conexión | Sprint 0 |
| Lint y formato | ESLint y Prettier, cero advertencias | [Principios §3.12] | Sprint 0 |
| Reglas de dependencia | dependency-cruiser | Falla la CI si se rompe una capa | Sprint 0 |
| Validación en la frontera | Zod | [Principios §3.9] | Sprint 0 |
| Datos locales | Dexie sobre IndexedDB | [ADR-0012] | Sprint 0 |
| PWA y modo sin conexión | vite-plugin-pwa (Workbox) | Instalación y caché de la aplicación | Sprint 0, probado en tablet real |
| Enrutamiento | React Router | Suficiente para una aplicación de pantallas | Sprint 0 |
| Estado | Estado local de React y lecturas vivas de Dexie; un almacén pequeño solo para sesión y usuario activo | Evitar una capa de estado global innecesaria | Sprint 1 |
| Secretos | gitleaks en CI | [ADR-0010] | Sprint 0 |
| PDF en el dispositivo | **Sin elegir**; se decide con una validación corta (`spike/pdf`) | Requiere medir tamaño, fuentes y soporte sin conexión | Sprint 2 |
| Impresión de tickets | Puerto `TicketPrinter` con tres adaptadores: Web Bluetooth + ESC/POS, `window.print()` y compartir [ADR-0018]. El modelo de impresora y el resultado de la capa 1 se registran tras la prueba de concepto (PD-15) | [ADR-0018] | Sprint 0 |

> Las versiones concretas se fijan al crear el repositorio, verificando la documentación vigente. No las dejo escritas aquí porque podrían estar desactualizadas.

### Compartir `packages/core` con las Edge Functions
Las funciones de Supabase corren en Deno. `packages/core` no usa APIs de Node ni dependencias que no funcionen en Deno, y se incluye en las funciones **empaquetándolo en un paso de compilación** o con un mapa de importaciones. La forma exacta se **valida en el Sprint 0** con una función de ejemplo que use `Money` y `FolioAllocator` y una prueba que la ejecute.

## Alternativas consideradas
- **Una sola aplicación con carpetas:** más simple, pero no hay garantía de que el dominio sea importable en el servidor ni de que no importe React.
- **Lógica de negocio en funciones SQL:** la mayoría del dominio quedaría en SQL, difícil de probar y de reutilizar en la tablet.

## Consecuencias
- Una validación (spike) corta de Deno + `packages/core` entra al Sprint 0.
- Cada herramienta marcada "Sprint 0" se verifica con su versión actual al crear el repositorio; si algo no funciona se registra un ADR de reemplazo.

## Resultado de la validación (S0-17, 2026-10-29)

**La hipótesis se sostiene con empaquetado.** `packages/core` corre dentro de una función de Supabase (entorno de ejecución 1.77.8, compatible con Deno 2.1.4) si se empaqueta antes en un solo archivo.

- **Qué se probó:** la función `validar-core` usa `Result`, el generador de identificadores, la marca de ids, `hasIdleExpired` y el esquema Zod de la configuración. Con `supabase functions serve`, respondió `200` con todas las comprobaciones correctas.
- **Por qué no se importan los fuentes directo:** el núcleo usa importaciones relativas sin extensión (`./result`), que Deno no resuelve. Se empaqueta con esbuild (`pnpm funciones:empaquetar` → `supabase/functions/_shared/core.mjs`, no se versiona). Tamaño: unos 750 KB, casi todo Zod.
- **Costo:** esbuild entra como dependencia de desarrollo. Hay un paso de compilación antes de servir o desplegar funciones; la integración continua debe correrlo antes de desplegar (S0-06).
- **Sin probar todavía:** `Money` y `FolioAllocator` (aún no existen), el despliegue a un proyecto real de Supabase y el tiempo de arranque en frío.
