# Estrategia de pruebas

> Borrador de Fase 2 (punto 2.7). Concreta `docs/plan/00-principios-de-ingenieria.md` §4 y §5; si algo aquí lo contradice, gana ese documento.
> Herramientas según [ADR-0014]; las versiones se fijan en `package.json` al crear el repositorio.
> La meta no es un número de pruebas: es que **ningún error de dinero, folios, permisos o reglas llegue a manos de Luis**.

## 1. Niveles

| Nivel | Qué prueba | Herramienta | Dónde vive | Corre en |
|---|---|---|---|---|
| Unitarias del dominio | Dinero, IVA, redondeo, reglas de precio, folios, máquinas de estado, permisos, cortes, periodos | Vitest | `packages/core/**/*.test.ts` | Cada Pull Request |
| Basadas en propiedades | Invariantes con cualquier entrada ("subtotal + IVA = total") | fast-check | Junto a las unitarias | Cada Pull Request |
| Casos de uso | Cada caso de uso con puertos falsos en memoria | Vitest | `packages/core/**/application/*.test.ts` | Cada Pull Request |
| Contrato de puertos | La misma batería contra todos los adaptadores de un puerto | Vitest | `packages/core/**/contracts/`, invocadas desde cada adaptador | Cada Pull Request |
| Base de datos | Migraciones desde cero, funciones SQL, políticas RLS por rol, folios con concurrencia | Supabase local + pruebas con clientes por rol | `supabase/tests/` | Cada Pull Request |
| Sincronización | Sin conexión, reconexión, dos tablets, reintentos, duplicados | Vitest con IndexedDB simulada + servidor local | `apps/web/src/shared/infra/sync/*.test.ts` | Cada Pull Request |
| Componentes | Pantallas críticas | Testing Library | Junto a cada componente | Cada Pull Request |
| Extremo a extremo | Flujos completos en navegador con tamaño de tablet | Playwright | `apps/web/e2e/` | Cada Pull Request, contra la vista previa |
| Mutación | Que las pruebas del dominio detecten errores | Stryker | Sobre `packages/core` | Pull Requests que toquen `packages/core`; completa al cierre de sprint |
| Accesibilidad | Contraste, etiquetas, objetivos táctiles | axe-core dentro de Playwright | `apps/web/e2e/` | Cada Pull Request |
| Vocabulario | Ninguna palabra prohibida del glosario en la interfaz | Vitest | `apps/web/src/shared/i18n/*.test.ts` | Cada Pull Request |
| Manual en tablet | Lo que no se automatiza: instalación, modo avión, impresión, WhatsApp, orientación | Lista firmada | Pull Request de cierre del sprint | Cada sprint |

## 2. Umbrales

| Área | Líneas | Ramas | Mutación |
|---|---|---|---|
| Dinero, IVA, redondeo, reglas de precio, folios | 100 % | 100 % | ≥ 90 % |
| Resto del dominio | ≥ 95 % | ≥ 90 % | ≥ 80 % |
| Casos de uso | ≥ 95 % | ≥ 90 % | — |
| Adaptadores | Pruebas de contrato | — | — |
| Todo el repositorio | ≥ 85 % | — | — |

La cobertura es un **piso**, no la meta. Nunca se baja un umbral ni se salta una prueba para que la integración continua pase [CLAUDE.md regla 11].

## 3. Reglas para escribir pruebas

1. **Pruebas primero** en dominio y casos de uso: rojo → verde → refactor.
2. Cada criterio de aceptación de una historia (`docs/backlog/`) tiene al menos una prueba que lo nombra.
3. Cada error encontrado se reproduce con una prueba **antes** de corregirse.
4. Deterministas: reloj fijo (`Clock`), identificadores fijos (`IdGenerator`), sin depender de la hora real ni del orden. Una prueba intermitente se arregla de inmediato; no se reintenta.
5. Datos inventados con constructores de prueba (`aQuote().withLine(...)`). Nunca datos reales [ADR-0010].
6. Nombres que se leen como reglas, en español: `it('rechaza entregar con saldo pendiente si no es administrador')`.
7. **Casos de oro de dinero** (`CASOS_DE_ORO_DINERO.md`): son la referencia de verdad; si código y tabla no coinciden, gana la tabla.
8. **Prohibido** `it.skip`, `it.only`, `describe.skip` (el lint lo falla).
9. **Zonas horarias:** las pruebas corren con zonas distintas a la de México (por ejemplo UTC y Asia/Tokyo) para detectar errores de día y semana [RN-17].
10. Los textos de la interfaz salen de un módulo central, no de los componentes, para que la prueba de vocabulario los recorra.

## 4. Orden de la integración continua

Se detiene en el primer fallo [`00-principios` §5.1]:

1. Instalación limpia de dependencias.
2. Formato y lint, cero errores y cero advertencias.
3. Revisión de tipos estricta.
4. Reglas de dependencia entre capas.
5. Pruebas unitarias, de propiedades, de casos de uso y de contrato.
6. Umbrales de cobertura.
7. Pruebas contra Supabase local (migraciones desde cero y RLS).
8. Construcción de producción.
9. Vista previa y pruebas extremo a extremo contra ella.
10. Escaneo de secretos.

## 5. Extremo a extremo y tablet

- **Tamaño de pantalla provisional** (hasta definir el modelo de tablet, PD-16): 1280 × 800 en horizontal y 800 × 1280 en vertical. Se ajusta al modelo real cuando se elija.
- Cada recorrido E1 a E10 de `PRUEBAS_DE_ACEPTACION.md` se automatiza en el sprint indicado y se repite completo en el Sprint 5 con el equipo real.
- **Modo sin conexión:** las pruebas cortan la red del navegador y verifican cola, folios temporales y reenvío.
- **Lista manual de tablet** (cada sprint, firmada en el Pull Request de cierre): instalar la PWA, abrirla en modo avión, imprimir (desde el Sprint 3), compartir por WhatsApp, vertical y horizontal, teclado numérico.

## 6. Qué no se prueba en producción

Ningún agente de IA tiene acceso a datos de producción [RNF-19]. Las pruebas de humo en producción no generan documentos fiscales ni datos contables falsos, o se cancelan según lo acordado con el contador.
