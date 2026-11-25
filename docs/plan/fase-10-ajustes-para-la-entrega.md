# Fase 10 — Ajustes de operación para la entrega

- **Tipo:** código
- **Fechas:** a partir del 25 de noviembre de 2026, antes de la entrega
- **Decisión:** [ADR-0044] (decisiones de Juanito del 24 de noviembre de 2026)
- **Lee antes:** [00 §1, §4, §5 y §6](00-principios-de-ingenieria.md), `docs/arquitectura/SINCRONIZACION.md`, `docs/arquitectura/MODELO_DE_DATOS.md`

## Objetivo

Cerrar los huecos de operación que salieron al revisar el sistema con Juanito antes de la entrega:

- que la caja cuadre siempre, incluso al cancelar ventas;
- que las transferencias se puedan confirmar;
- que las órdenes avisen cuando van tarde;
- que la cobranza cuente bien los días;
- que un trabajo se pueda entregar por partes;
- que Luis pueda hacer crecer su catálogo sin ayuda técnica.

## Entra si

- `main` en verde y desplegado (PR #113).
- [ADR-0044] aceptado y este plan revisado por Juanito.
- Para AJ-09 (cargos extra) **no** hace falta esperar a Luis: se construye el mecanismo; los precios de cantos, perforaciones y biselados (PD-02) se capturan en el catálogo cuando lleguen.

## Alcance

Nueve historias, en el orden en que se construyen. Cada una va en su rama y su PR, con pruebas primero.

| # | Historia | Requerimiento | Pendiente que cierra | Esfuerzo |
|---|---|---|---|---|
| AJ-01 | Listas sin tope de 1000 filas | RF-M1-01, RNF-24 | — | 2 h |
| AJ-02 | El corte pide explicación si hay diferencia | RF-M4-09 (nuevo) | PD-44 | 4 h |
| AJ-03 | Fecha de entrega obligatoria y órdenes atrasadas | RF-M3-09 (nuevo) | PD-41 | 5 h |
| AJ-04 | Cuentas atrasadas desde la entrega, con 1 día por omisión | RF-M6-01 | PD-33 | 4 h |
| AJ-05 | Confirmar que llegó una transferencia | RF-M4-11 (nuevo) | PD-43 | 6 h |
| AJ-06 | Devolución al cancelar una venta de mostrador | RF-M4-10 (nuevo), RF-M4-07 | PD-24 | 7 h |
| AJ-07 | Entregas por partes | RF-M3-10 (nuevo) | PD-46 | 9 h |
| AJ-08 | Categorías que administra el administrador | RF-M1-08 (nuevo) | PD-49 | 6 h |
| AJ-09 | Cargos extra ligados a la línea (cantos, perforaciones, biselados) | RF-M1-09 (nuevo), RN-02 | PD-02 (mecanismo) | 12 h |
| | **Total** | | | **≈ 55 h (6 a 7 días)** |

**Por qué este orden:**
- Primero lo pequeño e independiente (AJ-01, AJ-02).
- Después lo de órdenes (AJ-03 y AJ-04). AJ-03 va antes de AJ-07 porque ambos tocan la conversión de cotización a orden.
- Luego lo de dinero (AJ-05 y AJ-06), que toca la caja.
- Al final el catálogo (AJ-08 y AJ-09): AJ-09 es lo más grande y toca el precio de cada línea.
- Si el tiempo no alcanza, se recorta desde el final con aprobación de Juanito, nunca la calidad ([README](README.md)).

## Fuera de esta fase

- **Anticipo al cancelar una orden (PD-07):**
  - Lo define HummingX y se le comunica a Luis en la entrega [ADR-0044].
  - Mientras tanto el sistema sigue igual: anota el anticipo recibido y no lo devuelve solo.
- **Transferencia que nunca llegó:**
  - Se resuelve con la cancelación que ya existe (venta u orden, con motivo).
  - No se agrega un estado "rechazada".
- **Retiros de efectivo y gastos (PP-09):** siguen como propuesta.
- **Parámetros de redondeo y mínimos de las reglas de precio** en el formulario: Luis cobra medida exacta y sin mínimo (PD-02), así que no se exponen.
- **Descuentos sobre los cargos extra:** el descuento con PIN sigue aplicando al precio de la pieza principal.

## Reglas de diseño que aplican a todas las historias

1. **Compatibilidad con operaciones en cola.** Una tablet puede tener operaciones guardadas sin internet con el formato anterior. Por eso:
   - Todo campo nuevo en una operación es **opcional en el esquema** (`packages/core/src/modules/sync/domain/operation.ts`) y obligatorio en el caso de uso.
   - Si el servidor recibe el formato anterior, aplica la operación y la marca **por revisar** con un motivo; no la rechaza (mismo patrón que `apply_reopen_cash_shift`).
   - Rechazar una operación detiene la fila de esa tablet, y eso no se hace.
2. **Nada contable se modifica [RN-18].** Pagos, ventas y cortes no se editan:
   - Las confirmaciones y las devoluciones son **tablas nuevas de solo agregar**, con sus disparadores contra cambios y borrado, igual que `payments` y `cash_shift_reopenings`.
   - Las cancelaciones siguen siendo columnas de estado en el documento padre.
3. **Todo pasa por `receive_operation`.** Las tablets no escriben tablas. Cada operación nueva:
   - se registra en `OPERATION_TYPES` y `ESQUEMAS_DE_CARGA`;
   - tiene su `private.apply_*` con `revoke all … from public, anon, authenticated`;
   - se agrega al `case` de `public.receive_operation`, redefinido con `create or replace`;
   - tiene su espejo en el servidor en memoria (`order-operations.ts`) y su escenario en el contrato (`operation-receiver.contract.ts`), que corre igual en memoria y contra Postgres.
4. **Columnas nuevas en tablas que viajan a la tablet:**
   - van **al final** de la vista `*_for_device` (`create or replace view`);
   - se agregan al mapeador de `supabase-document-replica.ts`;
   - si el documento local viejo no las trae, se leen como `undefined → null`.
   - IndexedDB no cambia de versión: los documentos son JSON.
5. **Tabla nueva:** lleva RLS (solo lectura para el administrador), su vista para dispositivos, `change_seq` con su disparador, su cursor de réplica y su entrada en `admin_export_data`.
6. **Bitácora:**
   - Cada acción escribe su renglón con `private.add_audit`.
   - Las acciones nuevas se agregan a `AuditAction` (`audit/domain/audit-entry.ts`) con su etiqueta en `textos.ts`.
   - De paso se agregan las que hoy faltan: `COUNTER_SALE_CREATED`, `COUNTER_SALE_CANCELLED`, `CASH_SHIFT_OPENED`, `CASH_SHIFT_CLOSED` y `CASH_SHIFT_REOPENED`.
7. **Migraciones:**
   - Una por historia, `2026112NHHMMSS_<nombre>.sql`, con encabezado que cite la historia y el ADR.
   - Siempre nuevas: no se edita una migración que ya corrió.
   - Los valores sembrados se cambian con `update` en una migración nueva.
8. **Despliegue de cada PR** (un solo proyecto [ADR-0043]): al fusionar, Vercel publica la aplicación sola. **Inmediatamente después** se corre *Desplegar a Supabase* (migraciones y funciones, con el núcleo empaquetado de nuevo) y se revisa `salud`. Las migraciones son aditivas, así que la aplicación vieja sigue funcionando con la base nueva. Después de la entrega este orden se invierte: primero la base, luego la aplicación.
9. **Permisos:** cada permiso nuevo entra en la matriz (`identity/domain/permissions.ts`) y en `PARIDAD` (`paridad-de-permisos.integracion.test.ts`).

## Diseño por historia

### AJ-01 · Listas sin tope de 1000 filas

**Problema.** La API de Supabase entrega como máximo 1000 filas por consulta (`max_rows`, igual en local y en la nube). Varias listas del administrador leen sin paginar y se cortarían en silencio:
- productos (`supabase-catalog.ts` `list()`), lo que también afecta la revisión de códigos repetidos al importar;
- clientes (`supabase-customers.ts` `list()`);
- facturas (`admin_invoice_candidates` y `admin_invoice_list`).

La réplica a las tablets ya pagina por `change_seq` y no tiene el problema.

**Diseño.**
- Un ayudante `leerTodo(consulta, tamaño = 1000)` en `apps/web/src/shared/infra/` que repite `.range(desde, hasta)` hasta recibir menos de una página, con orden estable por `id` como desempate.
- Se usa en las listas de arriba.
- Al crear muchos productos de golpe (`createMany`) se compara cuántos regresaron con cuántos se mandaron.

**Pruebas.**
- Unitaria del ayudante con una fuente falsa: 0, 999, 1000, 1001 y 2500 filas.
- Integración: 1200 productos de prueba; la lista los trae todos y la importación detecta un código repetido que está después del 1000.

### AJ-02 · El corte pide explicación si hay diferencia (PD-44)

**Regla [ADR-0044]:** si el efectivo contado difiere del esperado, aunque sea un centavo, el cierre exige una explicación escrita.

**Conteo a ciegas.** Hoy el cajero cuenta sin ver el esperado y la diferencia aparece después de cerrar. Se conserva así: captura el contado y toca **Cerrar**. Si hay diferencia, el sistema la muestra en ese momento y pide la explicación antes de terminar. Sin diferencia, cierra como hoy.

**Núcleo.**
- `closeCashShift(deps, actor, shiftId, countedCashCents, explicacion?)`: si `contado − esperado ≠ 0` y la explicación está vacía, regresa `REASON_REQUIRED`, que ya existe.
- Hay que separar "calcular la diferencia" de "cerrar" para que la interfaz pida la explicación sin revelar el esperado antes del conteo.
- `CashShift` gana `differenceNote: string | null`.
- La carga `CloseCashShift` gana `differenceNote` (opcional, máximo 500 caracteres).

**Base de datos (migración nueva).**
- `cash_shifts.difference_note text`.
- `apply_close_cash_shift` la guarda.
- Si la diferencia **del servidor** no es cero y no hay nota, aplica y marca por revisar con `DIFFERENCE_WITHOUT_NOTE`.
- La bitácora `CASH_SHIFT_CLOSED` agrega `explicacion`.
- La vista `cash_shifts_for_device` agrega `difference_note` al final.

**Interfaz.**
- `TurnoDeCaja.tsx`: paso de explicación (campo de texto obligatorio con la diferencia en grande, "sobrante" o "faltante").
- La lista de cortes y la hoja del corte (`shift-cut-sheet.ts`) muestran la explicación.

**Pruebas.**
- Núcleo: diferencia 0 cierra sin nota; diferencia de ±1 centavo sin nota falla; con nota cierra y la nota viaja en la carga.
- Contrato: cierre con diferencia y sin nota queda por revisar; con nota, aplicado.
- pgTAP en `16_cash_shifts`.
- Interfaz: el esperado no se ve antes de tocar Cerrar.
- `cash-shift.ts` sigue en la mutación crítica.

### AJ-03 · Fecha de entrega obligatoria y órdenes atrasadas (PD-41)

**Regla [ADR-0044]:**
- La fecha estimada se elige con un calendario al crear la orden y es obligatoria.
- Se puede cambiar mientras la orden no esté entregada ni cancelada, y cada cambio queda en la bitácora (ya pasa: `WORK_ORDER_UPDATED` guarda el valor anterior y el nuevo).
- Una orden está **atrasada** si hoy (hora de la Ciudad de México) es posterior a su fecha y no está entregada ni cancelada.

**Núcleo.**
- `convertQuoteToWorkOrder(deps, actor, quoteId, { estimatedDeliveryDate })` y `NuevaOrden` ganan la fecha. Sin fecha o con fecha pasada: `DATE_REQUIRED` o `INVALID_DATE`.
- `updateWorkOrder` ya no acepta `null` para la fecha ni cambios con la orden entregada.
- Función derivada `isWorkOrderLate(orden, hoy)` en `order-board.ts`, sin guardar nada (mismo criterio que `displayStatus` de la cotización [ADR-0015]).
- Filtro `overdue` en `filterWorkOrders` y conteo de atrasadas en `summarizeOrders`.

**Base de datos.**
- La columna `estimated_delivery_date` ya existe y **sigue aceptando nulos**: órdenes viejas y operaciones en cola.
- `apply_create_work_order` la guarda desde la carga y la agrega a la bitácora `WORK_ORDER_CREATED`.
- La carga `CreateWorkOrder` gana `estimatedDeliveryDate` opcional en el esquema.

**Interfaz.**
- En `Ordenes.tsx`, **Crear orden de trabajo** abre una ventana (`Ventana`) con el calendario (mínimo: hoy) antes de convertir.
- Etiqueta **Atrasada** (tono peligro) junto al estatus, en la lista y en el detalle.
- Botón de filtro "Atrasadas" con su conteo.
- Indicador "Órdenes atrasadas" en el panel de inicio.
- Las órdenes sin fecha muestran "Sin fecha de entrega" y un aviso en el detalle para capturarla.

**Pruebas.**
- `isWorkOrderLate`: hoy igual a la fecha no es atrasada; un día después sí; entregada o cancelada nunca; cambio de día a medianoche de la Ciudad de México; propiedades.
- Casos de uso: la conversión sin fecha falla; quitar la fecha falla; cambiar la fecha de una orden entregada falla.
- Contrato: la fecha viaja y se guarda.
- Interfaz: la ventana pide la fecha; la etiqueta y el filtro funcionan.
- Ajustar las 13 llamadas de prueba que crean órdenes.

### AJ-04 · Cuentas atrasadas desde la entrega, con 1 día por omisión (PD-33)

**Regla [ADR-0044]:**
- El saldo se vuelve exigible **al entregar**.
- Los días de una cuenta por cobrar se cuentan desde la fecha de entrega.
- Con el umbral por omisión de **1 día**: lo entregado hoy y no pagado está al corriente; desde el día siguiente sale atrasado.
- Las órdenes con saldo que todavía no se entregan aparecen en la lista como **"Por entregar"**, sin días ni atraso.
- El umbral sigue siendo configurable en Configuración (1 a 365).

**Núcleo.**
- `buildReceivables` recibe `deliveredAt` y cuenta los días desde el día de entrega en la Ciudad de México. Sin entrega, `daysOutstanding = null` con un estado nuevo `NOT_DELIVERED`, distinto de "sin fecha válida".
- `DEFAULT_OVERDUE_DAYS = 1`.
- `receivablesAging` agrega el grupo "Por entregar" y nombra bien los tramos de un día ("Hoy", "1 día", "2 días o más").

**Hora real de entrega.** Hoy el servidor pone `delivered_at = now()` al **recibir** la operación. Si la tablet entregó sin internet, la fecha queda la del envío y los días salen mal. Se corrige:
- `apply_deliver_work_order` usa la hora de la tablet (`deliveredAt` de la carga);
- la limita a no ser anterior a la creación de la orden ni posterior a la hora del servidor más 5 minutos;
- si la tuvo que ajustar, lo anota en la bitácora.

**Base de datos.**
- Migración con `update business_settings set value = '1'` para `receivable_aging_threshold_days`.
- Cambio de `apply_deliver_work_order`.
- `01_business_settings.test.sql` se actualiza al nuevo valor.

**Interfaz y textos.**
- "Días desde la entrega" en `CuentasPorCobrar.tsx`, Configuración, Reportes y el panel de inicio.
- Manuales de usuario y de soporte.

**Pruebas.**
- Núcleo:
  - entregada hoy, 0 días y al corriente;
  - entregada ayer, 1 día y atrasada;
  - sin entregar, "Por entregar" y nunca atrasada;
  - umbral 7;
  - propiedades.
- Reportes: tramos con umbral 1 y 10.
- Contrato: una entrega sin internet conserva la hora de la tablet; una hora futura se ajusta.
- Interfaz: `cuentas-por-cobrar`, `reportes`, `resumen-del-inicio`.

### AJ-05 · Confirmar que llegó una transferencia (PD-43)

**Regla [ADR-0044]:**
- Un administrador marca **"Ya llegó"** en un pago por transferencia después de revisar el banco. Queda quién y cuándo.
- Una transferencia sin confirmar se ve como **"Por confirmar"**.
- Los totales de cobro y el corte no cambian: la transferencia cuenta desde que se registra, como hoy.

**Por qué una tabla nueva.** `payments` es de solo agregar (RN-18) y su `change_seq` solo se pone al insertar. Además la réplica nunca sobrescribe un pago que la tablet ya tiene. Una columna de confirmación en `payments` violaría RN-18 y no llegaría a las tablets.

**Base de datos.**
- Tabla `payment_confirmations`:
  - columnas `payment_id uuid primary key references payments`, `confirmed_by`, `confirmed_at`, `device_id`, `op_id` y `change_seq`;
  - sus disparadores de solo agregar;
  - RLS solo lectura para el administrador;
  - vista `payment_confirmations_for_device`;
  - entrada en la exportación.
- Operación nueva `ConfirmTransfer { paymentId, confirmedAt }`:
  - `apply_confirm_transfer` revisa que el pago exista y sea transferencia, y que quien confirma (persona o autorizador) sea administrador activo;
  - si ya estaba confirmada, queda por revisar con `ALREADY_CONFIRMED`, sin duplicar;
  - escribe en la bitácora `TRANSFER_CONFIRMED`.

**Núcleo.**
- Permiso `TRANSFER_CONFIRM` (Administrador sí; Cajero / vendedor no, salvo con PIN de administrador, como en las cancelaciones).
- Caso de uso `confirmTransfer`.
- Colección local `payment_confirmations` con su cursor en `refreshDocuments`.
- Función `transferStatus(pago, confirmaciones)`.

**Interfaz.**
- Etiqueta "Por confirmar / Confirmada" en cada pago por transferencia: detalle de la orden, detalle de la venta y corte.
- Lista **"Transferencias por confirmar"** en Cuentas por cobrar, con el botón **Ya llegó**.
- Funciona sin internet: se encola como cualquier operación.

**Pruebas.**
- Caso de uso: permisos y PIN; confirmar un pago en efectivo falla.
- Contrato: la confirmación se aplica; confirmar dos veces no duplica; un pago inexistente queda por revisar.
- pgTAP: la tabla es de solo agregar y la tablet no la escribe.
- Réplica: la confirmación llega a otra tablet.
- Interfaz: la lista y el botón.

### AJ-06 · Devolución al cancelar una venta de mostrador (PD-24)

**Regla [ADR-0044]:**
- Al cancelar una venta cobrada se le **devuelve el dinero al cliente por el mismo medio** con que pagó.
- La devolución se registra **en el turno abierto de quien cancela**: sale de su cajón si fue en efectivo.
- El cobro original **se queda en el turno donde se cobró**. Así un corte cerrado ya no cambia después.

**Problema que resuelve.** Hoy cancelar una venta saca su cobro del turno donde se cobró, aunque ese corte ya esté cerrado. El efectivo que sale del cajón de hoy no queda registrado en ningún lado:
- el corte de hoy sale con faltante;
- los reportes del día anterior cambian sin rastro;
- la diferencia guardada del corte cerrado ya no coincide con lo que muestran los reportes.

**Base de datos.**
- Tabla `refunds` (devoluciones):
  - columnas `id` (generado en la tablet), `counter_sale_id`, `method`, `amount_cents > 0`, `cash_shift_id` (obligatorio si es efectivo), `user_id`, `authorized_by`, `device_id`, `refunded_at`, `op_id` y `change_seq`;
  - de solo agregar, con RLS de solo lectura para el administrador;
  - su vista para dispositivos y su entrada en la exportación.
- `CancelCounterSale` gana `refunds: [{ id, method, amountCents, cashShiftId }]`, opcional en el esquema.
- `apply_cancel_counter_sale`:
  - inserta las devoluciones;
  - revisa que por cada medio sumen lo cobrado;
  - si no suman, aplica y marca por revisar con `REFUND_MISMATCH`;
  - si el turno de la devolución está cerrado, marca por revisar con `SHIFT_CLOSED`;
  - si la carga viene sin devoluciones (operación vieja), marca por revisar con `REFUND_MISSING`;
  - escribe en la bitácora `COUNTER_SALE_REFUNDED`.
- `private.shift_cash_collected_cents`:
  - deja de excluir las ventas canceladas;
  - resta las devoluciones en efectivo **del turno donde se hicieron**.

**Núcleo.**
- `cancelCounterSale` arma las devoluciones a partir de los pagos de la venta.
- Necesita un turno abierto de quien cancela si hay efectivo que devolver (`NO_OPEN_SHIFT`).
- `summarizeShift`:
  - el esperado es fondo + efectivo cobrado − efectivo devuelto en ese turno;
  - las ventas canceladas de otros turnos ya no afectan;
  - se agrega una línea "Devoluciones" en lugar de "Ventas canceladas".
- Reportes (`reports.ts`): los cobros del periodo restan las devoluciones del periodo, en el día en que se hicieron (base de efectivo [RN-20]); las ventas canceladas siguen fuera de "ventas".
- También se revisan los otros que leen pagos: historial del cliente, comprobante de venta y hoja del corte.

**Interfaz.**
- La ventana de cancelar muestra cuánto se devuelve y por qué medio.
- La hoja del corte y el corte muestran las devoluciones.
- El detalle de la venta dice "Cancelada · se devolvieron $X en efectivo".

**Datos existentes.** Solo hay datos inventados, y en la entrega el proyecto se recrea vacío [ADR-0043]. Las ventas canceladas de prueba sin devolución cambiarán su corte recalculado; no hace falta migrarlas.

**Pruebas.**
- Dominio:
  - venta cancelada en el mismo turno: cuadra;
  - venta de un turno cerrado cancelada hoy: el corte de ayer no cambia y el de hoy resta;
  - pago mixto;
  - solo transferencia;
  - propiedades; `cash-shift.ts` y `reports.ts` siguen en la mutación crítica.
- Contrato: devoluciones que suman, que no suman, operación vieja sin devoluciones y turno cerrado.
- Integración E1-E2 (`e1-e2-mostrador.integracion.test.ts`, líneas 281-351): se actualiza a la regla nueva.
- pgTAP: `refunds` de solo agregar.

### AJ-07 · Entregas por partes (PD-46)

**Regla [ADR-0044]:**
- Un trabajo que se entrega por partes se maneja como **una orden por cada parte**, y se marca como "por partes".
- Se hace al convertir la cotización: el usuario elige **qué líneas van en esta parte**. Las que quedan se pueden convertir después en otra parte.
- Cada parte tiene sus totales, su anticipo (el mismo porcentaje), sus cobros, su fecha de entrega y su garantía.
- Todas las partes quedan ligadas a la misma cotización y se muestran como "Parte 1", "Parte 2"…

**Por qué así.** Hoy una cotización se convierte **una sola vez** (`quotes.converted_work_order_id`). Repartir una orden ya creada mezclaría anticipos y pagos. Elegir líneas al convertir mantiene cada orden con su dinero claro y aprovecha lo que ya existe.

**Base de datos.**
- `work_order_lines.quote_line_id uuid` con índice único parcial: una línea de cotización entra en una sola orden.
- `work_orders.part_number smallint` y `work_orders.in_parts boolean not null default false`.
- `apply_create_work_order`:
  - acepta convertir otra vez una cotización mientras sus líneas no estén ya convertidas;
  - si se repite una línea, aplica y marca por revisar con `QUOTE_LINE_ALREADY_CONVERTED`;
  - calcula `part_number` en el servidor;
  - `quotes.converted_work_order_id` queda como "primera orden", por compatibilidad.
- La vista de órdenes agrega `part_number` e `in_parts` al final.
- Una línea que se fue a una orden cancelada **no** se libera. Para rehacerla se duplica la cotización, función que ya existe. Esto evita dobles cobros.

**Núcleo.**
- `convertQuoteToWorkOrder(..., { lineIds, estimatedDeliveryDate })`: si no se eligen líneas, van todas, como hoy.
- El documento local de la cotización guarda las líneas ya convertidas y el estado derivado "convertida en parte".
- Funciones derivadas `pendingQuoteLines(cotizacion, ordenes)` y `partsOf(cotizacion, ordenes)`.

**Interfaz.**
- La ventana de **Crear orden de trabajo** (la misma de AJ-03) agrega "¿Se entrega por partes?". Si la respuesta es sí, se marcan las líneas de esta parte.
- Las cotizaciones con líneas pendientes siguen en "Cotizaciones aceptadas por convertir", con la leyenda "Faltan N líneas".
- El detalle de la orden muestra "Parte 2 de este trabajo", con enlace a las otras partes.
- El comprobante de trabajo dice "Parte 2".

**Pruebas.**
- Casos de uso:
  - convertir todo, como hoy;
  - convertir en dos partes;
  - repetir una línea falla;
  - el anticipo de cada parte;
  - la parte cancelada no libera líneas.
- Contrato y pgTAP: índice único, número de parte, operación vieja sin `lineIds`.
- Interfaz: la ventana con líneas.
- Recorrido de aceptación nuevo en `e3-e4` o propio.

### AJ-08 · Categorías que administra el administrador (PD-49)

**Regla [ADR-0044]:** el administrador puede agregar categorías, cambiarles el nombre y el orden, y desactivarlas. Una categoría no se borra. Tampoco se desactiva mientras tenga productos activos. Así Luis agrega "Canceles comerciales", "Vitrales" o "Reparaciones a domicilio" sin ayuda técnica.

**Base de datos.**
- `product_categories` gana `is_active boolean not null default true` y `created_at`.
- `sort_order` deja de ser único: se ordena por `sort_order` y luego por nombre.
- Índice único sobre `lower(btrim(name))`; el núcleo además compara sin acentos, igual que la importación.
- Políticas de administrador para insertar y actualizar, con permiso por columnas como en productos. Sigue sin haber borrado: se conservan las restricciones de `22_revision_de_seguridad`.
- Disparador de bitácora `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_ACTIVATED` y `CATEGORY_DEACTIVATED`, con la forma de `products_registrar_cambios`.
- Un disparador impide desactivar una categoría con productos activos.

**Núcleo.**
- `Category` gana `isActive`.
- Puerto `CategoryAdmin`; casos de uso `createCategory` y `updateCategory` con permiso `CATALOG_EDIT`.
- `buildCategory` valida el nombre y las claves fiscales con las expresiones que ya existen.
- La importación rechaza categorías inactivas.

**Interfaz.**
- Pestaña **Categorías** en Catálogo: lista, agregar, renombrar, subir y bajar, activar y desactivar.
- El formulario de producto solo ofrece categorías activas, más la actual al editar.
- Las tablets reciben las categorías completas en cada actualización, así que no hace falta más.

**Claves fiscales.** Una categoría nueva hereda las claves de prueba hasta que el contador las revise (PD-29, en pausa con la facturación). Cambiar las claves de una categoría afecta a los productos que se den de alta después, no a los existentes.

**Pruebas.**
- Dominio: validaciones y nombre repetido sin acentos.
- Casos de uso: permisos.
- Contrato del catálogo: deja de exigir exactamente las 11 iniciales y exige que estén al principio.
- pgTAP:
  - `04_catalog` cambia "las categorías no se cambian por la API" por "solo el administrador las cambia";
  - no se desactiva una categoría con productos activos;
  - la bitácora se escribe.
- Interfaz: la pestaña.

### AJ-09 · Cargos extra ligados a la línea (PD-02, RN-02)

**Regla [ADR-0044]:**
- Los cantos, perforaciones, biselados y cargos parecidos son **productos de tipo "Cargo extra"** en el catálogo, con su precio y su unidad.
- La unidad por omisión es **m²**, como dijo Luis. También se permiten metro lineal y pieza, para no tener que cambiar código si un cargo se cobra distinto.
- En el cotizador se agregan **a una línea de vidrio**. Su importe se calcula con la medida de esa línea:
  - m²: el área cobrada de la línea por la cantidad;
  - metro lineal: el perímetro de la pieza;
  - pieza: la cantidad que se capture.
- El importe del extra se suma al de la línea.
- Así lo describen RN-02 y `CATEGORIAS_CATALOGO.md` ("cargos adicionales de la regla de precio, no productos sueltos").

**Diseño (opción elegida: el extra va dentro de la línea).**
- `QuoteLine.extras: readonly LineExtra[]`. Cada extra lleva:
  - `productId`, `name` y `chargeUnit`;
  - `unitPriceCents`, copiado del catálogo al cotizar;
  - `quantity`, solo para pieza;
  - `amountCents`.
- `calcularLinea` (`quote-line.ts`) suma el importe de los extras **antes** de separar el IVA. Así `baseCents`, `taxCents` y `lineTotalCents` de la línea ya los incluyen, y no cambian:
  - los totales;
  - las revisiones del servidor (total = subtotal + IVA);
  - los reportes;
  - la factura (un concepto por línea).
- El detalle de la línea los enumera: "+ Canto pulido 2.40 m² × $120".
- Los extras heredan la exención de IVA de la línea.
- Redondeo: cada extra con `areaAmount` o `linearAmount` (redondeo al centavo con `BigInt`, como hoy), y la suma es exacta en centavos.
- `ProductKind` gana `EXTRA`; un cargo extra no se vende como renglón suelto en el cotizador ni en el mostrador.

**Alternativa descartada.** Extras como renglones hijos en tablas propias. Obligaría a cambiar los totales, las revisiones del servidor, los documentos y los conceptos de factura, con mucho más riesgo.

**Base de datos.**
- `extras jsonb not null default '[]'` en `quote_lines`, `work_order_lines` y `counter_sale_lines`, con `check (jsonb_typeof(extras) = 'array')`.
- Las tres funciones `apply_*` lo guardan; las vistas de órdenes y ventas lo agregan a las líneas.
- Nuevo par válido tipo/unidad (`EXTRA` con m², metro lineal o pieza) en la restricción de `products` y en `UNIDADES_POR_TIPO`.
- La exportación lo incluye sola.

**Carga.** `quoteLineSchema` agrega `extras` opcional (`[]` por omisión). Cada extra: importe ≥ 0 y la suma de los extras ≤ `baseCents + taxCents` de la línea.

**Núcleo, además.**
- `duplicateQuote` vuelve a calcular los extras con el catálogo actual y omite los inactivos, con aviso.
- `repriceQuoteLine` (descuento con PIN) solo toca la pieza principal.
- Los documentos (`quote-document.ts`, `work-order-document.ts`, `sale-document.ts` y el HTML de la hoja carta) muestran los extras como subrenglones del concepto.
- El mostrador usa el mismo cálculo, porque el ticket ya usa `buildQuoteLine`.

**Interfaz.**
- En el editor de la línea, **"Agregar cargo extra"** con buscador de productos `EXTRA`. Muestra el importe en vivo y permite quitarlo.
- En el catálogo, el tipo "Cargo extra".
- En la importación, el tipo `extra`.

**Pruebas.**
- `quote-line.ts` entra a la **mutación crítica** (≥ 90 %).
- Propiedades:
  - la línea con extras es igual a la línea sin extras más la suma de los extras, al centavo;
  - base + IVA = total;
  - el importe es monótono en la medida.
- Casos de uso: cotizar con extras; convertir a orden conserva los extras; duplicar.
- Contrato: las cargas con extras se guardan y los totales cuadran.
- pgTAP: `jsonb` de tipo arreglo; tipo `EXTRA` válido solo con sus unidades.
- Documentos: el subrenglón aparece en la hoja carta y en el PDF.
- Aceptación: un recorrido de E8 con un vidrio de 1.20 × 2.00 m con canto pulido y dos perforaciones, con el total esperado calculado a mano.

## Entregables

- Nueve PR fusionados, cada uno con su migración (cuando aplica), pruebas, textos y manuales al día.
- [ADR-0044] aceptado; `REQUERIMIENTOS.md`, `PENDIENTES.md`, `GLOSARIO.md` (devolución, cargo extra, parte), `MODELO_DE_DATOS.md`, `SINCRONIZACION.md` y `CHANGELOG.md` al día.
- `docs/calidad/PRUEBAS_DE_ACEPTACION.md` con los casos nuevos.

## Pruebas obligatorias (resumen)

- Cada historia: unitarias y de casos de uso primero (rojo → verde), contrato en memoria y en Postgres, pgTAP de la tabla o función tocada, prueba de interfaz.
- Mutación crítica ≥ 90 % en `cash-shift.ts`, `reports.ts`, `receivables.ts`, `work-order.ts`, `order-board.ts` (nuevo) y `quote-line.ts` (nuevo).
- Compatibilidad con operaciones viejas: por cada carga que cambia, un escenario de contrato con el formato anterior, que **no** se rechaza.
- Pruebas de integración completas (`pnpm test:integracion`) con Supabase local antes de cada PR.

## Compuerta de salida

- [ ] Las nueve historias fusionadas con la compuerta de CI en verde, sin pruebas desactivadas ni umbrales bajados.
- [ ] Migraciones desplegadas a la base (*Desplegar a Supabase* en verde y `salud` en 200).
- [ ] Prueba manual en `https://sistema.zammir-solutions.com` de cada historia, con datos inventados.
- [ ] Recorridos E1 a E10 en verde.
- [ ] Manuales de usuario y de soporte, y el recorrido guiado, al día con los cambios visibles.

## Riesgos y pendientes

| Riesgo | Cómo se cubre |
|---|---|
| Una tablet con operaciones viejas en cola | Campos nuevos opcionales en el esquema; el servidor marca por revisar y no rechaza (regla 1) |
| La aplicación nueva llega antes que la migración | Migraciones aditivas y *Desplegar a Supabase* justo después de fusionar (regla 8) |
| AJ-06 cambia cómo se calcula el corte | Pruebas de dominio con turnos cerrados, mutación crítica y el recorrido E1-E2 actualizado; sin datos reales que migrar |
| AJ-07 cambia la regla "una cotización, una orden" | Índice único por línea en la base y compatibilidad con la conversión completa de siempre |
| AJ-09 toca el precio de cada línea | Los extras se suman antes del IVA con las mismas funciones de redondeo; propiedades y mutación crítica en `quote-line.ts` |
| Los precios de los cargos extra no llegan (PD-02) | El mecanismo funciona sin ellos; Luis los captura en el catálogo cuando los tenga |
| El esfuerzo (≈ 55 h) empuja la entrega | Juanito decide el recorte desde el final de la lista; AJ-09 es el candidato natural a ir después de la entrega |
