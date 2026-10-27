# Fase 7 — Sprint 3: Órdenes de trabajo y mostrador

- **Tipo:** código
- **Fechas:** 16 – 22 de noviembre de 2026. **El lunes 16 es feriado** [DC §13]: el sprint tiene un día hábil menos y es el más cargado
- **Lee antes:** [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md), `REQUERIMIENTOS.md` M3, M4 y M5, RN-08 a RN-11, RN-14, RN-18, [ADR-0018] y el ADR con el resultado de la prueba de impresión (Sprint 0)

## Objetivo

Seguir cada trabajo desde el anticipo hasta la entrega con su garantía por escrito, y controlar la caja que comparten tres personas: **quién cobró qué, cuánto debe haber en efectivo y cuánto hay.**

## Entra si

- Sprint 2 cerrado con su compuerta en verde.
- Motor de sincronización y folios funcionando.
- ADR de impresión aceptado y la impresora definitiva disponible.

## Alcance

### 7.1 Órdenes de trabajo — M3
- RF-M3-01 a RF-M3-08, más RF-M2-08 (convertir cotización aceptada en orden en un solo paso).
- Folio `OT-AAAA-0001` con el mismo mecanismo del Sprint 2.
- Estados: en espera → en proceso → listo para entrega o instalación → entregado; cancelado con motivo. Botón "Avanzar" [RF-M3-02].
- Responsables: quién mide, quién fabrica, quién instala.
- Fotos opcionales de la medición, guardadas en la tablet y enviadas al sincronizar. Límite de tamaño y compresión definidos en la historia.
- Datos editables de la orden (responsables, fecha estimada, notas): si dos personas los cambian a la vez, gana el último cambio **por campo** y queda en bitácora [RNF-05].
- Anticipo sugerido desde configuración (50%), editable; método de pago y quién cobró [RF-M3-03, RN-08].
- Saldo = total − pagos recibidos, siempre visible.
- Entrega con saldo mayor a cero: solo con autorización de administrador y motivo; el saldo pasa a cuentas por cobrar [RF-M3-04].
- Garantía al entregar: inicio, duración, cobertura y exclusiones, con valores configurables (PD-06) [RF-M3-05, RN-14].
- Cancelación solo por administrador, con motivo; el anticipo se registra según lo que se defina en PD-07, sin regla automática [RF-M3-08].
- Comprobante de trabajo en PDF tamaño carta con QR y código de verificación para autofacturación; se genera al cobrar el anticipo y de nuevo al entregar con el saldo liquidado [RF-M3-06]. Se comparte por WhatsApp [ADR-0005].
- Tablero por estatus y lista con filtros; resumen con valor en producción y saldo por cobrar de lo que está listo [RF-M3-07].

### 7.2 Mostrador — M4
- RF-M4-01 a RF-M4-08.
- Venta rápida con piezas estándar, servicios y vidrio a medida (usa las reglas de precio del Sprint 1).
- Cobro en efectivo (recibido y cambio), transferencia (referencia opcional) o mixto [RN-10].
- Folio `V-AAAA-0001`.
- Anticipos y saldos de órdenes también se cobran aquí y cuentan en la caja de quien los recibió [RN-11].
- Ticket térmico de 80 mm con nombre del negocio, folio, fecha, cajero, conceptos, total, forma de pago, QR y código de autofacturación con la leyenda del plazo (PD-09) [RF-M4-04].
- Corte de caja [RF-M4-06]:
  - *Nivel 1, por cajero:* apertura con fondo inicial opcional, ventas y cobros por método, efectivo esperado, efectivo contado, diferencia, resumen impreso en ticket.
  - *Nivel 2, consolidado del día:* por método y por cajero, solo administradores.
  - Un corte cerrado no se edita; solo un administrador lo reabre, con bitácora.
  - Qué pasa con operaciones de la tablet todavía no sincronizadas al cerrar el corte: según `SINCRONIZACION.md`.
- Cancelar venta: solo administrador, con motivo y bitácora [RF-M4-07].

### 7.3 Impresión [ADR-0018]
- Puerto `TicketPrinter` con **tres adaptadores** y uno falso para pruebas:
  - Capa 1: Web Bluetooth + ESC/POS, con los parámetros validados en el Sprint 0 (servicio, característica, tamaño de fragmento, página de códigos). Logo y QR como imagen raster; corte automático.
  - Capa 2: ticket de 80 mm en HTML o PDF con `window.print()`.
  - Capa 3: compartir el ticket como PDF o imagen por WhatsApp.
