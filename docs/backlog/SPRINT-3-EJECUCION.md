# Sprint 3: guía de ejecución

> **Para qué sirve este documento.** Es el cuaderno de trabajo del Sprint 3 (órdenes de trabajo, mostrador, caja e impresión). Una sesión nueva debe poder leer **solo este archivo + la historia que le toque en [`SPRINT-3.md`](SPRINT-3.md)** y empezar a construir, sin recorrer el historial.
> **Estado:** escrito el 31 oct 2026, con el Sprint 2 terminado en código (faltan sus pruebas en tablet, que se hacen al final). Se actualiza al terminar cada historia (tabla de la sección 9).
> Lo marcado **[PROPUESTA]** lo propuso el desarrollador; se construye así mientras nadie diga otra cosa y cada una se registra en un ADR al implementarla. Ninguna inventa una regla de negocio: donde falta una respuesta de Luis se construye **configurable** y la duda va a `CUESTIONARIO_LUIS.md`.

## 1. Reglas que no se rompen (resumen de `CLAUDE.md`)

Igual que en [`SPRINT-2-EJECUCION.md`](SPRINT-2-EJECUCION.md) §1. En este sprint pesan más:

1. **Dinero en centavos enteros.** Aquí hay cobros, cambio, anticipos, saldos y cortes: ninguna cuenta con flotantes. Toda la aritmética vive en `shared-kernel/{money,tax}` y en funciones puras del dominio.
2. **Los pagos solo se agregan** [RN-18]: nunca se actualizan ni se borran (ni en el caso de uso ni en permisos de la base). El saldo siempre se **deriva** (total − pagos), nunca se captura.
3. **Sin crédito** [RN-09]: no hay límites, intereses ni estados de cuenta. Un saldo solo existe como remanente de una orden.
4. **Días y cortes en hora de México** [RN-17]; se guarda en UTC.
5. Textos con el vocabulario del glosario; **prohibido**: sincronizar, offline, login, checkout, carrito, POS. Se dice "Guardado en la tablet", "Enviado", "N pendientes". No se escribe "Punto de Venta": la sección se llama **Mostrador**.
6. **No se avanza con algo en rojo.** No se bajan umbrales ni se desactivan pruebas. Si no alcanza el tiempo se recortan historias (sección 8), nunca calidad.
7. Cada decisión técnica nueva → ADR en `docs/decisiones/` (el último existente es **0024**; sigue 0025) + fila en `DECISIONES.md`.
8. Las tablets aún no llegan y la impresora tampoco: lo marcado *(manual)* y `tablet` se construye contra interfaces, se prueba con adaptadores falsos y **no bloquea**; se prueba al final con la lista de tablet.

## 2. Qué ya existe (no rehacer)

Inventario del Sprint 1: [`SPRINT-1-EJECUCION.md`](SPRINT-1-EJECUCION.md) §2. Del Sprint 2: [`SPRINT-2-EJECUCION.md`](SPRINT-2-EJECUCION.md) §2 y §2.1. Lo que este sprint usa directamente:

