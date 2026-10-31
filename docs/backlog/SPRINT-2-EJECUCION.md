# Sprint 2: guía de ejecución

> **Para qué sirve este documento.** Es el cuaderno de trabajo del Sprint 2 (cotizador sin conexión). Una sesión nueva debe poder leer **solo este archivo + la historia que le toque en [`SPRINT-2.md`](SPRINT-2.md)** y empezar a construir, sin recorrer el historial ni el resto del repositorio. Las convenciones de código, comandos y recetas son las mismas del Sprint 1: se resumen en las secciones 1 y 3 y el detalle sigue en [`SPRINT-1-EJECUCION.md`](SPRINT-1-EJECUCION.md) §3 y §4.
> **Estado:** escrito el 30 oct 2026, con el Sprint 1 terminado en código (falta la prueba en tablet, que se hace al final). Se actualiza al terminar cada historia (tabla de la sección 9).
> Lo marcado **[PROPUESTA]** lo propuso el desarrollador; se construye así mientras nadie diga otra cosa y cada una se registra en un ADR al implementarla.

## 1. Reglas que no se rompen (resumen de `CLAUDE.md`)

1. No inventar reglas de negocio. Lo que esté en `PENDIENTES.md` se hace **configurable** y se avisa. Dudas nuevas de negocio → `docs/producto/CUESTIONARIO_LUIS.md` (**una sola ronda con Luis al final de todos los sprints**; no se le pregunta por separado).
2. Dinero en centavos enteros; medidas en mm enteros; sin flotantes. Fechas en UTC, mostradas en `America/Mexico_City`; días, años de folio y vigencias se calculan en hora de México.
3. Interfaz en español de México con el vocabulario del glosario. **Prohibido** en textos: sincronizar, offline, login, checkout, carrito, POS. Se dice **"Guardado en la tablet"**, **"Enviado"**, **"N pendientes"**, **"Sin conexión. Puedes seguir trabajando."** Todo texto va en `apps/web/src/shared/i18n/textos.ts` (la prueba de vocabulario lo recorre).
4. Nada contable se borra: se cancela o se marca con motivo. Lo sensible deja bitácora (`audit_log`, solo se agrega).
5. Sin secretos ni datos reales de clientes. Datos de prueba inventados.
6. **No se avanza con algo en rojo.** No se bajan umbrales ni se desactivan pruebas (`it.skip`/`only` están prohibidas por lint). Si no alcanza el tiempo se recorta alcance (sección 8), nunca calidad.
7. Cada decisión técnica nueva → ADR en `docs/decisiones/` + fila en `DECISIONES.md`. Numeración: el último ADR existente es 0022; los siguientes son 0023 en adelante.
8. No construir lo que no esté en `REQUERIMIENTOS.md`; si falta algo, proponerlo en `PENDIENTES.md` (tabla "Propuestas").
9. Las tablets aún no llegan: lo marcado *(manual)* se anota como pendiente y **no bloquea** la historia; se prueba al final con la lista de tablet.

## 2. Qué ya existe (no rehacer)

Inventario completo del núcleo y de la base: [`SPRINT-1-EJECUCION.md`](SPRINT-1-EJECUCION.md) §2. Lo que se agregó al final del Sprint 1 y este sprint usa directamente:

| Pieza | Dónde | Para qué sirve en el Sprint 2 |
|---|---|---|
| Registro de la tablet | `core/modules/devices/application/register-tablet.ts` (`registerTablet`, `DeviceCredentials{device{id,name,tempSeries},session,registeredAt}`, `DeviceCredentialsStore`); web: `devices/infra/{function-device-registrar,local-credentials-store}.ts`, pantalla `/conectar` | `tempSeries` es la **serie temporal** `T<n>` del dispositivo (S2-05). Las credenciales viven en `localStorage` |
| Sesión de la tablet en la nube | `composition/index.ts` → `abrirSesionDeLaTablet(url, anonKey, credenciales, c)` (cliente aparte con `setSession`; guarda la renovación) | El envío de operaciones usa **este mismo cliente**, no el de administrador |
| Catálogo local | `core/modules/catalog/application/{replica,in-memory-catalog-local-store}.ts`; web: `catalog/infra/{dexie-catalog-store,actualizar-catalogo-local,supabase-catalog}.ts`; migración `…180000_catalog_replication.sql` (`change_seq` en `products`, vista `catalog_products_for_device`) | El cotizador lee productos con `localProductReader(store)` (activos solamente). Patrón de **réplica por cursor** que se repite para clientes y cotizaciones |
| Entrada con PIN | `core/modules/identity/application/{sign-in-with-pin,active-user-session,pin-attempt-guard}.ts`; web: `identity/infra/{dexie-identity-store,supabase-login-source}.ts`, `identity/ui/{EntrarConPin,PersonaActiva}.tsx` | `ActiveUserSession.actingUser()` es **quién opera** (`userId` del sobre de la operación). `authorizeWithAdminPin` da el `authorizedBy` de descuentos. `session.saveDraft/draft` guarda borradores por persona |
| Permisos | `defaultPermissionPolicy.check(role, 'QUOTE_CREATE' \| 'PRICE_OVERRIDE' …)` | `PRICE_OVERRIDE`: cajero → `NEEDS_ADMIN_AUTHORIZATION`, administrador → `ALLOW` |
| Clientes | `core/modules/customers/*`, tabla `customers`, vista `customers_for_device`, `normalizePhone`, `searchCustomers`, `findPossibleDuplicates`, aviso de privacidad versionado (`customers.privacy_notice_version`) | Hoy la tablet da de alta clientes **directo al servidor** (ADR-0021, transitorio). En este sprint pasa a **operación en cola** (S2-10) |
| Dinero, IVA, precios | `core/shared-kernel/{money,tax,measure}`, `core/modules/catalog/domain/pricing/*` | Totales de la cotización = suma de `areaLineTotal`/`linearAmount`/… ya hechos; **no recalcular con otra fórmula** |
| Configuración | `quote_validity_days`=15, `tax_rate_bps`, `deposit_percent_bps`, `idle_lock_minutes`, `local_retention_days`=null (por definir) | `valid_until` desde `quote_validity_days`; la ventana de retención no existe aún (usar 90 por omisión configurable y avisar, ver §6 S2-07) |
| Bitácora | `recordAuditEntry`, `AuditAction` (agregar acciones nuevas a la unión), `audit_log.authorized_by` | Descuentos y cambios de precio de línea: valor anterior y nuevo [RN-19] |
| Indicador de conexión | `apps/web/src/shell/IndicadorDeConexion.tsx` | Se extiende con "N pendientes" (S2-06) |

