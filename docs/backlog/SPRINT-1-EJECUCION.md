# Sprint 1: guía de ejecución

> **Para qué sirve este documento.** Es el "cuaderno de trabajo" del Sprint 1. Una sesión nueva (humana o agente) debe poder leer **solo este archivo + la historia que le toque en `SPRINT-1.md`** y empezar a construir, sin volver a leer todo el repositorio.
> **Estado:** escrito el 30 oct 2026, con S1-01 a S1-07 terminadas. Se actualiza al terminar cada historia (sección 2 y la tabla de la sección 6).
> Lo que ya está decidido no se vuelve a discutir; lo que está marcado **[PROPUESTA]** lo propuso el desarrollador y se puede cambiar, pero se construye así mientras nadie diga otra cosa (y se registra en un ADR).

## 1. Reglas que no se rompen (resumen de `CLAUDE.md`)

1. No inventar reglas de negocio. Si algo está en `PENDIENTES.md`: hacerlo **configurable** y avisar. Dudas de negocio nuevas van a `docs/producto/CUESTIONARIO_LUIS.md` (una sola ronda con Luis), no se le preguntan por separado.
2. Dinero en centavos enteros; medidas en mm enteros; nada de flotantes. Fechas en UTC, mostradas en `America/Mexico_City`.
3. Interfaz en español de México con el vocabulario del glosario. **Prohibido** en textos: sincronizar, offline, login, checkout, carrito, POS. Todo texto va en `apps/web/src/shared/i18n/textos.ts` (la prueba de vocabulario lo recorre).
4. Nada contable se borra: se desactiva o se cancela con motivo. Lo sensible deja bitácora (`audit_log`, solo se agrega).
5. Sin secretos ni datos reales. Datos de prueba inventados.
6. **No se avanza con algo en rojo.** No se bajan umbrales, no se desactivan pruebas (`it.skip`/`only` están prohibidas por lint).
7. Cada decisión técnica o de negocio nueva → ADR en `docs/decisiones/` + fila en `DECISIONES.md`.
8. No construir lo que no esté en `REQUERIMIENTOS.md`; si falta algo, proponerlo en `PENDIENTES.md`.

## 2. Qué ya existe (no rehacer)

### 2.1 Historias terminadas y dónde está el código

| Historia | PR | Rama | Contenido |
|---|---|---|---|
| S1-01 a S1-03 | #33 | `feat/s1-01` | `Money`, medidas, IVA/anticipo y casos de oro |
| S1-04 | #34 | `feat/s1-04-reglas-de-precio` | Reglas de precio como estrategias |
| S1-05 | #37 | `feat/s1-05-catalogo` | Catálogo: modelo, 11 categorías, adaptadores |
| S1-06 | #38 | `feat/s1-06-editar-catalogo` | Editar/desactivar, historial de precios, bitácora |
| S1-07 | #39 | `feat/s1-07-busqueda` | Búsqueda tolerante |
| (valores) | #32 | `feat/valores-iniciales` | PD-21 = 30 min, PD-48 = 15 min (propuestos), modelos de impresora y tablet |
| S1-10 | #44 | `feat/s1-10-clientes` | `normalizePhone` (core/shared-kernel), `Customer`, `buildCustomer`, `CustomerRepository` (create/update/get/list/findByPhone/anonymize), `createCustomer`/`updateCustomer` (`ManageCustomersDeps`, con `privacy?` opcional), tabla `customers` (+ vista `customers_for_device` sin datos fiscales), `supabaseCustomers(cliente,{conDatosFiscales})`, pantalla Clientes. Contrato `customerRepositoryContract` + `clientesEnMemoriaDePrueba()` |
| S1-11 | #45 | `feat/s1-11-clientes-busqueda` | `searchCustomers`, `findPossibleDuplicates` (avisa, no bloquea), buscador y aviso en la pantalla |
| S1-12 | #46 | `feat/s1-12-anonimizar` | `anonymizeCustomer`, función SQL `anonymize_customer` (nombre `Cliente anonimizado`, teléfono `0000000000`), disparador que impide editar anonimizados, `CUSTOMER_ANONYMIZED` sin datos personales |
| S1-13 | #47 | `feat/s1-13-aviso-de-privacidad` | módulo `legal`: `LegalDocumentRepository` (solo agrega versiones; la base asigna `version`), `publishLegalDocument` (permiso `PRIVACY_NOTICE_EDIT`), `getCurrentLegalDocument`, `currentVersion`, borrador v1 sembrado, pantalla en Configuración; `createCustomer` anota la versión vigente. No se creó `privacy_acknowledgments` (basta `customers.privacy_notice_version`) |
| S1-17 | #43 | `feat/s1-17-autorizacion` | `authorizeWithAdminPin(deps,{adminId,pin})` → `Authorization`; `PinAttemptGuard` (`inMemoryPinAttemptGuard(clock, politica\|null)`) y `lockDurationSeconds`; `AuditEntry.authorizedBy?` (+ columna `audit_log.authorized_by`); ajustes `pin_max_failed_attempts`=5, `pin_lock_seconds`=30, `pin_lock_max_seconds`=900 |
| S1-18 | #42 | `feat/s1-18-permisos` | `PermissionPolicy` (`defaultPermissionPolicy.check(role, permission)`), `PERMISSION_MATRIX`, `createPermissionPolicy(overrides)`, `isPermitted`; prueba de paridad con la base en `apps/web/src/modules/identity/paridad-de-permisos.integracion.test.ts` (al agregar una tabla nueva con permiso, **sacar su permiso de la lista "pendiente" y agregar sondas**) |
| S1-14 | #41 | `feat/s1-14-usuarios` | Usuarios con PIN: `validatePin`, `PinHasher`, casos de uso, `app_users`, vista `login_users`, `webCryptoPinHasher`, pantalla |