| Pieza | Dónde | Para qué sirve en el Sprint 3 |
|---|---|---|
| Cola de salida y envío | `core/modules/sync/application/{ports,run-sync,sync-engine}.ts`, `SyncOutbox.transaction(tx)` (documento + folio provisional + operación en un solo paso), Dexie `dexie-operaciones.ts` | Toda orden, pago, venta y turno se guarda así y sale como **operación** |
| Receptor | SQL `public.receive_operation(p jsonb)` (la última versión está en `20261031000000_upsert_customer.sql`), función de borde `recibir-operacion`, `inMemoryOperationReceiver`, contrato `operationReceiverContract` | Cada tipo nuevo = un `case` en SQL **y** en el receptor en memoria **y** su esquema Zod en `sync/domain/operation.ts` + casos en el contrato |
| Folios | `shared-kernel/folio` (`FolioDocType` ya incluye `WORK_ORDER`→`OT` y `COUNTER_SALE`→`V`), `private.next_folio`, `formatTempFolio` (serie del dispositivo, un solo contador para todos los documentos) | `OT-AAAA-0001` y `V-AAAA-0001`; el folio se asigna como último paso de la transacción |
| Reconciliación | `quotes/application/reconcile-quotes.ts` (`reconcileQuotes`) y el gancho `afterPass` del motor | Se generaliza para órdenes y ventas (el folio definitivo vuelve al documento local) |
| Cotizaciones | `core/modules/quotes/*` (`Quote`, estados, `quoteTotals`, líneas congeladas), `QuoteLine` | `ConvertQuoteToWorkOrder` copia estas líneas sin recalcular |
| Clientes | `customers/*`, `outboxCustomers`, `UpsertCustomer`, `customers_for_device` | Ficha e historial (S3-25) |
| Dinero, IVA, precios | `shared-kernel/{money,tax}` (`computeDeposit`, `splitTax`), `catalog/domain/pricing/*` | Anticipo = `computeDeposit(total, deposit_percent_bps)` (hacia arriba, ADR-0011); ventas de mostrador usan las mismas reglas de precio |
| Permisos | `PERMISSION_MATRIX`: `SALE_REGISTER`, `ORDER_ADVANCE`, `ORDER_DELIVER_WITH_BALANCE` (admin con motivo), `CANCEL_SALE_OR_ORDER`, `OWN_CASH_CLOSE`, `OTHERS_CASH_VIEW`, `REPORTS_AND_RECEIVABLES` | Ya están definidos; no inventar permisos nuevos sin ADR |
| Autorización con PIN | `authorizeWithAdminPin`, `DialogoDeDescuento` (UI) | Entregar con saldo y otras acciones que pidan autorización de administrador |
| PDF y WhatsApp | `documents/*` (`DocumentRenderer`, `pdfLibRenderer`, `ShareService`, `buildWhatsAppMessage`) | Base del comprobante de trabajo (S3-09) |
| Bitácora | `recordAuditEntry`, `AuditAction` (agregar acciones nuevas a la unión **y** a `textos.ts`) | Cambios de estado, cancelaciones, entregas con saldo, reapertura de corte [RN-19] |
| Configuración | `deposit_percent_bps`=5000, `tax_rate_bps`, `warranty_months_default`=null, `self_invoicing_legend`=null, `self_invoicing_deadline_rule`, `business_*`, `LoginSnapshot` (lo que baja la tablet) | Nuevos ajustes se agregan en la migración **y** en `LoginSnapshot` |
| Prueba con servidor real | `pnpm test:integracion` (necesita el shim de `pnpm` en el PATH en esta máquina), `servidor-de-pruebas.ts` (`harness`, `nuevoDispositivo`, `newYear`, `customerName`…), `pnpm test:concurrencia` | Cada operación nueva se prueba contra el servidor real |

**Huecos que este sprint hereda:**
- _(actualización)_ la réplica de **órdenes y pagos** ya existe (S3-00); la de cotizaciones de otras tablets sigue como PP-20.
- **PP-20 (bajar documentos del servidor por número de cambio)** deja de ser opcional: un saldo de una orden se cobra en **otra** tablet (RF-M4-05), y el tablero y el historial necesitan ver lo que hizo otra tablet. Se vuelve la historia **S3-00** (sección 6).
- **PP-13:** la base ve la tablet, no la persona con PIN. El sobre de la operación ya lleva `userId`/`authorizedBy`; los pagos y turnos guardan el usuario del sobre.
- **PP-21:** el aviso de privacidad vigente aún no baja a la tablet.
- Sin medir en tablet: PBKDF2, PDF < 3 s, impresión < 5 s, Bluetooth.

### 2.1 Lo construido en este sprint (se actualiza al terminar cada historia)