- Emparejar con un gesto del usuario; reconectar sin selector cuando el navegador lo permita.
- Estado de la impresora siempre visible ("Impresora conectada" / "Desconectada") y botón "Prueba de impresión" en la configuración [RF-UX-06].
- Plantillas de ticket (venta, cobro de orden, corte) separadas del adaptador: generan el contenido; el adaptador solo lo envía.
- Manejo de errores visibles: impresora apagada, sin papel, desconectada; la venta queda guardada aunque el ticket no salga, y se puede reimprimir.

### 7.4 Clientes — M5 (segunda parte)
- RF-M5-02: historial completo del cliente (cotizaciones, órdenes, ventas, pagos, garantías; facturas en el Sprint 4).
- RF-M5-03: marca de cliente recurrente con dos o más trabajos entregados.

### 7.5 Existencias — P2, detrás del interruptor (fuera de la entrega salvo que Luis lo active [ADR-0019])
- RF-M1-07: existencias de piezas estándar, mínimo configurable, alerta de existencia baja, descuento automático al vender o entregar.
- Si no cabe en el sprint, Juanito decide moverlo a después de la entrega.

## Fuera de esta fase

- Cuentas por cobrar como pantalla, reportes y facturación (Sprint 4). Aquí solo se genera el código de autofacturación que irá en el QR.

## Diseño

- **S:** `RegisterPayment` es un solo caso de uso para anticipos, saldos y ventas; el cálculo del corte (`CashShiftSummary`) es una función pura aparte.
- **O:** las plantillas de ticket son independientes; agregar un tipo de ticket no toca el adaptador de impresión.
- **L:** contrato de `TicketPrinter` (falso y real), `WorkOrderRepository`, `SaleRepository`, `PaymentRepository`, `CashShiftRepository`.
- **I:** el corte solo lee pagos; no depende del repositorio de órdenes.
- **D:** las órdenes no saben de impresoras ni de PDF; emiten datos y los adaptadores los presentan.
- Los pagos son **eventos que se agregan**, nunca se sobrescriben; el saldo es una derivación de ellos [00 §6].
- **Sin crédito** [RN-09]: no se construyen límites de crédito, intereses ni estados de cuenta. Un saldo solo existe como remanente de una orden.

## Entregables

- Órdenes de trabajo de punta a punta, con comprobante y garantía.
- Mostrador con venta, cobro, ticket impreso y corte de caja.
- Historial de clientes.
- P2, si cupo.

## Pruebas obligatorias

**Orden de trabajo (dominio)**
- [ ] Cada transición válida e inválida de la máquina de estados.
- [ ] Convertir cotización aceptada copia líneas y precios congelados; una cotización no aceptada no se puede convertir; una cotización no se convierte dos veces.
- [ ] Anticipo sugerido = porcentaje configurado del total, redondeado según el ADR de redondeo; editable.
- [ ] Saldo = total − pagos, con varios pagos, pagos mixtos y pagos en distintas tablets.
- [ ] Qué pasa con un pago mayor al saldo: comportamiento definido en la historia (Fase 3) y probado.
- [ ] Entregar con saldo: cajero rechazado; administrador sin motivo rechazado; administrador con motivo aceptado y bitácora generada.
- [ ] Entregar crea la garantía con fecha de inicio y la duración configurada.
- [ ] Cancelar: solo administrador, con motivo; registra el anticipo; la orden cancelada no avanza.
- [ ] **Nada se borra:** ningún rol puede eliminar órdenes ni pagos (RLS y caso de uso).

**Código de autofacturación**
- [ ] Único por comprobante y por ticket.
- [ ] No se puede adivinar (longitud y aleatoriedad definidas en la historia) ni deducir del folio.
- [ ] El QR contiene exactamente el enlace y el código esperados.

**Comprobante de trabajo (PDF)**
- [ ] Texto extraído con folio, cliente, medidas, total, anticipo, saldo, condiciones y garantía idénticos al dominio.
- [ ] Al entregar, el comprobante nuevo muestra saldo cero.