**Huecos conocidos que este sprint hereda** (no son de este sprint resolverlos, pero hay que conocerlos):
- **PP-13:** la base ve la sesión de la *tablet*, no a la persona con PIN. Con el sobre de la operación (`userId`, `authorizedBy`) la atribución **sí** queda guardada en `operations` y en la bitácora que escriba la función de recepción; lo que PP-13 pide es que la base **valide** que ese `userId` es una persona activa (S2-03 lo hace).
- Sin medir: iteraciones de PBKDF2 en la tablet real (manual, al final).

### 2.1 Lo construido en este sprint (se actualiza al terminar cada historia)

| Pieza | Dónde | Notas para quien siga |
|---|---|---|
| Folios (dominio) | `core/shared-kernel/folio/folio.ts` (**no** en `modules/sync`: el umbral de 100 % y la mutación apuntan a `shared-kernel/folio`) | `formatFolio(docType, año, n)`, `formatTempFolio(serie, n)`, `folioYear(fecha)` (hora de México), `parseTempFolio(texto)` |
| Asignador | `core/modules/sync/application/folio-allocator.ts` + contrato `folioAllocatorContract`; Postgres real en `apps/web/src/shared/infra/sync/pg-folio-allocator.ts` (solo pruebas, usa `pg` y `ZAMMIR_TEST_DB_URL`) | SQL: `private.next_folio(tipo, año)`, `private.folio_year(timestamptz)`, tabla `folio_counters` |
| Operaciones (dominio) | `core/modules/sync/domain/operation.ts` | `parseEnvelope`, `operationEnvelopeSchema`, `issueQuotePayloadSchema` (valida que totales = suma de líneas), `OperationResult`, `isStructuralRejection`. La recomputación con reglas de precio queda para S2-13 (código `TOTALS_MISMATCH` reservado) |
| Receptor | puerto `OperationReceiver` + `inMemoryOperationReceiver` (`core/modules/sync/application/operation-receiver.ts`), contrato `operationReceiverContract` (con `issueQuoteOperation(...)` para armar operaciones de prueba); servidor: `supabase/functions/recibir-operacion/index.ts` + SQL `public.receive_operation(p jsonb)`; cliente: `apps/web/src/shared/infra/sync/function-operation-receiver.ts` (lanza `OperationTransportError` si no hay red o el servidor falla) | Tablas nuevas: `operations` (solo se agrega), `quotes`, `quote_lines` (solo las escribe `receive_operation`), `devices.last_seq`. El resto de tipos (`MarkQuoteAccepted`, `MarkQuoteRejected`, `UpsertCustomer`) hoy responden `UNKNOWN_TYPE`: agregarlos en SQL (`case v_type`) y en el receptor en memoria cuando se hagan S2-08/S2-10 |
| Cola de salida | puerto `SyncOutbox` y `OutboxTransaction` en `core/modules/sync/application/ports.ts`; `inMemorySyncOutbox({clock})`; contrato `syncOutboxContract` (+ `operacionSinSeq()` para armar operaciones); Dexie: `apps/web/src/shared/infra/sync/dexie-operaciones.ts` (`dexieOperaciones({clock, nombre?})`, base `zammir-operaciones` con tablas `operaciones`, `documentos`, `contadores`) | **Todo documento nuevo se guarda con `outbox.transaction(async tx => { const n = await tx.nextTempNumber(); await tx.putDocument('quotes', id, doc); await tx.enqueue({...sin seq}) })`**: documento, operación (con `seq` consecutivo) y folio provisional en una sola transacción. Dentro de `work` solo se esperan llamadas de `tx` (IndexedDB cierra la transacción si se espera otra cosa). `nextToSend()` devuelve `null` si hay una `FAILED` (cola detenida) |
| Envío automático | `core/modules/sync/application/run-sync.ts` (`runSync`, `SyncTransport` con `Result<OperationResult, TransportError>`, `exponentialBackoff`), `sync-engine.ts` (`createSyncEngine({outbox, transport, backoff, random, timer, clock})` → `trigger()`, `resume()`, `status()` con `state IDLE/SENDING/WAITING/STOPPED`, `pending`, `oldestPendingSince`, `retryInMs`; `documentSyncLabel`, `isStale`); web: `shared/infra/sync/{http-operation-transport,browser-timer}.ts`; `composition.envio = {outbox, engine, visible}`; `main.tsx` llama a `engine.trigger()` al abrir y al evento `online` | **Al guardar un documento nuevo hay que llamar a `composition.envio.engine.trigger()`** (las pantallas lo reciben por props). Ajuste nuevo `sync_stale_hours` = 6 (en `LoginSnapshot.syncStaleHours`). El indicador (`IndicadorDeConexion`) muestra "N pendientes", antigüedad y "avisa a soporte" |
| Azar y código público | `core/shared-kernel/random.ts` (`Random`, `seededRandom`), `core/modules/sync/domain/public-code.ts` (`generatePublicCode`, `isPublicCode`), web `shared/infra/crypto-random.ts` (`cryptoRandom`) | Códigos de 8 caracteres sin 0/O/1/I/L |
| Pruebas con servidor local | `pnpm test:integracion` | Si falla con `SERVER_UNAVAILABLE`, hay un `supabase functions serve` viejo sin la función nueva: apagarlo y repetir |

## 3. Cómo trabajar (resumen)