| Pieza | Dónde | Notas para quien siga |
|---|---|---|
| Migraciones | `20261031100000_orders_payments.sql` (órdenes, líneas, eventos, garantías, pagos, vistas `*_for_device`, `receive_operation` con 6 casos nuevos, `require_deposit_to_start`, `public_base_url`) y `20261031110000_order_photos.sql` (bucket `order-photos`) | pgTAP `14_orders_payments.test.sql`; los pagos y los eventos de estatus tienen disparador que impide `UPDATE`/`DELETE` |
| Operaciones | `core/modules/sync/domain/operation.ts`: `createWorkOrderPayloadSchema`, `updateWorkOrderPayloadSchema`, `advanceWorkOrderPayloadSchema`, `deliverWorkOrderPayloadSchema`, `cancelWorkOrderPayloadSchema`, `registerPaymentPayloadSchema`; `parseOperation` valida **todos** los tipos (la función de borde también) | Para un tipo nuevo: esquema Zod + `ESQUEMAS_DE_CARGA` + caso SQL + caso en `sync/application/order-operations.ts` (receptor en memoria) + pruebas en el contrato |
| Receptor en memoria | `core/modules/sync/application/order-operations.ts` (+ `operation-receiver.ts`) | El contrato `operationReceiverContract` incluye "órdenes de trabajo y pagos" y corre contra memoria y servidor real; `newUser(activa, administrador?)` y `orderState(id)` en el arnés |
| Dominio de órdenes | `core/modules/orders/domain/work-order.ts` (`WorkOrder`, `WORK_ORDER_TRANSITIONS`, `checkWorkOrderTransition`, `nextWorkOrderStatus`, `Warranty`) | En el conjunto de mutación crítica |
| Dominio de pagos | `core/modules/payments/domain/payment.ts` (`Payment`, `planPayment`, `balanceCents`, `paymentKindForOrder`) | En el conjunto de mutación crítica. `planPayment` rechaza pago mayor al saldo, decide el cambio y exige pagar completa una venta |
| Casos de uso | `core/modules/orders/application/work-order-use-cases.ts`: `convertQuoteToWorkOrder`, `createManualWorkOrder`, `updateWorkOrder`, `advanceWorkOrder`, `deliverWorkOrder`, `cancelWorkOrder`, `registerWorkOrderPayment`, `workOrderBalance`; `OrderDeps` | `registerWorkOrderPayment` es el cobro que reutilizará el Mostrador (S3-14); sirve de modelo para `RegisterPayment` de ventas |
| Almacenes | `orders/application/work-order-store.ts` (`outboxWorkOrderStore`, `outboxPaymentStore`, `outboxWarrantyReader`), colecciones `work_orders`, `payments`, `warranties` | Mismos que cotizaciones: el documento y su operación se guardan en una sola transacción local |
| Reconciliación y réplica | `reconcile-orders.ts` (`afterPass` del motor) y `replica-documents.ts` (`refreshDocuments`, `DocumentReplicaSource`); web: `orders/infra/supabase-document-replica.ts` y `composition.envio.actualizarDocumentos` (se llama en `ponerAlDia`) | Una orden con operación pendiente no se sobrescribe; un pago ya guardado no se toca |
| Comprobante | `core/modules/documents/domain/work-order-document.ts` (`buildWorkOrderDocument`, `autoinvoiceUrl`); `QuoteDocument.receipt`; render en `pdf-lib-renderer.ts` (pagos, saldo, garantía, QR vectorial); `documents/infra/qr-matrix.ts`; `orders/ui/comprobante.ts` (`compartirComprobante`) | Nombre de archivo `Comprobante-<folio>.pdf`; prueba `acceptance/s3-comprobante.test.ts` lee el PDF con pdf.js y el QR con jsqr |
| Fotos | `orders/application/order-photos.ts` (`attachOrderPhoto`, `uploadPendingPhotos`, `fitWithin`, límites); web: `dexie-photo-store.ts`, `canvas-image-compressor.ts`, `supabase-photo-uploader.ts`; `composition.envio.subirFotos` | No usa la cola de operaciones; la compresión con lienzo no se puede probar en jsdom |
| Mostrador | migración `20261031120000_counter_sales.sql` (ventas, líneas, vista `counter_sales_for_device`, `CreateCounterSale`/`CancelCounterSale`); núcleo `core/modules/counter/` (`domain/ticket.ts` ticket puro, `domain/counter-sale.ts`, `application/counter-use-cases.ts`: `chargeCounterSale`, `cancelCounterSale`, `counter-sale-store.ts`, `reconcile-sales.ts`); pantalla `apps/web/src/modules/counter/ui/Mostrador.tsx`; `composition.prepararMostrador` | ADR-0026. Tras tocar `packages/core` hay que correr `pnpm funciones:empaquetar` antes de `pnpm test:integracion`: la función de borde usa el núcleo empaquetado |
| Pantallas | `apps/web/src/modules/orders/ui/`: `Ordenes.tsx` (lista, filtro por estatus, cotizaciones por convertir), `DetalleDeOrden.tsx` (totales, pagos, datos, fotos, acciones), `DialogoDeCobro.tsx`, `DialogoDeAutorizacion.tsx`, `OrdenesEnLaTablet.tsx`; `composition.prepararOrdenes`; `LoginSnapshot.orders` | Textos en `textos.ordenes` y `textos.documento.comprobante` |

## 3. Cómo trabajar (resumen)

Igual que Sprint 2 §3: carpeta `C:\z\s16`; `corepack pnpm …` (en Bash, para `pnpm test:integracion` añadir al PATH la carpeta del shim de pnpm); Node 24; Docker Desktop encendido para Supabase local; **Write** para archivos largos; una rama por historia o grupo (`feat/s3-XX-tema`); commits en español `feat(modulo): … (S3-XX)` terminados con la línea de coautoría; PR con base `main` (o la rama anterior de la pila) y **no se fusiona sin que Juanito lo autorice**.