**Mostrador y corte** (mutación ≥ 90% en el cálculo del corte)
- [ ] Efectivo: cambio = recibido − total; recibido menor al total rechazado.
- [ ] Mixto: efectivo + transferencia = total exacto; cualquier otra combinación rechazada.
- [ ] Cada venta y pago guarda usuario, dispositivo y hora.
- [ ] Cobro de anticipo en Mostrador cuenta en la caja del cajero que lo recibió, no en la de quien creó la orden.
- [ ] Corte: esperado = fondo inicial + efectivo cobrado; diferencia = contado − esperado; sobrante, faltante y exacto.
- [ ] Propiedad: para cualquier conjunto de pagos de un turno, la suma por método = suma total del turno.
- [ ] Propiedad: el consolidado del día = suma de los cortes de cada cajero, por método.
- [ ] Corte cerrado no se edita; reabrir solo administrador con bitácora; cajero no ve cortes de otros.
- [ ] Turnos que cruzan la medianoche: se asignan al día que define la historia, en hora de México.
- [ ] Operaciones no sincronizadas al cerrar el corte: comportamiento de `SINCRONIZACION.md`.
- [ ] Cancelar venta: solo administrador, con motivo; la venta cancelada sale del corte según la regla definida.

**Ticket**
- [ ] Contenido de cada plantilla (venta, cobro, corte) comparado contra una versión aprobada guardada en el repositorio.
- [ ] Acentos, ñ, nombres largos y montos grandes caben en el ancho de 80 mm.
- [ ] Adaptador falso registra lo enviado; con impresora apagada o sin papel, la venta queda guardada y se ofrece reimprimir.

**Clientes**
- [ ] Historial muestra cotizaciones, órdenes, ventas, pagos y garantías del cliente, y nada de otros clientes.
- [ ] Recurrente con dos trabajos entregados, no con dos cotizaciones ni con órdenes canceladas.

**Existencias (P2, si se construye)**
- [ ] Con el interruptor apagado no hay rastro de existencias en la interfaz ni descuentos.
- [ ] Con el interruptor encendido: descuento al vender y al entregar, alerta al llegar al mínimo, nunca descuenta productos a medida.

**Extremo a extremo (tamaño de tablet)**
- [ ] Cotización aceptada → orden → anticipo en Mostrador → avanzar estados → entregar con saldo liquidado → comprobante con saldo cero.
- [ ] Venta de mostrador mixta sin conexión → ticket → reconectar → aparece en el corte del cajero correcto.
- [ ] Dos cajeros con cambio de usuario por PIN en la misma tablet: cada uno ve solo sus cobros en su corte.

**Conflictos de órdenes**
- [ ] Dos tablets editan campos distintos de la misma orden sin conexión: se conservan ambos cambios.
- [ ] Dos tablets editan el mismo campo: gana el último que llega y el valor anterior queda en bitácora [RNF-05].

**Impresión** (contrato de `TicketPrinter` con el adaptador falso; manual con los reales)
- [ ] Si la capa 1 no está disponible, se ofrece la capa 2, y si tampoco, la capa 3.
- [ ] Ticket impreso en menos de 5 segundos tras cobrar [RNF-26].

**Aceptación**
- [ ] E1 completo, de la medición al comprobante con garantía y QR.
- [ ] E2 completo, con la impresora real.
- [ ] E3 (parte de ventas): 10 ventas en modo avión, sin duplicados al reconectar.
- [ ] E4 (parte de cobros): tres usuarios por PIN cobrando en la misma tablet.

**Manual en tablet con la impresora real**
- [ ] Imprimir ticket de venta, de cobro de orden y de corte.
- [ ] Apagar la impresora a mitad de una venta y reimprimir.
- [ ] Escanear el QR del ticket con un teléfono.

## Compuerta de salida

- [ ] Compuerta común de [00 §5.2] en verde.
- [ ] Cálculo de corte al 100% de cobertura y mutación ≥ 90%.
- [ ] Los tres tipos de ticket impresos y aprobados por Juanito en papel.
- [ ] Revisión del sprint con Luis: flujo completo de una orden y un corte.

## Riesgos y pendientes

- Es el sprint con más módulos y con un día feriado. Si no cabe, Juanito decide qué se mueve; la propuesta es mover primero P2, después las fotos de medición; nunca el corte, los pagos ni la impresión.
- PD-06 (garantía), PD-07 (anticipo al cancelar), PD-09 (leyenda del plazo), PD-14 (P2).
- **Antes de empezar este sprint** se necesitan respuestas de Luis: caja compartida y unidad del corte (PD-36, **bloquea el corte**), medición final (PD-38), inicio de fabricación sin anticipo (PD-39), entregas parciales (PD-46), tiempos de entrega (PD-41), salidas de efectivo (PD-37), transferencias (PD-43). Propuestas relacionadas: PP-08 a PP-12, PP-14 y PP-16. Definición propuesta de los estatus en `docs/producto/REVISION_DE_NEGOCIO.md` §2.