- **Carpeta de trabajo:** `C:\z\s16`. pnpm: en Bash `export PATH="/c/z/bin:$PATH"`. Node 24; Docker Desktop encendido para Supabase local. Antes de `supabase start`/`db reset`: `pnpm funciones:empaquetar`.
- **Archivos largos:** usar la herramienta **Write** (los heredocs largos o con apóstrofos se truncan en Bash). Ediciones pequeñas: scripts de Python o `Edit`.
- **Git:** una rama por historia (`feat/s2-XX-tema`), PR contra la rama anterior de la pila (o `main` si ya se fusionó), commits en español `feat(modulo): … (S2-XX)` terminados con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; cuerpo de PR en español con `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. **Nunca** `push --force`. Agregar rutas explícitas (`git add packages apps supabase docs`), no `-A` en ramas viejas.
- **Compuerta antes de subir** (en orden): `pnpm typecheck` · `pnpm lint` (0 advertencias) · `pnpm exec prettier --write <rutas>` · `pnpm check:deps` · `pnpm check:env` (variable nueva → `.env.example`) · `pnpm test:cobertura` (85 %; 100 % en `money/`, `tax/`, `pricing/`, `folio/`) · `pnpm db:reset && pnpm test:db` · `pnpm test:integracion` · `pnpm test:mutacion:critico` (≥ 90 %) · `pnpm test:e2e`.
- **Estilo (lo exige el lint):** sin `any`, sin `!`, sin variables sin usar, `exactOptionalPropertyTypes`, preferir `?.`, **sin `Date.now()`/`new Date()`/`Math.random()`/`crypto`/`window`/`fetch` dentro de `packages/core`** (llegan por puertos `Clock`, `IdGenerator`, `Random`…), aserción de tipo solo para marcas. `.data` del cliente de Supabase es `any`: leer como `unknown`. Nombres de pruebas y comentarios en español; identificadores en inglés.
- **Pruebas web:** el `setup.ts` ya provee IndexedDB (`fake-indexeddb/auto`). Los componentes de `ui/` no importan `infra/` (la regla `ui-no-importa-infraestructura` rompe la compuerta): en pruebas de UI usar adaptadores en memoria del núcleo.
- **Trampas conocidas:** `plan(N)` de pgTAP se cuenta mal a la primera (corregir tras correr); en pgTAP las pruebas que cambian datos requieren `set local role authenticated` con claims de ADMIN y volver con `reset role`; un `audit_log` insertado por disparador exige `recorded_by` (hacer los cambios como usuario autenticado); consultas por texto en pruebas de componente chocan si el nombre aparece dos veces (usar `within`); `getByText` exacto vs. subcadenas con acentos.

## 4. Arquitectura del sprint

### 4.1 Mapa de módulos nuevos

```
packages/core/src/
  modules/
    sync/                      ← motor de operaciones (S2-01..S2-08)
      domain/operation.ts        OperationEnvelope, OperationType, Zod de cada payload, schemaVersion
      domain/folio.ts            formatFolio, formatTempFolio, folioYear (hora de México)  ← 100 % cobertura
      domain/conflicts.ts        política de conflictos por tipo (tabla de §6 de SINCRONIZACION)
      application/ports.ts       SyncOutbox, OperationTransport, FolioAllocator, Random, BackoffPolicy
      application/enqueue-operation.ts
      application/run-sync.ts    SyncRunner (envío en orden, reintentos, detención por error estructural)
      application/in-memory-*.ts adaptadores en memoria
      contracts/*.contract.ts    syncOutboxContract, operationReceiverContract, folioAllocatorContract
    quotes/                    ← cotizador (S2-09..S2-18)
      domain/quote.ts            Quote, QuoteLine, QuoteStatus, tabla de transiciones, vencimiento derivado
      domain/quote-totals.ts     totales = suma de líneas (usa tax/)
      application/*.ts           CreateQuoteDraft, AddQuoteLine, ApplyQuoteDiscount, IssueQuote,
                                 MarkQuoteSent/Accepted/Rejected, DuplicateQuote, ShareQuote
      application/ports.ts       QuoteRepository (+ QuoteLocalRepository con guardado atómico)
      contracts/quote-repository.contract.ts
    documents/                 ← PDF (S2-19, S2-20)
      domain/quote-document.ts   modelo de documento ya calculado (sin reglas)
      application/ports.ts       DocumentRenderer, ShareService
apps/web/src/
  shared/infra/sync/           ← Dexie `zammir-operaciones` (outbox, quotes, customers locales, meta), transporte HTTP,
                                 planificador (evento `online`, temporizador)
  modules/quotes/{infra,ui}/   ← repositorio Dexie y Supabase, pantalla del cotizador
  modules/documents/infra/     ← adaptador PDF (pdf-lib) y de compartir (Web Share API)
supabase/
  migrations/…_operations.sql  ← `operations`, `folio_counters`, `devices.last_seq`, función `receive_operation`
  migrations/…_quotes.sql      ← `quotes`, `quote_lines`, vistas y change_seq
  functions/recibir-operacion/ ← Edge Function (Deno) que valida con `packages/core` y llama a la función SQL
```

### 4.2 Decisiones de diseño del sprint [PROPUESTAS; registrar en ADR al construir]

| # | Decisión | Por qué | ADR |
|---|---|---|---|
| D1 | **El receptor son dos capas:** Edge Function `recibir-operacion` (Deno + `packages/core`) que valida el sobre y el `payload` con Zod y **recalcula los totales** con el dominio; y una función SQL `public.receive_operation(p jsonb)` que en **una sola transacción** comprueba idempotencia y orden, aplica el documento, asigna el folio y guarda la operación. | Cumple ADR-0016 punto 7 sin una conexión directa a Postgres (que en Edge Functions es frágil); el folio y la idempotencia quedan atómicos en SQL; el dominio sigue siendo la única fuente de las reglas de dinero. S2-01 criterio 6 queda demostrado con la validación y recálculo en Deno (ya se prueba Deno + core con `registrar-dispositivo`). | 0023 |
| D2 | **`spike/sync` se ejecuta como pruebas de integración sobre la implementación real**, no como rama desechable. Las 6 pruebas de S2-01 se escriben una por una contra `receive_operation` y se corren en CI. | Evita escribir dos veces lo mismo; deja la evidencia ejecutable que pide la compuerta ("concurrencia 10 veces seguidas"). Al pasar, ADR-0012 y ADR-0016 pasan a *Aceptada* con el enlace a las pruebas. | 0023 (cierra 0012 y 0016) |
| D3 | **Un solo Dexie para lo local que debe cambiar en una transacción:** base `zammir-operaciones` con tablas `outbox`, `quotes`, `customers`, `meta`. Catálogo e identidad siguen en sus bases (no se escriben junto con operaciones). | IndexedDB solo da transacción dentro de una base; el documento y su operación deben guardarse juntos (S2-02). | 0024 |
| D4 | **Estados de la cotización:** `DRAFT → SENT` (al **emitir**: toma folio provisional, congela precios, calcula `valid_until`), `SENT → ACCEPTED`, `SENT → REJECTED`. `ACCEPTED` y `REJECTED` son finales. *Vencida* **no se guarda**: se deriva de `valid_until` y el reloj. "Cancelar" una cotización emitida = rechazarla; conserva folio. Una vencida **sí puede** marcarse aceptada o rechazada, con aviso de que los precios pueden haber cambiado (dudas para Luis → cuestionario). | `SINCRONIZACION.md` §5.1: el folio se recibe al emitir/enviar; `MODELO_DE_DATOS.md` lista cuatro estados. | 0025 |
| D5 | **Cada operación lleva el documento completo** (instantánea de la cotización con líneas y totales), no un parche. La operación `IssueQuote` es la única que crea una cotización en el servidor; los borradores **no se envían** (viven en la tablet). | Simplifica idempotencia y conflictos: lo contable se agrega. | 0023 |
| D6 | **Código público** de documento: 8 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sin 0/O/1/I/L), generado en la tablet con el documento; el servidor lo guarda con restricción de unicidad (si chocara, la operación queda "por revisar" con motivo, nunca se pisa). | RN-16; sirve para ubicar un comprobante impreso sin conexión y para el portal futuro. | 0023 |
| D7 | **PDF con `pdf-lib`** (JavaScript puro, funciona sin internet, fuentes estándar con acentos y ñ) y **`pdfjs-dist` solo en pruebas** para extraer el texto y compararlo con el dominio. *Verificar versiones vigentes en su documentación antes de instalar.* Logo de ZAMMIR: imagen de prueba hasta PD-11. | Cumple RNF-25 (< 3 s) y la prueba de "totales idénticos al centavo". | 0026 |
| D8 | **Compartir:** `navigator.share({ files })` si `navigator.canShare` lo permite; respaldo `https://wa.me/<10 dígitos con 52>?text=<mensaje codificado>` + descarga del PDF. | RF-M2-06, ADR-0005. | 0026 |
| D9 | **Año del folio = año de la fecha de emisión en hora de México** (PD-23, propuesta de `SINCRONIZACION.md` §5.3). Se calcula en el servidor con `issued_at at time zone 'America/Mexico_City'`. | Hay que confirmarlo con Juanito/Luis; queda como constante en un solo lugar. | 0023 |
| D10 | **Ventana de retención local** (PD de Fase 3, `local_retention_days` = null): mientras esté por definir se usa **90 días** como valor de trabajo, leído de la configuración si existe, y se avisa en el cuestionario. Solo afecta qué cotizaciones *ya enviadas* se conservan en la tablet; nada pendiente de enviar se depura jamás. | No inventar un valor silencioso. | — |

### 4.3 Esquema de datos (resumen; el detalle de columnas lo fija cada migración)

- `operations (op_id uuid pk, device_id, seq bigint, type, schema_version, payload jsonb, user_id, authorized_by, client_created_at, received_at default now(), status ['APPLIED','TO_REVIEW','FAILED'], reason, result jsonb)` con `unique (device_id, seq)`; inmutable salvo que nunca se actualiza (solo se agrega). Sin `DELETE`.
- `devices.last_seq bigint not null default 0` (última `seq` aplicada, para detectar saltos).
- `folio_counters (doc_type, year, last_value, primary key (doc_type, year))`; solo la función los toca.
- `quotes`, `quote_lines` según `MODELO_DE_DATOS.md` M2; `quotes.change_seq` (misma secuencia global que catálogo o una nueva `documents_change_seq`); disparadores que impiden cambiar totales, líneas y folio definitivo una vez asignado; vista `quotes_for_device` (propios + dentro de la ventana de retención, **sin datos fiscales del cliente**, RNF-06).
- RLS: la tablet **no** lee ni escribe `operations`/`folio_counters` directamente; solo ejecuta `receive_operation` (a través de la Edge Function con su sesión). El administrador lee `operations` (por revisar). Agregar sondas de permisos a la prueba de paridad.

### 4.4 La operación y el sobre (contrato)

```
OperationEnvelope = { opId, deviceId, seq, type, schemaVersion, userId, authorizedBy?, clientCreatedAt, payload }
Tipos del sprint: 'IssueQuote' | 'MarkQuoteAccepted' | 'MarkQuoteRejected' | 'UpsertCustomer'
Resultado = { status: 'APPLIED'|'TO_REVIEW', folio?: 'COT-2026-0012', reason?, appliedAt }
          | error estructural { code: 'OUT_OF_ORDER'|'DEVICE_REVOKED'|'USER_INACTIVE'|'UNKNOWN_TYPE'|'INVALID_PAYLOAD'|'TOTALS_MISMATCH', expectedSeq? }
```
- `OUT_OF_ORDER`: la tablet reenvía desde `expectedSeq`. `DEVICE_REVOKED`, `UNKNOWN_TYPE`, `INVALID_PAYLOAD`, `TOTALS_MISMATCH`: **estructurales** → la operación queda `FAILED`, la cola de ese dispositivo se detiene y se muestra "Hay un problema con un documento. Avisa a soporte." `USER_INACTIVE` (la persona se desactivó *antes* de operar pero la tablet no lo sabía): se aplica y queda `TO_REVIEW` [ADR-0013].
- Idempotencia: `op_id` repetido → mismo resultado guardado, **sin consumir folio ni repetir efectos**.

## 5. Orden de construcción recomendado y dependencias

```
Fase A  Servidor y folios        S2-04 → S2-03 → S2-01 (pruebas de concurrencia) → S2-05
Fase B  Motor en la tablet       S2-02 → S2-06 → S2-07 → S2-08
Fase C  Dominio del cotizador    S2-13/S2-14 (dominio) → S2-09 (líneas) → S2-11 → S2-18
Fase D  Pantallas                S2-10 → S2-09 (UI) → S2-12 → S2-15 → S2-16 → S2-17
Fase E  Documento y envío        S2-19 → S2-20
Fase F  Aceptación y cierre      S2-21 → S2-22
```
Razón: sin servidor idempotente y folios no hay nada que probar; el dominio de cotización va antes que su pantalla; el PDF necesita el modelo de documento ya calculado. **Si el tiempo aprieta se recortan, en este orden:** S2-16 (historial por cliente) → S2-15 (duplicar; el guardado de borrador **no** se recorta) → S2-12 (vista previa en dos paneles; queda la pestaña) → S2-17 (solo la parte de ajuste fino; teclado numérico y ambas orientaciones se quedan). **Nunca** se recorta: idempotencia, folios, totales, PDF correcto, descuento con PIN.

PRs sugeridos (cada uno cierra su compuerta): (1) S2-04+S2-03 · (2) S2-01 · (3) S2-05+S2-02 · (4) S2-06+S2-07+S2-08 · (5) dominio de cotización (S2-13, S2-14, S2-09 dominio, S2-11, S2-18) · (6) pantallas del cotizador (S2-10, S2-09 UI, S2-12, S2-15, S2-16, S2-17) · (7) S2-19+S2-20 · (8) S2-21+S2-22.

## 6. Historias, una por una

> Cada una indica **dónde construir**, **diseño**, **pruebas** (además de los criterios de `SPRINT-2.md`) y **trampas**.

### S2-04 · Folio definitivo (M, 4 h) — *primero*
**Dónde:** migración `…_operations.sql` (tabla `folio_counters`, función `private.next_folio(doc_type text, year int) returns bigint`), `core/modules/sync/domain/folio.ts`, contrato `folioAllocatorContract` (memoria y Supabase).
**Diseño:** `insert … on conflict do nothing` + `update … set last_value = last_value + 1 … returning last_value`; es el **último paso** de la transacción. `formatFolio('QUOTE', 2026, 12)` → `COT-2026-0012` (prefijos `COT`, `OT`, `V`, `F`; relleno a 4 dígitos, sin tope: `COT-2026-12345` válido). `folioYear(date)` → año en `America/Mexico_City` (con Intl; el reloj llega por puerto). `FolioAllocator` (puerto del servidor): `allocate(docType, year): Promise<number>`; el adaptador en memoria se turna con una cola para simular el bloqueo.
**Pruebas:** formato y cambio de año (31 dic 23:59:59 México vs. 1 ene; correr en otra zona horaria `pnpm test:zonas`); propiedad con fast-check "para cualquier secuencia de asignaciones y reversiones, los números por (tipo, año) son 1..N sin huecos"; en SQL (pgTAP): dos asignaciones en la misma transacción consecutivas, una transacción revertida no avanza; integración: 2 clientes en paralelo. `folio/` exige **100 % de cobertura y mutación ≥ 90 %** (agregar `folio/` a `stryker`/`mutacion-critica` si no está).
**Trampa:** no usar `sequence`/`nextval` (deja huecos).

### S2-03 · Receptor idempotente (L, 8 h)
**Dónde:** `…_operations.sql` (`operations`, `devices.last_seq`, `public.receive_operation(p jsonb) returns jsonb`, SECURITY DEFINER con `set search_path = ''`), `supabase/functions/recibir-operacion/index.ts`, `core/modules/sync/domain/operation.ts` (+ Zod), contrato `operationReceiverContract`.
**Algoritmo SQL (una transacción):** (1) `private.is_device()` y el dispositivo del JWT = `device_id` del sobre → si no, `DEVICE_REVOKED`; (2) `select … from operations where op_id = $1` → si existe, devolver su `result` tal cual (no tocar nada más); (3) bloquear la fila del dispositivo (`for update`) y comprobar `seq = last_seq + 1` → si no, `OUT_OF_ORDER` con `expectedSeq`; (4) `type` conocido; (5) persona activa en `app_users` (si no: aplicar y marcar `TO_REVIEW` con motivo); (6) despacho por tipo a funciones privadas (`private.apply_issue_quote(…)`, etc.); (7) folio al final; (8) insertar en `operations` con `status`, `result`, `received_at`; (9) `devices.last_seq = seq`; (10) bitácora. Toda la función en un bloque: cualquier excepción revierte todo (sin folio consumido).
**Edge Function:** autentica con la sesión de la tablet, valida el sobre y el `payload` con el Zod del núcleo, **recalcula totales** con el dominio (si difieren → `TOTALS_MISMATCH`), y llama `rpc('receive_operation')` con el mismo JWT. Devuelve el resultado.
**Pruebas:** contrato del receptor (memoria `inMemoryOperationReceiver` y Supabase); casos: repetida → mismo resultado, sin duplicar; `seq` saltado; dispositivo revocado; usuario desactivado → `TO_REVIEW`; tipo desconocido; versión de formato vieja migrada; `received_at` presente; la tablet **no** lee `operations` (sondas de permisos y paridad).
**Trampa:** la función SQL es la única que escribe `quotes`/`operations`; revocar `insert/update` de esas tablas a `authenticated`.

### S2-01 · Validación de sincronización (L, 8 h) — *sobre la implementación real (D2)*
**Dónde:** `apps/web/src/shared/infra/sync/sync.integracion.test.ts` (nuevo grupo en `test:integracion`).
Seis pruebas (una por criterio): (1) 200 operaciones desde dos dispositivos simultáneos → folios 1..200 sin huecos ni repetidos; (2) cortes aleatorios a mitad de operación, repetidos (≥ 50 rondas) → sin huecos, duplicados ni documentos a medias; (3) cada operación reenviada 2 o 3 veces → un registro por `opId`; (4) una tablet "sin conexión por horas" acumula 100 operaciones y las envía en orden; (5) Deno + core ejecuta la validación/recálculo (ya probado con la función real); (6) operación fuera de orden → `OUT_OF_ORDER` y reenvío corrige. Más la **compuerta de salida: la prueba de concurrencia corre 10 veces seguidas en verde** (script `scripts/repetir-concurrencia.mjs` o `for` en CI nocturno; documentar).
**Cierre:** ADR-0023 (decisiones D1, D2, D5, D6, D9) y cambiar el estado de ADR-0012 y ADR-0016 a *Aceptada* con el enlace a estas pruebas.

### S2-05 · Folio temporal (S, 2 h)
**Dónde:** `core/modules/sync/domain/folio.ts` (`formatTempFolio(series, n)` → `T1-0004`), `core/modules/sync/application/temp-folio.ts` (`TempFolioCounter` puerto: `next(): Promise<number>`; adaptador Dexie en la tabla `meta`), `generatePublicCode(random)` (D6).
**Diseño:** un solo contador por dispositivo para todos los tipos; se incrementa **al emitir**, nunca al crear un borrador; el contador se guarda en la misma transacción local que el documento (S2-02). `Random` es un puerto del núcleo (`nextInt(max)`), el adaptador real usa `crypto.getRandomValues`.
**Pruebas:** no se repite en 1000 emisiones; borrador sin folio; código público con alfabeto sin ambiguos y largo 8; propiedad de unicidad con `Random` determinista; el texto "Folio provisional T1-0004" sale de `textos.ts`.

### S2-02 · Cola de salida en la tablet (L, 8 h)
**Dónde:** núcleo: `ports.ts` (`SyncOutbox`), `enqueue-operation.ts`, `in-memory-sync-outbox.ts`, `contracts/sync-outbox.contract.ts`; web: `shared/infra/sync/dexie-operaciones.ts` (base `zammir-operaciones`, D3).
**Puerto:**
```
SyncOutbox {
  enqueue(op): Promise<Result<void, OutboxError>>          // valida el sobre antes de guardar
  nextToSend(): Promise<QueuedOperation | null>             // la de menor seq no confirmada
  markApplied(opId, result), markFailed(opId, reason), markToReview(opId, result)
  resendFrom(seq)                                           // tras OUT_OF_ORDER
  pendingCount(): Promise<number>; list(filter): Promise<QueuedOperation[]>
  nextSeq(): Promise<number>                                // consecutivo propio del dispositivo
}
```
**Guardado atómico:** el repositorio local de cada documento expone `saveWithOperation(documento, sobre)` que escribe documento + `outbox` + contador de folio provisional en **una transacción de Dexie** (en memoria: todo o nada). El `seq` se asigna dentro de esa transacción.
**Pruebas:** batería `syncOutboxContract` en memoria **y** Dexie; formato inválido rechazado antes de guardar; reabrir la base conserva la cola; versión nueva de la aplicación no borra operaciones viejas; crash simulado (excepción a mitad de la transacción) no deja documento sin operación ni al revés.
**Trampa:** la validación Zod del sobre vive en el núcleo (`parseEnvelope`), la misma que usa la Edge Function.

### S2-06 · Envío automático, reintentos y estado visible (M, 4 h)
**Dónde:** núcleo `run-sync.ts` (`runSync(deps)`: toma `nextToSend`, llama al transporte, interpreta el resultado), `BackoffPolicy` (`delayMs(attempt, random)` con base 2 s, factor 2, tope 5 min, ±20 % de variación); web: `shared/infra/sync/http-operation-transport.ts` (llama a la Edge Function con el cliente de la tablet) y `planificador.ts` (corre al abrir, al evento `online`, tras cada `enqueue` y con temporizador); `IndicadorDeConexion` muestra "N pendientes".
**Reglas:** error de red/5xx → reintento con espera creciente, sin límite; `OUT_OF_ORDER` → `resendFrom(expectedSeq)`; error estructural → `markFailed`, **se detiene la cola de ese dispositivo** y aparece el aviso para soporte; `TO_REVIEW` cuenta como enviada. Aviso si algo lleva más de `sync_stale_hours` sin salir (clave de configuración nueva, valor de trabajo **6 h**, registrar en PENDIENTES como valor por confirmar).
**Textos nuevos** (`textos.sincronizacion`, sin las palabras prohibidas): "Guardado en la tablet", "Enviado", "N pendientes", "Sin conexión. Puedes seguir trabajando.", "Hay documentos sin enviar desde hace X horas. Conéctate a internet.", "Hay un problema con un documento. Avisa a soporte.", "Para hacer esto necesitas internet".
**Pruebas:** con reloj y `Random` falsos: secuencia de esperas; red cae 3 veces y luego envía; error estructural detiene y no pierde nada; no reintenta lo `APPLIED`; el indicador muestra el conteo; prueba de vocabulario.

### S2-07 · Descarga de propios y reconciliación (M, 4 h)
**Dónde:** núcleo `reconcile-quotes.ts`; migración `quotes` con `change_seq` y vista `quotes_for_device`; web: réplica (`CatalogReplicaSource`-style) `QuoteReplicaSource` + Dexie.
**Diseño:** al confirmar una operación, la tablet recibe `{folio}` y actualiza el documento (`folio`, `syncStatus='SENT'`). Además baja por cursor (`change_seq`) las cotizaciones de la ventana de retención (para reinstalaciones y para el historial por cliente): **el documento del servidor reemplaza al local solo si no hay operaciones locales pendientes sobre él**; si las hay, se toma la versión del servidor y se **reaplican encima** las pendientes (SINCRONIZACION §7). No se bajan datos fiscales de clientes (RNF-06).
**Pruebas:** folio llega y se muestra; paginación sin duplicados; pendiente local sobrevive a la versión del servidor; reanudación tras corte; sin datos fiscales en lo replicado (aserción sobre la vista).

### S2-08 · Conflictos (M, 4 h)
**Dónde:** núcleo `domain/conflicts.ts` + migración (función de aplicación de `UpsertCustomer`, `MarkQuoteAccepted/Rejected`).
**Reglas (tabla de `SINCRONIZACION.md` §6):** `UpsertCustomer`: por campo, gana el último **que llega**, y el valor anterior queda en bitácora [RN-19]; cotización emitida: siempre se agrega; transición inválida (p. ej. aceptar una ya rechazada desde otra tablet) → se aplica como `TO_REVIEW` con motivo visible para el administrador, sin perder nada; precio distinto al actual: se acepta, el servidor guarda `catalog_version` y marca la diferencia informativa.
**Pruebas:** un caso por regla en el receptor (dos tablets editan el mismo cliente; aceptar y rechazar a la vez; precio cotizado distinto al actual). Pantalla mínima de "por revisar" para administrador (lista con motivo) en Usuarios o Bitácora.

### S2-13/S2-14 · Dominio: emitir y estados (M+S, 6 h)
**Dónde:** `core/modules/quotes/domain/{quote,quote-totals}.ts`, `application/issue-quote.ts`, `application/mark-quote-*.ts`.
**Diseño:** `QuoteStatus = 'DRAFT'|'SENT'|'ACCEPTED'|'REJECTED'`; `QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]>` (D4) y `transition(from, to): Result<…, { code: 'INVALID_TRANSITION' }>`. `displayStatus(quote, now)` devuelve `'EXPIRED'` si `SENT` y `now` posterior al **fin del último día de vigencia en hora de México** (`valid_until` es una fecha, no una hora; vigencia hasta las 23:59:59.999 MX de ese día). `validUntil(issuedAt, days)` = fecha de emisión en MX + `quote_validity_days`. `IssueQuote(deps, actor, draftId)`: exige `QUOTE_CREATE`, ≥ 1 línea, cliente, congela líneas (copia nombre, unidad, precio, regla y parámetros, medidas, datos fiscales; `catalog_version`), calcula totales con el dominio, asigna `tempFolio` + `publicCode`, `condiciones` (copia del texto vigente, S2-18) y versión del aviso de privacidad, `valid_until`, y **guarda documento + operación `IssueQuote` atómicamente**.
**Pruebas (de la fase):** cada transición válida y cada inválida con error tipado; vencimiento un segundo antes y después del fin del último día, **en otra zona horaria**; precio congelado (cambiar el catálogo no cambia lo emitido); total = suma de líneas con la tabla de oro; emitir sin líneas o sin cliente rechazado.

### S2-09 · Líneas del catálogo y cálculo visible (L, 8 h)
**Dónde:** núcleo `application/{add-quote-line,update-quote-line,remove-quote-line}.ts` sobre el borrador; `domain/quote-line.ts` (usa las reglas de precio por `ruleId` y `formatPriceDetail`); UI `modules/quotes/ui/Cotizador.tsx` (+ `LineaDeCotizacion.tsx`, `CalculoVisible.tsx`).
**Diseño:** una línea guarda la **instantánea** (D5/RN-03 aplica desde que se emite; en borrador se guarda también copia para mostrar aunque el catálogo cambie). Entrada en cm o m con `parseLength` (rechaza sub-mm); cantidad entera ≥ 1; el desglose usa `areaLineTotal`/`linearAmount`/pieza/servicio según la regla y `splitTax` del dominio. El cálculo visible es `formatPriceDetail` ("120 cm × 80 cm × 2 = 1.92 m² × $280.00"). Catálogo vacío → `Aviso` cerrable "Revisa primero tu catálogo" (RF-UX-05). Los productos vienen de `localProductReader`.
**Pruebas:** el importe de pantalla = importe del dominio (propiedad); cm vs m; pieza y servicio; sin teclado propio: `inputMode="decimal"` (RNF-28/S2-17); catálogo vacío.

### S2-10 · Cliente dentro del cotizador (S, 2 h) — *incluye el paso a operación en cola*
**Dónde:** núcleo `customers/application/` (`UpsertCustomer` como operación), web: tabla `customers` local en `zammir-operaciones` + réplica por `change_seq` desde `customers_for_device` (migración: agregar `change_seq` a `customers`); `ClienteEnCotizador.tsx`.
**Diseño:** buscar con `searchCustomers` sobre lo local; capturar nombre + WhatsApp (`normalizePhone`), domicilio de obra opcional, registrar versión del aviso de privacidad vigente. La alta pasa a `saveWithOperation` + operación `UpsertCustomer` (**sustituye el alta directa de ADR-0021**: registrar en ADR-0023 y actualizar la pantalla Clientes de la tablet). Aviso de duplicado posible (`findPossibleDuplicates`), no bloquea.
**Pruebas:** alta sin conexión queda "Guardado en la tablet" y se envía al volver; duplicado avisa; cliente nuevo registra versión del aviso.

### S2-11 · Cargos y descuentos con autorización (M, 4 h)
**Dónde:** núcleo `apply-quote-discount.ts` (`ApplyQuoteDiscount(deps, actor, quoteId, lineId, nuevoPrecio, authorization?)`); UI: diálogo de PIN (reusar `EntrarConPin`-teclado o extraer `TecladoPin`).
**Diseño:** cargo adicional = línea de servicio del catálogo (PD-42: medición y flete son servicios del catálogo). Descuento = cambio del precio unitario de una línea; **cualquier descuento exige PIN de administrador** (PD-45, valor de trabajo): `PermissionPolicy.check(role,'PRICE_OVERRIDE')` → cajero necesita `authorizeWithAdminPin` y se guarda `authorizedBy`; administrador `ALLOW` y queda registrado igual. Bitácora `QUOTE_LINE_PRICE_CHANGED` con valor anterior y nuevo (agregar a `AuditAction`), y el sobre de `IssueQuote` lleva `authorizedBy`. El precio nuevo nunca puede ser negativo; descuento mayor que el precio → error.
**Pruebas:** cajero sin autorización rechazado; con PIN correcto aplica y registra; PIN de cajero o de administrador desactivado rechazado; bloqueo por intentos; administrador aplica y queda en bitácora; e2e "cajero intenta descuento: se pide PIN".

### S2-18 · Condiciones editables (S, 2 h)
**Dónde:** claves de configuración `quote_conditions` (arreglo de 3 textos; sembrar las de RN-13, editables) vía `business_settings` (solo administrador cambia valor); `core/settings`; pantalla en Configuración.
**Diseño:** se **copian** al emitir (`quotes.conditions_text`); editar no cambia las emitidas. Cajero rechazado (dominio + RLS).
**Pruebas:** emitida antes conserva el texto viejo; cajero no edita (dominio y base); parse Zod del arreglo.

### S2-12 · Vista previa en vivo (M, 4 h) · S2-17 · Campo (S, 2 h)
**Diseño:** `Cotizador` es de dos paneles con CSS grid a partir de 900 px de ancho (datos | documento) y pestañas "Datos / Vista previa" por debajo; la vista previa es HTML renderizado desde **el mismo modelo de documento** que usará el PDF (`quote-document`), así no hay dos cálculos. Ambas orientaciones sin recortes; botones ≥ 44 px, texto ≥ 16 px; campos de medida con teclado numérico.
**Pruebas:** componente con `matchMedia`/ancho simulado; e2e Playwright con viewports de tablet vertical y horizontal (el proyecto ya tiene el tamaño de tablet).

### S2-15 · Duplicar y borradores (S, 2 h) · S2-16 · Historial por cliente (S, 2 h)
**Diseño:** `DuplicateQuote` crea un borrador nuevo **sin folio**, con los mismos conceptos y **precios actuales** del catálogo (productos desactivados se omiten con aviso). Borradores en la tabla `quotes` local con `status='DRAFT'`, guardado automático con espera de 800 ms tras cada cambio y al bloquear la tablet (`ActiveUserSession` → guardar antes de `LOCKED`); se recuperan por persona. Historial: lista por cliente con folio (o provisional), fecha, estado (`displayStatus`) y total, desde lo local.
**Pruebas:** duplicar usa precio actual; borrador recuperado tras reabrir la base; el historial muestra "vencida" con el reloj fijo.

### S2-19 · PDF carta en la tablet (L, 8 h)
**Dónde:** `core/modules/documents/domain/quote-document.ts` (`buildQuoteDocument(quote, business, legal)`: modelo ya calculado: líneas con medidas y cálculo en texto, subtotal, IVA, total, condiciones, aviso abreviado, folio o folio provisional + código público), `application/ports.ts` (`DocumentRenderer { render(doc): Promise<Uint8Array> }`), contrato `documentRendererContract`; web: `documents/infra/pdf-lib-renderer.ts`, `fake-renderer`.
**Diseño:** carta (612 × 792 pt), logo y datos de ZAMMIR desde `business_settings` (de prueba, PD-11), formato `$1,234.50`, fecha `27 oct 2026`, teléfono a 10 dígitos (RN-22); nunca se escribe HummingX (RN-21); paginación automática con encabezado repetido y totales al final; fuente estándar WinAnsi (acentos y ñ); texto largo se parte en líneas, no se corta. Espacio de firma. Aviso de privacidad abreviado = texto de prueba (PD-12) tomado de `legal_documents`.
**Pruebas:** con `pdfjs-dist` (solo pruebas) se **extrae el texto** y se compara con el modelo: folio, cliente, cada línea con medida, subtotal, IVA, total **idénticos al centavo** para todos los casos de la tabla de oro; acentos/ñ/nombres largos; muchas líneas → varias páginas; folio provisional + código público cuando no está enviada; medida de tiempo (< 3 s con cotización típica; en CI solo se vigila una cota holgada, la medición real es manual en tablet).

### S2-20 · Compartir por WhatsApp (M, 4 h)
**Dónde:** `documents/application/share-quote.ts` (`ShareService { canShareFiles(): boolean; share(file, text): Promise<Result<…>> }`), adaptadores `webShareService` (navigator.share) y `whatsappLinkService` (`wa.me`), `buildWhatsAppMessage(quote)` (texto con acentos/ñ **codificado con `encodeURIComponent`**).
**Pruebas:** mensaje bien codificado; sin soporte de archivos usa el respaldo (enlace + descarga); no existe función de imprimir carta.

### S2-21 · Aceptación E3 (parte de cotizaciones) (M, 4 h)
**Dónde:** `apps/web/e2e/e3-cotizaciones-sin-conexion.spec.ts` (Playwright, `context.setOffline(true)`, tamaño de tablet) + `integracion` equivalente con dos dispositivos.
Flujo: entrar con PIN → modo avión → 3 cotizaciones (buscar cliente, vidrio a medida y un servicio, vista previa, emitir, PDF) → reconectar → cero duplicados, folios definitivos correctos y consecutivos, totales exactos. Necesita servidor local con funciones encendidas (`scripts/test-integracion.mjs` ya lo hace; replicar para e2e).

### S2-22 · Cierre del sprint (S, 2 h)
Compuerta común en verde; concurrencia de folios 10 veces seguidas; totales del PDF = dominio en toda la tabla de oro; mutación completa ≥ umbral (agregar `folio/` y `quotes/domain/quote-totals` al conjunto crítico); ADR-0012 y 0016 *Aceptadas*; lista de tablet (cotizar en modo avión, PDF, compartir por WhatsApp, PBKDF2) **se deja como pendiente de las tablets**; retrospectiva y recalibración de `MEDICION.md` y `CAPACIDAD.md` con las horas reales.

## 7. Textos nuevos que habrá que escribir (todos en `textos.ts`)

`textos.cotizador` (títulos, "Agregar producto", "Ancho", "Alto", "Cantidad", "Unidad", "Subtotal", "IVA", "Total", "Vigencia", "Condiciones", "Emitir cotización", "Duplicar", estados: Borrador/Enviada/Aceptada/Rechazada/Vencida, errores con "qué hacer"), `textos.sincronizacion` (lista de §6 S2-06), `textos.documento` (encabezados del PDF y mensaje de WhatsApp), `textos.descuento` (pedir PIN de administrador). Revisar siempre contra `docs/producto/GLOSARIO.md` (palabras prohibidas).

## 8. Riesgos y recortes

| Riesgo | Mitigación |
|---|---|
| El motor se atrasa (el más grande del proyecto) | Orden de la sección 5; recortes listados; el motor se prueba por contrato y por propiedad, no solo por UI |
| El recálculo de totales en la Edge Function rechaza por diferencias de redondeo | Una sola implementación (`packages/core`) en tablet y servidor; prueba cruzada con la tabla de oro |
| La función SQL se vuelve grande | Una función privada por tipo de operación; `receive_operation` solo orquesta; pgTAP por cada una |
| PDF lento en la tablet | Fuentes estándar sin incrustar; logo pequeño; medir al final con la tablet |
| IndexedDB borrado por el navegador | `navigator.storage.persist()` al registrar la tablet y aviso si se niega (pendiente de verificar en la tablet) |
| Valores sin definir (PD-23 año del folio, PD-45 descuentos, PD-42 medición/flete, retención local, horas de aviso) | Constantes/configuración con valor de trabajo y entrada en `CUESTIONARIO_LUIS.md` |

## 9. Estado de las historias

| Historia | Talla | Estado | Rama / PR |
|---|---|---|---|
| S2-04 Folio definitivo | M | **hecha** (PR #56) | `feat/s2-04-folio` |
| S2-03 Receptor idempotente | L | **hecha** (PR #57) | `feat/s2-03-receptor` |
| S2-01 Validación de sincronización | L | **hecha** (ADR-0023, PR #58) | `feat/s2-01-validacion-sync` |
| S2-05 Folio temporal | S | **hecha** (PR de S2-02) | `feat/s2-02-cola-de-salida` |
| S2-02 Cola de salida | L | **hecha** (PR #59) | `feat/s2-02-cola-de-salida` |
| S2-06 Envío automático y estado | M | **hecha** (PR #60) | `feat/s2-06-envio-automatico` |
| S2-07 Descarga y reconciliación | M | pendiente | |
| S2-08 Conflictos | M | pendiente | |
| S2-13 / S2-14 Emitir y estados (dominio) | M+S | pendiente | |
| S2-09 Líneas y cálculo visible | L | pendiente | |
| S2-10 Cliente en el cotizador | S | pendiente | |
| S2-11 Cargos y descuentos | M | pendiente | |
| S2-18 Condiciones editables | S | pendiente | |
| S2-12 Vista previa en vivo | M | pendiente | |
| S2-15 Duplicar y borradores | S | pendiente | |
| S2-16 Historial por cliente | S | pendiente | |
| S2-17 Uso en campo | S | pendiente | |
| S2-19 PDF carta | L | pendiente | |
| S2-20 Compartir por WhatsApp | M | pendiente | |
| S2-21 Aceptación E3 | M | pendiente | |
| S2-22 Cierre del sprint | S | pendiente | |

## 10. Lista de verificación al terminar cada historia

1. Los criterios de aceptación de `SPRINT-2.md` están cubiertos por pruebas con nombre en español.
2. Compuerta local completa (sección 3) en verde; `pnpm test:db` y `pnpm test:integracion` si se tocó la base o un adaptador.
3. Textos nuevos en `textos.ts`, sin palabras prohibidas; variables nuevas en `.env.example`.
4. Si hay tabla o permiso nuevo: pgTAP, sondas en la prueba de paridad y `docs/arquitectura/MODELO_DE_DATOS.md` actualizado.
5. ADR escrito y fila en `DECISIONES.md` para cada decisión nueva (D1..D10 que se implementen).
6. Dudas de negocio nuevas → `CUESTIONARIO_LUIS.md`; ideas nuevas → `PENDIENTES.md` (Propuestas).
7. Esta tabla (sección 9) actualizada, con rama y PR.