Compuerta local antes de abrir un PR: `prettier --write .` → `lint` → `typecheck` → `check:deps` → `test` → (si se tocó la base) `db:reset` + `test:db` → `test:integracion` → (si se tocó el motor) `test:concurrencia` → (si se tocó dominio crítico) `test:mutacion:critico`. **Ojo:** `test:db` espera una base limpia: hacer `db:reset` antes si antes corrió `test:integracion`.

## 4. Decisiones de diseño **[PROPUESTA]** del sprint

Todas se registran en ADR al implementarse (ADR-0025 en adelante).

**D1 · Un tipo de operación por acción, con el documento completo.** Se agregan a `OPERATION_TYPES`: `CreateWorkOrder` (instantánea completa, como `IssueQuote`), `UpdateWorkOrder` (parche por campo: responsables, fecha estimada, notas), `AdvanceWorkOrder` (a un estatus; con `reason`/`authorizedBy` si hace falta), `DeliverWorkOrder` (con `reason` y `authorizedBy` si hay saldo), `CancelWorkOrder` (motivo), `RegisterPayment` (un pago o varias filas del mismo cobro), `CreateCounterSale`, `CancelCounterSale`, `OpenCashShift`, `CloseCashShift`, `ReopenCashShift`. El folio definitivo (`OT`, `V`) se asigna en `CreateWorkOrder` / `CreateCounterSale`, como último paso.

**D2 · Pagos como eventos que solo se agregan.** Tabla `payments` sin `UPDATE` ni `DELETE` para nadie (ni service role en la aplicación; la prueba pgTAP lo comprueba). Cada fila: destino (`work_order` | `counter_sale`), tipo (`DEPOSIT` | `BALANCE` | `SALE`), método (`CASH` | `TRANSFER`), `amount_cents` **aplicado**, `cash_received_cents` y `change_cents` solo en efectivo, `reference` opcional en transferencia (PD-43), cobró (`user_id`), dispositivo, hora, `cash_shift_id`. Pago mixto = varias filas con el mismo `payment_group_id`. **Saldo = total − Σ aplicado** (vista y función pura del dominio; nunca columna). Un pago mayor al saldo se **rechaza**; en efectivo el excedente es **cambio** (recibido − aplicado).

**D3 · `RegisterPayment` es un solo caso de uso** para anticipos, saldos y ventas (S3-05, S3-12, S3-14). Valida: monto > 0, métodos válidos, suma de filas = monto aplicado, saldo suficiente, **turno abierto** de quien cobra (D5). Devuelve el pago y el cambio.

**D4 · Máquina de estados de la orden.** `WAITING → IN_PROCESS → READY → DELIVERED`, y `CANCELLED` desde cualquier estado no final. `QUOTE_TRANSITIONS` ya existe como patrón: `WORK_ORDER_TRANSITIONS` + `checkTransition`. Cada cambio guarda usuario, dispositivo y hora en `work_order_status_events` (solo se agrega). Una transición inválida que llega de otra tablet se aplica como `TO_REVIEW` (igual que en cotizaciones). **PD-39:** pasar a `IN_PROCESS` sin anticipo registrado exige autorización de administrador con motivo; el ajuste `require_deposit_to_start` (**[PROPUESTA]**, valor inicial `true`) lo hace configurable.

**D5 · Turno de caja (PD-36 sin respuesta).** Se construye con **turno como unidad** (PENDIENTES ya lo indica): un turno por **cajero** (`cash_shifts`: cajero, dispositivo, apertura con fondo opcional, cierre con esperado/contado/diferencia, estado). Cada pago y venta se liga al **turno abierto del cajero que cobra** (RN-11). Para cobrar hace falta turno abierto; si no hay, la pantalla ofrece "Abrir turno" (un toque, fondo opcional). `SINCRONIZACION.md` §6.1 dice "solo hay una caja abierta a la vez": **se interpreta como un turno abierto por persona** (no se bloquea a un segundo cajero) y la duda va al cuestionario (Q 20.x). El efectivo cobrado en campo (tablet a domicilio) entra al turno de quien lo cobró; cuándo se entrega ese efectivo es parte de PD-36.

**D6 · `CashShiftSummary` es una función pura** de `(turno, pagos)` → cobros por método, efectivo esperado = fondo + cobros en efectivo (PD-37: sin retiros), contado, diferencia = contado − esperado. Cero dependencias; cobertura 100 % y mutación ≥ 90 % (se agrega al conjunto crítico de Stryker). El corte consolidado (nivel 2) es otra función pura que suma resúmenes. El servidor **recalcula** al recibir `CloseCashShift`; si difiere → `TO_REVIEW`.