Las ramas están apiladas (#33 → #34 → #37 → #38 → #39). **La siguiente rama de trabajo sale de la última rama apilada que siga abierta** (hoy `feat/s1-07-busqueda`) o de `origin/main` si ya se fusionó todo. Fusionar de abajo hacia arriba; **nunca** `push --force`.

### 2.2 Inventario del núcleo (`packages/core/src`, TypeScript puro, sin React/Supabase/Dexie)

| Pieza | Archivo | Qué da |
|---|---|---|
| Resultado | `shared-kernel/result.ts` | `Result<T,E>`, `ok`, `err`, `map`, `andThen`, `unwrapOr`. **Los errores de negocio son valores, no excepciones.** |
| Reloj / ids | `shared-kernel/clock.ts`, `id.ts` | `Clock`, `fixedClock`; `Id<'X'>` con marca (`ProductId`, `CategoryId`, `UserId`, `DeviceId`…), `IdGenerator`, `asId`, `sequentialIdGenerator('p')` |
| Dinero | `shared-kernel/money/money.ts` | `Money` (centavos), `money(c)`, `add`, `subtract`, `multiply`, `sum`, `compare`, `formatMoney`, `ZERO`. **100 % líneas/ramas obligatorio.** |
| Medidas | `shared-kernel/measure/length.ts` | `parseLength(texto, 'cm'\|'m', maxMm)` → `Millimeters`; `areaMm2` |
| IVA/importes | `shared-kernel/tax/tax.ts` | `areaLineTotal`, `areaAmount`, `linearAmount`, `splitTax`, `splitDocumentTax`, `computeDeposit`. **100 % obligatorio.** |
| Reglas de precio | `modules/catalog/domain/pricing/*` | Reglas `AREA`, `LINEAR` (exige `basis`), `PIECE`, `SERVICE`; `createPriceRegistry`, `defaultRules`, `formatPriceDetail`. **100 % obligatorio.** |
| Catálogo | `modules/catalog/domain/product.ts`, `search.ts`, `initial-categories.ts` | `Product`, `Category`, `FiscalData`, `buildProduct(id, borrador, reglas)`, `PriceChange`, `searchProducts`, `normalizeSearchText`, `INITIAL_CATEGORIES` |
| Catálogo (app) | `modules/catalog/application/*` | Puertos `ProductReader` (para vender), `ProductAdmin` (create/update/get/list/priceHistory; **sin borrar**), `CategoryReader`; casos `createProduct`, `updateProduct`; `inMemoryCatalog({idGenerator, clock, auditLog})` |
| Dispositivos | `modules/devices/*` | `DeviceRepository`, casos `issueRegistrationCode`/`listDevices`/`revokeDevice`/`redeemRegistrationCode`, `inMemoryDeviceRepository` |
| Identidad | `modules/identity/*` | `UserRole = 'ADMIN'\|'STAFF'\|'DEVICE'`, `AdminAuth`, `signInAdmin`, `hasIdleExpired`, `inMemoryAdminAuth` |
| Bitácora | `modules/audit/*` | `AuditEntry`, `AuditAction` (unión: agregar aquí las acciones nuevas), `AuditLog.append`, `recordAuditEntry(deps,{userId,deviceId,action,entityType,entityId,oldValue,newValue})`, `inMemoryAuditLog` |
| Usuarios y PIN | `modules/identity/{domain/pin.ts,domain/user.ts,application/manage-users.ts,application/user-ports.ts,application/in-memory-users.ts}` | `validatePin(pin, role, {adminMinDigits})`, `PinVerifier`, `AppUser`, `PinHasher` (puerto; `fakePinHasher()` para pruebas, `webCryptoPinHasher` real en `apps/web/src/shared/infra/`), `sameTextConstantTime`, casos `createUser/updateUser/resetPin/setUserActive` (`ManageUsersDeps`, `UserPolicy {adminMinDigits, pbkdf2Iterations}`), `UserRepository` (sin borrar), `inMemoryUsers`. Baterías `pinHasherContract` y `userRepositoryContract`. Tipo `Actor` único en `identity/domain/auth.ts` |
| Configuración | `modules/settings/*` | `parseBusinessSettings` (Zod, claves en inglés), `SettingsRepository`, `FeatureFlags`. Claves ya sembradas: `tax_rate_bps`, `deposit_percent_bps`, `quote_validity_days`, `idle_lock_minutes`(5), `admin_idle_logout_minutes`(30), `device_code_validity_minutes`(15), `admin_pin_min_digits`(6), `pin_pbkdf2_iterations`(600000), `pin_max_failed_attempts`(null), `pin_lock_seconds`(null)… |

`index.ts` exporta lo público; `testing.ts` exporta las **baterías de contrato** y datos de prueba (`@zammir/core/testing`).

### 2.3 Inventario de la aplicación y la base

- **Web (`apps/web/src`)**: `App.tsx` (rutas; secciones de administrador envueltas en `ProtegidaAdmin`), `main.tsx`, `composition/index.ts` (**único** lugar donde se eligen adaptadores reales), `shell/` (Layout, `secciones.ts` con `soloAdministrador`, `IndicadorDeConexion`), `shared/ui/` (`Boton`, `Campo`/`CampoNumerico`, `Aviso`, `Confirmacion`, `formatos.ts`, `estilos.css`), `shared/i18n/textos.ts` y `vocabulario.ts`, `modules/<x>/infra|ui/`. Ya hay UI de entrada de administradores y de tablets (`modules/devices/ui/Dispositivos.tsx`, dentro de la sección Usuarios).
- **Supabase**: migraciones en `supabase/migrations/` (base, settings, audit_log, devices, valores_iniciales, catalog, catalog_edit, users), pruebas pgTAP en `supabase/tests/NN_*.test.sql`, funciones de servidor en `supabase/functions/` (`registrar-dispositivo`; el núcleo se empaqueta con `pnpm funciones:empaquetar`).
- **Funciones SQL de ayuda**: `private.is_admin()` y `private.is_device()` (la segunda exige un dispositivo **activo**). Tablas con RLS por rol (vistas `sellable_products` y `login_users` para lo que lee la tablet); `audit_log` y `product_price_history` son inmutables (disparador que lo impide incluso al dueño).
- **Local de pruebas**: Supabase local en puertos 553xx; `pnpm test:integracion` enciende las funciones si hace falta.

## 3. Cómo trabajar (entorno y comandos)

- **Carpeta de trabajo:** `C:\z\s16` (ruta corta por el límite de Windows). Crear la rama **desde ahí**: `git checkout -q -b feat/s1-XX-tema <rama-base>`.
- **pnpm no está en el PATH** de la shell: en Bash `export PATH="/c/z/bin:$PATH"`; en PowerShell `$env:Path = "C:\z\bin;$env:Path"`. Node 24, Docker Desktop encendido para Supabase.
- **Los heredocs largos fallan en Bash** (se truncan con comillas simples). Para crear archivos usar la herramienta **Write**; para ediciones pequeñas, scripts de Python o `Edit`.
- **Nunca** `git add -A` en ramas viejas (se coló un archivo generado una vez). Agregar rutas explícitas (`git add packages apps supabase docs`).
- **Commits**: mensaje en español, `feat(modulo): ... (S1-XX)`, terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. **PR** con cuerpo en español y al final `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Abrir cada PR contra la rama anterior de la pila.
- **Comandos de la compuerta** (correr antes de subir):

| Paso | Comando |
|---|---|
| Tipos | `pnpm typecheck` |
| Lint (0 advertencias) | `pnpm lint` |
| Formato | `pnpm exec prettier --write <rutas>` y `pnpm format:check` |
| Capas | `pnpm check:deps` |
| Variables de entorno | `pnpm check:env` (toda variable nueva va a `.env.example`) |
| Unitarias + cobertura | `pnpm test:cobertura` (umbral 85 % líneas; 100 % en `money/`, `tax/`, `pricing/`, `folio/`) |
| Base de datos | `pnpm db:reset` y `pnpm test:db` |
| Integración | `pnpm test:integracion` |
| Mutación crítica | `pnpm test:mutacion:critico` (≥ 90 %; hoy 100 %) |
| Extremo a extremo | `pnpm test:e2e` |

- **Estilo de código** (lo exige el lint): sin `any`, sin `!`, sin variables sin usar (ni `_x`), `exactOptionalPropertyTypes` (los opcionales llevan `| undefined` si se pasan explícitos), preferir `?.`, sin `Date.now()`/`new Date()`/`Math.random()`/`window`/`fetch` en `packages/core` (llegan por puertos), aserción de tipo solo para marcas (`as Money`) con comentario. Comentarios y nombres de pruebas en español; identificadores en inglés.

## 4. Recetas repetibles

**Receta A — una historia con base de datos y varios adaptadores** (la usaron S0-15, S0-16, S1-05, S1-06):
1. Dominio y puertos en `packages/core/src/modules/<m>/{domain,application}`.
2. Adaptador **en memoria** + **batería de contrato** en `contracts/<x>.contract.ts` (la pasa también cada adaptador real). Exportar la batería en `testing.ts`.
3. Migración nueva `supabase/migrations/<AAAAMMDDHHMMSS>_<tema>.sql`: RLS por rol con `private.is_admin()`/`private.is_device()`; sin permiso de `DELETE`; si algo debe quedar registrado, que lo haga un **disparador** (así no se puede olvidar).
4. Prueba pgTAP `supabase/tests/NN_<tema>.test.sql` con los roles (`set_config('request.jwt.claims', …)` + `set local role authenticated`/`anon`). **Contar bien el `plan(N)`**.
5. Adaptador Supabase en `apps/web/src/modules/<m>/infra/` + prueba `*.integracion.test.ts` que corre la batería de contrato y los permisos (cajero, tablet, anónimo). El resultado `.data` del cliente es `any`: leerlo como `unknown` y convertir (ver `supabase-catalog.ts`).
6. Casos de uso solo para quien corresponde (patrón `actor: { role }`, `NOT_AUTHORIZED` antes de tocar el puerto).
7. UI en `apps/web/src/modules/<m>/ui/` con textos en `textos.ts`; pruebas de componente; registrar el adaptador en `composition/index.ts`.

**Receta B — pantalla de administrador**: componente en `modules/<m>/ui/`, ruta dentro de `ProtegidaAdmin`, estados vacío/cargando/error con "qué hacer" (`Aviso`), confirmación en acciones destructivas (`Confirmacion`), prueba con `inMemoryAdminAuth` (ver `dispositivos.test.tsx`).

**Receta C — migración que cambia una tabla existente**: revisar qué pruebas pgTAP e integración la tocan y ajustarlas en el mismo PR.

## 5. Decisiones ya tomadas que afectan lo que falta

| Tema | Decisión |
|---|---|
| Precios | Incluyen IVA; desglose **por línea**, mitad hacia arriba; anticipo hacia arriba, saldo por resta [ADR-0011] |
| Medidas | `125.55 cm` (más fino que 1 mm) **se rechaza**, no se redondea |
| Metro lineal | La base (`LENGTH`/`PERIMETER`) la define cada producto, sin valor por omisión (PD-25) |
| Categorías | Sembradas las 11 de RF-M1-02; las propuestas (laminado, canceles, policarbonato…) esperan a Luis (PD-49) y se agregan con otra migración |
| PIN | Verificadores **en la tablet** (opción A); PBKDF2-HMAC-SHA256 con sal propia e iteraciones medidas en la tablet real; se elige usuario y luego PIN; se rechazan triviales; administradores con 6 dígitos mínimo para autorizar (configurable); intentos fallidos con bloqueo creciente [ADR-0013] |
| Dispositivos | Un dispositivo revocado deja de leer ajustes, catálogo y de escribir bitácora (`is_device()` exige activo) |
| Valores propuestos | Cierre de sesión de administrador 30 min (PD-21); código de registro 15 min (PD-48); ambos configurables, por confirmar con Luis |

## 6. Historias que faltan, una por una

Orden recomendado (por dependencias): **S1-14 → S1-18 → S1-17 → S1-10 → S1-11 → S1-12 → S1-13 → S1-08 → S1-19 → S1-09 → S1-15 → S1-16 → S1-20 → S1-21**. Razón: usuarios y permisos primero porque casi todo lo demás los usa; Dexie (IndexedDB) entra con S1-09 y desbloquea el adaptador local de clientes y la entrada con PIN.

| Historia | Estimado | Estado | Bloqueo |
|---|---|---|---|
| S1-14 Usuarios y PIN | 4 h | **hecha** (PR #41) | — |
| S1-18 Matriz de permisos | 8 h | **hecha** (PR #42) | PD-17 (configurable) |
| S1-17 Autorización por PIN | 2 h | **hecha** (PR #43) | — |
| S1-10 Clientes: ficha | 4 h | **hecha** (PR #44) | adaptador IndexedDB espera S1-09 |
| S1-11 Clientes: búsqueda y duplicados | 2 h | **hecha** (PR #45) | S1-10 |
| S1-12 Clientes: anonimización | 2 h | **hecha** (PR #46) | S1-10, S1-18 |
| S1-13 Aviso de privacidad | 4 h | **hecha** (PR #47) | PD-12 (borrador propio) |
| S1-08 Importación del catálogo | 8 h | pendiente | PD-03 (catálogo de prueba) |
| S1-19 Pantalla de bitácora | 2 h | pendiente | — |
| S1-09 Catálogo sin conexión | 4 h | pendiente | prueba manual en tablet |
| S1-15 Entrada con PIN | 8 h | hecha en código (PR de entrada con PIN); falta prueba en tablet | S1-14, S1-09; PD-22 (propuesta mía); tablet |
| S1-16 Cambio de usuario y bloqueo | 2 h | hecha en código (misma PR); falta prueba en tablet | S1-15; tablet |
| S1-20 Aceptación E4 y E8 | 2 h | pendiente | S1-15, S1-18 |
| S1-21 Cierre del Sprint 1 | 2 h | pendiente | todo lo anterior; tablet |

---

### S1-14 · Usuarios: alta, edición, desactivación y PIN (4 h) — HECHA (PR #41)
**Criterios:** ver `SPRINT-1.md`. **Requerimientos:** RF-M8-01, RF-M8-04.
**Diseño:**
- Dominio `modules/identity/domain/user.ts`: `AppUser { id: UserId, name, role: 'ADMIN'|'STAFF', isActive, pin: PinVerifier | null, authUserId? }`; `PinVerifier { salt, iterations, hash, version }` (base64).
- Puerto `PinHasher { hash(pin, params): Promise<PinVerifier>; verify(pin, verifier): Promise<boolean> }` (el verify compara en **tiempo constante**). Adaptador real con **WebCrypto PBKDF2-HMAC-SHA256** en `apps/web/src/shared/infra/` (el núcleo no toca `crypto.subtle`: es un puerto). Adaptador falso rápido para pruebas (pocas iteraciones, mismo contrato).
- `validatePin(pin, rol, config)`: solo dígitos; 4 a 6 (administradores: mínimo `admin_pin_min_digits` = 6, **configurable**); rechaza triviales: todos iguales (`0000`, `1111`…), secuencias ascendentes/descendentes (`1234`, `4321`), repetidos en patrón (`1212`). Lista de triviales fácil de ampliar.
- Casos de uso (solo ADMIN, `actor.role`): `createUser`, `updateUser`, `setUserActive`, `resetPin` (**solo administrador en línea**; deja bitácora `USER_PIN_RESET`). Nunca se borra.
- Bitácora: agregar a `AuditAction`: `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_ACTIVATED`, `USER_PIN_RESET`.
**Base:** tabla `app_users` (id uuid, name, role check in ('ADMIN','STAFF'), is_active, pin_salt, pin_iterations, pin_hash, pin_version, created_at, change_seq para S1-09/15). RLS: administradores leen y escriben; **dispositivos activos solo leen** columnas necesarias para entrar (id, name, role, is_active, verificador) mediante vista `login_users`; cajero sin dispositivo: nada. Sin DELETE. Disparador de bitácora para cambios de rol/estado/PIN (no registra el hash en `audit_log`: solo "PIN restablecido").
**Pruebas:** el PIN no se guarda en claro (inspeccionar la fila); triviales rechazados; desactivar impide entrar y no borra; reset solo admin; 2 admins + 5 empleados sin límite; contrato de repositorio (memoria + Supabase); pgTAP de permisos.
**Cuidado:** administradores en la tablet usan **PIN** también (el rol `ADMIN` de `app_users`); su cuenta de Supabase Auth (correo/contraseña) es otra cosa y se enlaza con `authUserId` opcional.

### S1-18 · Matriz de permisos completa (8 h) — HECHA (PR #42)
**Fuente:** tabla "Matriz de permisos" de `docs/producto/REQUERIMIENTOS.md` (13 filas × 2 roles).
**Diseño:** `modules/identity/domain/permissions.ts`: `Permission` (una constante por fila: `QUOTE_CREATE`, `PRICE_OVERRIDE`, `CATALOG_EDIT`, `SALE_REGISTER`, `ORDER_ADVANCE`, `ORDER_DELIVER_WITH_BALANCE`, `CANCEL_SALE_OR_ORDER`, `OWN_CASH_CLOSE`, `OTHERS_CASH_VIEW`, `REPORTS_AND_RECEIVABLES`, `INVOICE_GENERATE`, `USERS_AND_DEVICES`, `PRIVACY_NOTICE_EDIT`); `PermissionPolicy.check(role, permission): 'ALLOW' | 'DENY' | 'NEEDS_ADMIN_AUTHORIZATION' | 'ALLOW_WITH_REASON'`. Es **dominio puro**; los casos de uso la consultan. La matriz es una tabla de datos; se sustituye por lectura de configuración si PD-17 cambia (hoy Luis y Ricardo: mismos permisos).
**Pruebas:** una prueba por fila y por rol (`it.each` sobre la matriz copiada de `REQUERIMIENTOS.md` + una prueba que falla si se agrega una fila sin probar). **Paridad con la base:** para cada tabla que exista con datos sensibles (`products`, `product_price_history`, `audit_log`, `devices`, `business_settings`, `app_users`, `customers`, `legal_documents`), una prueba de integración que consulta/escribe con cada rol y verifica que coincide con la política del dominio. Las filas de funciones aún inexistentes (cotizar, ventas, cortes, reportes, facturas) se prueban solo en el dominio y quedan listadas como "pendiente de paridad RLS" para los sprints 2 a 4.
**Bitácora:** revisar que cada acción sensible de este sprint deje entrada (usuarios, dispositivos, precios, aviso de privacidad, anonimización).

### S1-17 · Autorización de administrador por PIN (2 h) — HECHA (PR #43)
**Diseño:** caso de uso `authorizeWithAdminPin(deps, { pin, deviceId, action })` → busca administradores **activos** cuyo verificador coincida (se elige el administrador en pantalla y luego PIN, no se adivina entre todos) → `Authorization { adminId, at }`; PIN de cajero, de administrador inactivo o incorrecto: error `AUTH_FAILED` sin decir cuál. Cuenta intentos fallidos igual que la entrada (comparte contador). La acción restringida recibe la `Authorization` y la bitácora guarda `authorizedBy` (agregar campo opcional `authorizedBy` a `AuditEntry` y a la columna `audit_log.authorized_by uuid` con migración).
**Pruebas:** administrador activo correcto; incorrecto; cajero; administrador desactivado; deja `authorizedBy`.

### S1-10 · Clientes: ficha con validaciones (4 h)
**Diseño:** `modules/customers/domain/customer.ts`: `Customer { id, name, phone (10 dígitos normalizados), phoneNormalized, email?, notes?, fiscal?: { rfc, legalName, fiscalZip, regime, cfdiUse }, anonymizedAt?, privacyNoticeVersion? }`. `buildCustomer(draft)`: nombre y WhatsApp obligatorios; teléfono = **10 dígitos** tras quitar espacios, guiones, paréntesis y lada `+52`/`52` (reutilizar y **mover al núcleo** `normalizarTelefono` que hoy vive en `apps/web/src/shared/ui/formatos.ts`, dejando ahí un reexport); RFC vacío permitido, si no 12 o 13 caracteres alfanuméricos en mayúsculas; código postal fiscal 5 dígitos.
**Puertos:** `CustomerRepository { create, update, get, search(texto), findByPhone(phoneNormalized) }`. Batería de contrato: memoria + Supabase ahora; **IndexedDB en S1-09** (agregar entonces).
**Base:** `customers` (índice **no único** en `phone_normalized`), `customer_sites` (puede esperar al Sprint 2 si no hay UI de domicilios). RLS: administradores todo; dispositivos activos leen y crean/editan **solo columnas no fiscales** **[PROPUESTA transitoria]**: `MODELO_DE_DATOS` dice que los dispositivos escriben solo mediante la función de operaciones (llega en el Sprint 2); mientras tanto se permite la escritura directa del dispositivo sobre `customers` con columnas limitadas, y se retira al llegar la función de operaciones. **Registrarlo en un ADR corto.**
**UI:** sección Clientes (hoy vacía): lista, estado vacío que enseña qué hacer (RF-UX-07), formulario con `Campo`/`CampoNumerico` (teclado numérico en teléfono), errores con "qué hacer". RNF-06: la tablet **no** guarda datos fiscales de todos los clientes.
**Pruebas:** nombre/WhatsApp obligatorios; teléfono de 9 u 11 dígitos rechazado; RFC de 11 o 14 rechazado y vacío permitido; CP de 4 rechazado; contrato del repositorio.

### S1-11 · Clientes: búsqueda y aviso de duplicados (2 h)
`searchCustomers` reutiliza `normalizeSearchText` (nombre parcial sin acentos/mayúsculas) y teléfono normalizado. `findPossibleDuplicates(phone)`: compara `phoneNormalized`; el aviso **no bloquea**, ofrece abrir el existente. Pruebas con formatos `55 1234 5678`, `55-1234-5678`, `+52 55 1234 5678`, `(55) 1234 5678`.

### S1-12 · Clientes: anonimización (2 h)
Función SQL `anonymize_customer(p_id)` (`security definer`, solo `private.is_admin()`): sustituye nombre por `Cliente anonimizado`, borra teléfono, correo, notas, datos fiscales y domicilios, pone `anonymized_at`, **conserva** el id y toda referencia contable/fiscal (cotizaciones, órdenes, ventas, facturas ya guardadas por sus ids), y deja `audit_log` (`CUSTOMER_ANONYMIZED`). Caso de uso solo ADMIN. Una vez anonimizado no se puede revertir ni editar. Pruebas: cajero rechazado (dominio y base); datos personales vacíos; registros ligados intactos (por ahora una tabla de prueba o FK); bitácora y `anonymized_at`.

### S1-13 · Aviso de privacidad versionado y su registro (4 h)
**Base:** `legal_documents` (id, type `PRIVACY_NOTICE`|`TERMS`, version int, effective_from, body, edited_by, created_at): **solo se agrega** (editar = insertar versión nueva con su fecha de vigencia; sin UPDATE/DELETE). Se siembra un **borrador base** de HummingX (texto inventado y genérico, marcado "borrador, pendiente de validar con el asesor de ZAMMIR", PD-12). `privacy_acknowledgments` (customer_id, document_version, user_id, device_id, at).
**Reglas:** editar solo ADMIN. Al crear un cliente se registra la **versión vigente** informada (la tablet usa la última descargada). Pantalla de edición en Configuración o Legal (administrador) y texto visible al capturar cliente.
**Pruebas:** nueva versión al guardar; cliente nuevo guarda versión; cajero rechazado (dominio y base); las versiones viejas se conservan.

### S1-08 · Importación del catálogo desde archivo (8 h)
**Formato:** plantilla descargable CSV (UTF-8 **con BOM** para que Excel respete acentos) y lectura de Excel `.xlsx`. **[PROPUESTA de dependencia]** leer `.xlsx` con una biblioteca pequeña en `apps/web` (evaluar `read-excel-file` o `exceljs`; **no** usar `xlsx`/SheetJS de npm por avisos de seguridad) y registrarlo en un ADR de herramientas; el análisis vive en el núcleo y recibe filas ya leídas.
**Columnas (encabezados en español):** `codigo`, `nombre`, `categoria` (nombre exacto de una categoría existente), `tipo` (`a medida`/`pieza estándar`/`servicio`), `unidad` (`m²`, `metro lineal`, `pieza`, `servicio`), `precio` (en pesos, `1234.56` o `$1,234.56`, con IVA incluido), `exento` (`sí`/`no`), `regla` (opcional; por omisión la que corresponde a la unidad), `base_metro_lineal` (`largo`/`perímetro`, **obligatoria** para metro lineal, PD-25), `garantia_meses` (opcional).
**Núcleo:** nueva `parseMoney(texto)` en `money/` (pesos → centavos **sin flotantes**, 2 decimales máximo; **entra a la regla del 100 %**); `analyzeCatalogImport(filas, categorias, productosExistentes, reglas)` → `{ filas: [{ fila, producto | errores[] }], resumen }`. Errores por fila con número y columna: precio negativo/ilegible, categoría inexistente, código duplicado (en el archivo y contra el catálogo), columnas faltantes, tipo/unidad incompatibles, regla/parámetros inválidos (reutiliza `buildProduct`).
**Decisión sobre filas inválidas [PROPUESTA, registrar como ADR y mostrar en pantalla]:** **todo o nada**. Si hay una sola fila inválida **no se importa nada**; la vista previa lista cada error con su fila y la persona corrige el archivo y lo vuelve a subir. Razón: evita catálogos a medias y duplicados al re-subir, y con 50 a 150 filas corregir es rápido. Importar = confirmar la vista previa → `createProduct` por fila (idealmente en una sola transacción: función SQL `import_products(jsonb)` solo ADMIN que inserta todo o nada; si no, compensar).
**UI:** pantalla en Catálogo (solo administrador): botón "Descargar plantilla", cargar archivo, vista previa (tabla con estado y errores), confirmar. Textos con vocabulario del oficio.
**Pruebas:** archivo válido; cada tipo de error con su fila; acentos y `ñ` intactos (CSV con y sin BOM; `Latin-1` falla con aviso claro); precio con `$` y comas; propiedad: `parseMoney(formatMoney(x))` regresa `x`; nada se guarda hasta confirmar. Catálogo de prueba inventado en `fixtures` (PD-03).

### S1-19 · Pantalla de bitácora (2 h)
Puerto `AuditReader { list({ desde?, hasta?, action?, userId?, entityType?, limit, after }) }` + adaptador Supabase sobre `audit_log` (solo ADMIN lo lee; ya hay RLS). Pantalla en la sección de administrador: filtros (fecha, acción, usuario), columnas usuario, dispositivo, fecha **en hora de México** (`formatearFecha` + hora), acción en español (mapa `AuditAction → texto` en `textos.ts`), valores anterior y nuevo legibles, paginación. Cajero: sin acceso (ruta protegida + base). Pruebas de componente y de integración.

### S1-09 · Catálogo disponible sin conexión (4 h, requiere tablet para lo manual)

> **Nota de S1-10 a S1-13 para esta historia:** la batería `customerRepositoryContract` incluye pruebas de `anonymize` y de bitácora que **solo aplican a administrador/servidor**. El adaptador de IndexedDB de la tablet (lectura de `customers_for_device` y altas pendientes) debe pasar solo las pruebas de lectura/alta: separar la batería en dos (`customerRepositoryContract` base + `customerAdminContract`) antes de agregar el adaptador local. Lo mismo vale para `legal_documents` (la tablet solo lee la versión vigente) y `login_users`.
**Dependencia nueva:** `dexie` (IndexedDB) y `fake-indexeddb` (pruebas) → ADR corto de herramientas (ya previstas en ADR-0014).
**Réplica por cursor [ADR-0012, SINCRONIZACION §7]:** migración que agrega `change_seq bigint` (secuencia global + disparador `before insert or update`) a `products` y `product_categories`; vista para dispositivos `catalog_changes` (incluye `is_active`, para que la tablet oculte lo desactivado sin borrar) con `where change_seq > :cursor order by change_seq limit :n`. Puerto `CatalogReplica { pullSince(cursor, pageSize) }` y `CatalogLocalStore` (IndexedDB, tablas `products`, `categories`, `meta` con el cursor). Caso de uso `refreshCatalog`: pide páginas hasta alcanzar al servidor, hace `bulkPut` por `id` (**sin duplicar**), guarda el cursor al final de cada página (reanudable). Lectura local para vender: `ProductReader` sobre IndexedDB + `searchProducts` (ya hecho). Registrar `navigator.storage.persist()` y avisar si no se concede.
**Pruebas:** descarga inicial; cambio de precio en servidor → reconexión trae la versión nueva sin duplicar (misma `id`); producto desactivado deja de verse en venta; contrato `ProductReader` para IndexedDB (con `fake-indexeddb`); **e2e Playwright** con `context.setOffline(true)`: el catálogo se consulta y busca. *(Manual)* modo avión en la tablet real (Samsung Galaxy Tab A9+).

### S1-15 · Entrada con PIN en la tablet registrada (8 h, requiere tablet para lo manual)
**Diseño:** réplica de `login_users` (S1-14) a IndexedDB junto con el catálogo. Pantalla de usuarios (lista de nombres) → teclado numérico grande → verificación local con `PinHasher.verify` (tiempo constante). Solo si el dispositivo está **registrado y activo** (sesión de dispositivo vigente; si fue revocado, al conectarse se borran verificadores locales). Usuario desactivado → no entra.
**Intentos fallidos (PD-22):** **ya hecho en S1-17**: usar el puerto `PinAttemptGuard` (valores 5 / 30 s / tope 900 s en `business_settings`; desde el intento 5 cada fallo duplica el bloqueo). Aquí solo falta su **adaptador de IndexedDB** (el contador debe sobrevivir a cerrar la aplicación) con la misma batería de contrato que el de memoria (crear `pinAttemptGuardContract`).
**Iteraciones de PBKDF2:** medir en la tablet real y fijar el valor en configuración (`pin_pbkdf2_iterations`), con meta de ~250 ms por verificación; mientras no se mida, usar el valor recomendado actual de OWASP para PBKDF2-HMAC-SHA256 y dejarlo configurable.
**Pruebas:** PIN correcto entra; incorrecto no; dispositivo no registrado/revocado no; usuario desactivado no; bloqueo creciente con reloj fijo; lo guardado en la tablet no contiene el PIN. *(Manual)* entrar sin internet en la tablet.

### S1-16 · Cambio de usuario y bloqueo por inactividad (2 h, requiere tablet para lo manual)
Máquina de estados `ActiveUserSession` en el núcleo (con `Clock`): `LOCKED → ACTIVE(user)`; `touch()` en cada actividad; al pasar `idle_lock_minutes` (5 por omisión) vuelve a la pantalla de usuarios **sin cerrar la sesión del dispositivo**; cambiar de usuario conserva lo capturado como borrador del usuario anterior (borradores reales llegan con el cotizador; por ahora un contenedor `drafts` por usuario). Toda acción siguiente se atribuye al usuario activo (el puerto de bitácora recibe el `userId` de la sesión). Pruebas con reloj fijo y e2e. *(Manual)* esperar el bloqueo.

### S1-20 · Aceptación E4 y E8 (2 h)
Automatizar con Playwright/integración lo que se pueda de `PRUEBAS_DE_ACEPTACION.md`: **E4:** tres usuarios con PIN en la misma tablet realizan acciones, cada una queda atribuida y el bloqueo funciona. **E8:** un cajero y un administrador intentan las acciones de la matriz; el cajero queda limitado en el dominio y en la base.

### S1-21 · Cierre del Sprint 1 (2 h, requiere tablet)
Compuerta común en verde; dinero/IVA/precios con 100 % y mutación ≥ 90 %; tabla de casos de oro completa; matriz probada fila por fila; **lista de tablet firmada** (PIN, cambio de usuario, bloqueo, catálogo en modo avión); retrospectiva y recalibración de `docs/backlog/MEDICION.md` y `CAPACIDAD.md` con los datos reales del sprint.

## 7. Lista de verificación al terminar cada historia

- [ ] Criterios de aceptación de `SPRINT-1.md` cubiertos por pruebas (no solo a mano).
- [ ] Compuerta local completa en verde (sección 3).
- [ ] Textos nuevos en `textos.ts`; sin palabras prohibidas.
- [ ] Variables nuevas en `.env.example`; pruebas pgTAP con el `plan` contado.
- [ ] ADR escrito si hubo decisión nueva (índice en `DECISIONES.md`).
- [ ] Dudas de negocio nuevas agregadas a `CUESTIONARIO_LUIS.md`.
- [ ] Esta guía actualizada (tabla de la sección 6 y, si cambió algo, la sección 2).
- [ ] PR abierto contra la rama anterior de la pila, con la descripción en español.

## 8. Pendientes que tocan este sprint (resumen)

| ID | Qué | Cómo se resuelve mientras tanto |
|---|---|---|
| PD-02 | Área mínima, redondeo de medidas, mínimos | Apagados; construidos y probados encendidos |
| PD-03 | Catálogo real | Catálogo de prueba inventado |
| PD-12 | Texto final del aviso de privacidad | Borrador base de HummingX |
| PD-17 | Mismos permisos para Luis y Ricardo | Mismos permisos, configurable |
| PD-22 | Intentos y bloqueo de PIN | Propuesta: 5 intentos, 30 s duplicándose, tope 15 min |
| PD-25 | Metro lineal | La base es obligatoria por producto |
| PD-29 | Claves SAT | Valores de prueba por categoría |
| PD-49 | Categorías adicionales | Solo las 11 de RF-M1-02 |