**D7 · Ventas canceladas y el corte (PD-24 sin respuesta).** La cancelación se registra con motivo y bitácora; la venta cancelada **se excluye del cobro del corte** y queda listada aparte ("canceladas") para que el administrador decida qué pasa con el efectivo. No hay regla automática de devolución.

**D8 · Réplica de documentos (S3-00).** Igual que el catálogo y los clientes: `change_seq` + vistas `*_for_device` (sin datos fiscales) de **cotizaciones**, **órdenes** (con líneas) y **pagos** (para calcular saldos); la tablet los fusiona **sin pisar** lo que tenga pendiente por enviar. Una orden creada en una tablet aparece en las demás para cobrarle el saldo.

**D9 · Ticket en dos pasos.** `TicketTemplate` (venta, cobro de orden, corte) produce un `TicketDocument` neutro (líneas de texto con alineación y columnas, QR, logo, corte) **sin saber de impresoras**; cada adaptador (`fake`, Bluetooth ESC/POS, impresión de Android, compartir como PDF/imagen) lo convierte. Ancho de 80 mm = 48 columnas; las plantillas se prueban contra versiones aprobadas guardadas en el repositorio. Contrato `ticketPrinterContract` para todos los adaptadores.

**D10 · Código de autofacturación = `public_code` del documento** (8 caracteres aleatorios, ya único e imposible de deducir del folio). El QR lleva `https://<dominio de prueba>/f/<folio>/<código>` con el dominio en configuración (PD-10: dominio de prueba mientras no haya el definitivo); el plazo (RN-26) y la leyenda son configurables (PD-09).

**D11 · Garantía (PD-06 sin respuesta).** Se crea al entregar (`warranties`: orden, inicio, `duration_months` **nullable**, cobertura, exclusiones, textos tomados del producto o de la configuración). Sin valor definido queda vacío y editable; **nunca** un valor supuesto (la demo usó 6 meses de relleno: no repetir).

**D12 · Entregas por orden, no por línea** (PD-46 sin respuesta). Estatus por orden.

## 5. Orden de construcción

```
Fase A  Cimientos del servidor    S3-00 (réplica) · tablas y tipos de operación (D1, D2) · pgTAP
Fase B  Dominio puro              WorkOrder + estados (S3-04) · pagos y saldo (S3-05) · CashShiftSummary (S3-17/18)
Fase C  Órdenes                   S3-01 → S3-02 → S3-04 → S3-05 → S3-06 → S3-07 → S3-08 → S3-10   (S3-03 fotos al final)
Fase D  Mostrador                 S3-16 (turno) → S3-11 → S3-12 → S3-13 → S3-14 → S3-15 → S3-17 → S3-18 → S3-19
Fase E  Documentos e impresión    S3-09 (comprobante) · S3-20 (puerto y plantillas) · S3-24 (ticket) · S3-21/22/23 (adaptadores, manual)
Fase F  Clientes y aceptación     S3-25 → S3-26 (E1) → S3-27 (E2) → S3-28 (E3 y E4) → S3-29 → S3-30
```

Razón: sin tablas, operaciones y réplica no hay nada que probar de extremo a extremo; el dominio puro (estados, pagos, corte) se prueba antes que cualquier pantalla; el turno de caja va antes que cualquier cobro porque todo cobro se liga a un turno.

**PRs sugeridos** (cada uno cierra su compuerta): (1) S3-00 + tablas/tipos (servidor) · (2) dominio de órdenes y pagos · (3) S3-01 a S3-08 (órdenes: núcleo + pantallas) · (4) turno y mostrador S3-11 a S3-19 · (5) S3-09 + plantillas S3-20/S3-24 · (6) S3-10 + S3-25 · (7) aceptación y cierre.

## 6. Historias, una por una

Los criterios de aceptación están en [`SPRINT-3.md`](SPRINT-3.md). Aquí va lo que ese documento no dice: dónde y cómo.

### S3-00 · Réplica de cotizaciones, órdenes y pagos (nueva, L, 8 h) — *absorbe PP-20 y S2-07*
**Dónde:** migración con `change_seq` en `quotes`, `work_orders`, `payments` (+ vistas `quotes_for_device`, `work_orders_for_device`, `payments_for_device` sin datos fiscales); núcleo `…/application/replica-documents.ts` (patrón de `refreshCustomers`); web `supabase-*-replica.ts` y `actualizarDocumentos` en la composición (se llama junto a `actualizarClientes` en `ponerAlDia`).
**Diseño:** cursor por tabla guardado como documento `meta`. El documento del servidor **no pisa** uno con operaciones pendientes. Ventana de retención: ajuste `local_retention_days` (hoy `null`; mientras no se defina, 90 días **[PROPUESTA]** y aviso).
**Pruebas:** paginación sin duplicados; pendiente local sobrevive; reanudación tras corte; ninguna columna fiscal en las vistas (aserción sobre `information_schema`).

### S3-01 · Crear la orden desde una cotización aceptada (L, 8 h)
**Dónde:** `core/modules/orders/domain/{work-order.ts,work-order-line.ts}`, `application/{work-order-store.ts,convert-quote.ts,create-manual-order.ts}`; SQL `apply_create_work_order`; operación `CreateWorkOrder`.
**Diseño:** `ConvertQuoteToWorkOrder` exige cotización `ACCEPTED` y no convertida antes (`quote.convertedWorkOrderId` — agregar al `Quote`, hoy no existe); copia cliente, líneas y totales **congelados** (nada se recalcula); `deposit_required_cents = computeDeposit(total, deposit_percent_bps)`; folio provisional por `tx.nextTempNumber()`; la cotización queda ligada en la misma transacción local. Orden manual: líneas desde catálogo con `buildQuoteLine`, sin cotización.
**Pruebas:** convertir copia líneas y precios; no aceptada → error; segunda conversión → error; anticipo hacia arriba (tabla de oro); manual sin cotización; la operación sale y recibe `OT-AAAA-NNNN`.

### S3-02 · Responsables, fecha estimada y notas (M, 4 h)
`UpdateWorkOrder` con parche por campo; servidor: último que llega gana **por campo**, valor anterior a bitácora (`WORK_ORDER_UPDATED`). Pruebas: dos tablets editan campos distintos → ambos; mismo campo → último, con bitácora.

### S3-03 · Fotos de la medición (M, 4 h) — *candidata a recortar*
Compresión en la tablet (canvas, lado máx. y calidad definidos en la historia), límite de tamaño, almacenamiento Storage de Supabase con subida aparte de la operación (`SINCRONIZACION.md` §9). **Se hace al final** y se recorta primero si el sprint no cabe.

### S3-04 · Estatus y botón "Avanzar" (M, 4 h)
Ver D4. `AdvanceWorkOrder`. Pruebas: cada transición válida e inválida con error tipado; con `require_deposit_to_start` sin anticipo → pide autorización; transición inválida desde otra tablet → `TO_REVIEW`.

### S3-05 · Anticipos y pagos (L, 8 h)
Ver D2 y D3. `core/modules/payments/{domain/payment.ts,application/register-payment.ts,balance.ts}`. Propiedades: saldo = total − Σ pagos con muchos pagos; mixto suma exacta; pago > saldo rechazado; efectivo: cambio = recibido − aplicado; nada se actualiza ni se borra (pgTAP: `UPDATE`/`DELETE` fallan para `authenticated` y para la función).

### S3-06 · Entrega con saldo (S, 2 h) · S3-07 · Garantía (M, 4 h) · S3-08 · Cancelación (S, 2 h)
`DeliverWorkOrder` / `CancelWorkOrder`. Entrega con saldo: cajero rechazado; administrador (o PIN) con motivo → bitácora y la orden aparece en cuentas por cobrar (la pantalla es del Sprint 4; aquí solo el dato). Cancelar: solo administrador con motivo, guarda etapa y monto de anticipo recibido, **sin devolución automática** (PD-07). Garantía: ver D11.

### S3-09 · Comprobante de trabajo en PDF con QR (L, 8 h)
**Dónde:** `documents/domain/work-order-document.ts` (modelo ya calculado, como `QuoteDocument`) y renderizador con `pdf-lib` + QR como imagen (librería pequeña sin dependencias de red, p. ej. `qrcode`, **ADR** al elegirla). Se genera al cobrar el anticipo y al entregar (saldo en cero). Pruebas con `pdfjs-dist` (solo pruebas): texto idéntico al modelo; el QR decodificado = enlace + código esperados.

### S3-10 · Tablero y lista de órdenes (M, 4 h)
Pantalla de administrador: conteos por estatus, filtros combinados (intersección), resumen de valor en producción y saldo por cobrar de lo listo. Funciones puras de filtrado y resumen (probar con propiedades). Lee lo local (S3-00).

### S3-11 a S3-15 · Mostrador
`modules/counter/`: ticket actual (`CounterTicket`, funciones puras con `TaxCalculator`), cobro (`RegisterPayment` con tipo `SALE`), `CreateCounterSale` (folio `V-…`), cobrar saldos de orden desde Mostrador (mismo `RegisterPayment`, cuenta en el turno de quien cobra), `CancelCounterSale` (solo administrador, D7). UI: sección **Mostrador** (hoy vacía en `secciones.ts`).

### S3-16 · Turno de caja (M, 4 h) · S3-17 · Corte por cajero (L, 8 h) · S3-18 · Consolidado (M, 4 h) · S3-19 · Cierre con pendientes (S, 2 h)
Ver D5 y D6. `core/modules/cash/{domain/cash-shift.ts,cash-summary.ts,application/…}`. Corte cerrado no se edita; reabrir: solo administrador, motivo, bitácora (`CASH_SHIFT_REOPENED`). Consolidado del día en hora de México (turno que cruza medianoche → día de su **apertura** **[PROPUESTA]**). S3-19: `outbox.pendingCount()` al cerrar → aviso con el número; el servidor recalcula y marca `TO_REVIEW` si difiere.

### S3-20 a S3-24 · Impresión
S3-20 (puerto, plantillas, falso, contrato) y S3-24 (plantilla de ticket con QR y leyenda) se hacen sin hardware. S3-21 (Web Bluetooth + ESC/POS), S3-22 (impresión de Android y compartir) y S3-23 (estado, prueba, reimpresión) se construyen contra el contrato con el codificador ESC/POS probado byte a byte; **la prueba real con impresora queda en la lista de tablet**. PD-15 (modelo de impresora) sigue abierto: parámetros Bluetooth configurables.

### S3-25 · Historial del cliente y recurrente (M, 4 h)
Ficha en Clientes (tablet y administrador): cotizaciones, órdenes, ventas, pagos y garantías **de ese cliente y de nadie más**; recurrente = vista con ≥ 2 órdenes **entregadas** (no cuentan canceladas ni cotizaciones).

### S3-26 a S3-30 · Aceptación y cierre
E1 (cotizar → aceptar → orden → anticipo → avanzar → entregar con saldo liquidado → comprobante con saldo cero), E2 (ventas + corte), E3 de ventas (10 ventas sin conexión) y E4 (tres personas cobrando): **pruebas de integración con servidor real** como en Sprint 2 (`e3-cotizaciones-sin-conexion.integracion.test.ts` es el modelo) y Playwright para orientación; el recorrido físico va a la lista de tablet. Cierre: compuerta, mutación (agregar `cash/domain` y `payments/domain` al conjunto crítico), concurrencia 10 veces, retrospectiva.

## 7. Dudas de negocio para el cuestionario único a Luis

(Se agregan a `CUESTIONARIO_LUIS.md` al construir cada historia; aquí la lista viva.)

- **PD-36** turno de caja y relevos (bloquea la forma final del corte; hay modelo por turno por cajero).
- **PD-37** salidas de efectivo; **PD-24** efecto de cancelar una venta en la caja; **PD-44** tolerancia de diferencia.
- **PD-38** medición final distinta; **PD-39** fabricar sin anticipo; **PD-41** tiempos de entrega; **PD-43** transferencias; **PD-46** entregas parciales; **PD-07** anticipo al cancelar; **PD-06** garantía; **PD-09** plazo de autofacturación; **PD-10** dominio.
- Nueva: "una caja abierta a la vez" (`SINCRONIZACION.md` §6.1): ¿una por persona o una sola para todos?
- Nueva: si un turno cruza la medianoche, ¿a qué día pertenece?

## 8. Riesgos y recortes

| Riesgo | Mitigación |
|---|---|
| Es el sprint con más módulos | Orden de la sección 5; el dominio puro primero; PRs pequeños |
| PD-36 sin respuesta | Turno por cajero (D5) configurable; el corte se calcula sobre turno |
| Impresora y tablet no han llegado | Puerto + plantillas + codificador probados con adaptador falso; lo real al final |
| Pagos: un error aquí cuesta dinero | Propiedades con `fast-check`, tabla de oro, mutación ≥ 90 % en `payments` y `cash` |
| Réplica de documentos (S3-00) añade trabajo | Reutiliza el patrón de clientes y catálogo; es lo que desbloquea cobrar saldos entre tablets |

**Si el tiempo aprieta se recorta, en este orden:** P2 existencias (ya fuera) → S3-03 fotos → S3-25 historial → S3-18 consolidado (queda el corte por cajero) → S3-22 adaptadores de respaldo. **Nunca** se recortan: pagos, saldo, corte por cajero, turnos, folios, impresión de ticket con el adaptador principal.

## 9. Estado de las historias

| Historia | Talla | Estado | Rama / PR |
|---|---|---|---|
| S3-00 Réplica de documentos | L | **hecha** para órdenes y pagos (cotizaciones de otras tablets siguen en PP-20) | `feat/s3-ordenes` |
| S3-01 Orden desde cotización | L | **hecha** (cotización aceptada → orden en un toque; orden manual solo en el núcleo, sin pantalla: PP-23) | `feat/s3-ordenes` |
| S3-02 Datos de la orden | M | **hecha** (responsables, fecha estimada, notas; último por campo) | `feat/s3-ordenes` |
| S3-03 Fotos de la medición | M | **hecha** salvo probar la cámara y la compresión en la tablet | `feat/s3-ordenes` |
| S3-04 Estatus y "Avanzar" | M | **hecha** (con PD-39 configurable) | `feat/s3-ordenes` |
| S3-05 Anticipos y pagos | L | **hecha** (el turno de caja se liga en S3-16) | `feat/s3-ordenes` |
| S3-06 Entrega con saldo | S | **hecha** | `feat/s3-ordenes` |
| S3-07 Garantía | M | **hecha** (duración vacía mientras PD-06 no se defina) | `feat/s3-ordenes` |
| S3-08 Cancelación de la orden | S | **hecha** | `feat/s3-ordenes` |
| S3-09 Comprobante PDF con QR | L | **hecha** (PDF verificado con otro lector y QR decodificado; falta verla y escanearla desde la tablet) | `feat/s3-ordenes` |
| S3-10 Tablero y lista | M | **hecha** (conteo por estatus, filtros combinados por estatus, cliente, responsable y fechas; resumen para administradores) | `feat/s3-mostrador` |
| S3-11 Venta rápida y ticket actual | M | **hecha** (ticket puro con mutación 100 %; falta el catálogo rápido PP-08, no aprobado) | `feat/s3-mostrador` |
| S3-12 Cobro (efectivo, transferencia, mixto) | M | **hecha** | `feat/s3-mostrador` |
| S3-13 Atribución y folio de la venta | S | **hecha** (usuario, dispositivo, hora UTC; folio provisional y `V-AAAA-NNNN`) | `feat/s3-mostrador` |
| S3-14 Cobrar saldos desde Mostrador | S | **hecha** (mismo `registerWorkOrderPayment`) | `feat/s3-mostrador` |
| S3-15 Cancelar una venta | S | **hecha** (PD-24: solo se registra) | `feat/s3-mostrador` |
| S3-16 Turno de caja | M | pendiente | |
| S3-17 Corte por cajero | L | pendiente | |
| S3-18 Corte consolidado | M | pendiente | |
| S3-19 Cierre con pendientes | S | pendiente | |
| S3-20 Puerto, plantillas y adaptador falso | L | pendiente | |
| S3-21 Web Bluetooth y ESC/POS | L | código sí; prueba real al final | |
| S3-22 Adaptadores de respaldo | M | código sí; prueba real al final | |
| S3-23 Estado, prueba y reimpresión | M | código sí; prueba real al final | |
| S3-24 Ticket con QR y leyenda | M | pendiente | |
| S3-25 Historial del cliente | M | pendiente | |
| S3-26 Aceptación E1 | L | pendiente | |
| S3-27 Aceptación E2 | M | pendiente | |
| S3-28 Aceptación E3 (ventas) y E4 | M | pendiente | |
| S3-29 Aceptación E10 | S | manual (tablet) | |
| S3-30 Cierre del Sprint 3 | S | pendiente | |

## 10. Lista de verificación al terminar cada historia

1. Los criterios de aceptación de `SPRINT-3.md` están cubiertos por pruebas con nombre en español.
2. Compuerta local completa (sección 3) en verde.
3. Textos nuevos en `textos.ts`, sin palabras prohibidas; variables nuevas en `.env.example`.
4. Tabla o permiso nuevo: pgTAP, `MODELO_DE_DATOS.md` actualizado, columnas fiscales ausentes de las vistas de la tablet.
5. ADR + fila en `DECISIONES.md` por cada decisión nueva.
6. Dudas de negocio nuevas → `CUESTIONARIO_LUIS.md`; ideas nuevas → `PENDIENTES.md` (Propuestas).
7. Esta tabla (sección 9) actualizada, con rama y PR.
