# Sprint 3 — Órdenes de trabajo y mostrador (16 – 22 nov)

> Plan: [`docs/plan/fase-07-sprint-3-ordenes-mostrador.md`](../plan/fase-07-sprint-3-ordenes-mostrador.md). Formato y tallas: [`README.md`](README.md).
> **Objetivo:** seguir trabajos que tardan días con anticipo, saldo y garantía; vender en el mostrador, imprimir el ticket y cerrar la caja.
> **Entra si:** Sprint 2 cerrado en verde, sincronización probada y resultado de la prueba de impresión aceptado por Juanito. El 16 de noviembre es feriado del negocio.
> **Antes de empezar** se necesitan respuestas de Luis: caja compartida y unidad del corte (PD-36, **bloquea S3-16 y S3-17**), medición final (PD-38), inicio de fabricación sin anticipo (PD-39), tiempos de entrega (PD-41), transferencias (PD-43) y entregas parciales (PD-46).
> P2 (existencias) **no está en este sprint** [ADR-0019].

## Órdenes de trabajo

### S3-01 · Crear la orden desde una cotización aceptada · L · 8 h
Como cajero
quiero convertir una cotización aceptada en orden de trabajo en un solo paso
para no volver a capturar nada.
- **Requerimientos:** RF-M3-01, RF-M2-08 · **Reglas:** RN-03, RN-08, RN-15 · **Decisión:** ADR-0016 · **Pendientes:** PD-38 (ajuste por medición final: sin ajuste automático)
- **Criterios de aceptación:**
  - Dada una cotización aceptada, cuando se convierte, entonces la orden copia cliente, líneas, precios y totales congelados y la cotización queda ligada.
  - Dada una orden manual, cuando se crea, entonces se puede capturar sin cotización.
  - Dada la emisión, cuando se guarda, entonces lleva folio provisional y, al enviarse, `OT-AAAA-0001`.
  - Dado el anticipo exigido, cuando se calcula, entonces es el porcentaje configurado redondeado hacia arriba [ADR-0011].

### S3-02 · Datos de la orden: responsables, fecha estimada y notas · M · 4 h
Como cajero
quiero registrar quién mide, fabrica e instala, la fecha estimada y notas
para que el trabajo no dependa de la memoria de alguien.
- **Requerimientos:** RF-M3-01 · **Reglas:** RN-19 · **Pendientes:** PD-41 (tiempos de entrega: fecha capturada a mano)
- **Criterios de aceptación:**
  - Dada una orden, cuando se asignan responsables, entonces se guarda cada rol con su usuario.
  - Dados dos cambios al mismo campo desde dos tablets, cuando llegan, entonces gana el último y queda en bitácora [RNF-05].

### S3-03 · Fotos opcionales de la medición · M · 4 h  · `tablet`
Como cajero
quiero adjuntar fotos de la medición a la orden
para recordar el sitio al fabricar.
- **Requerimientos:** RF-M3-01 · **Decisión:** `SINCRONIZACION.md` §9
- **Criterios de aceptación:**
  - Dada una foto, cuando se adjunta, entonces se comprime y respeta el límite de tamaño definido en esta historia.
  - Dada la tablet sin conexión, cuando se toma la foto, entonces se guarda y se envía al volver la conexión, sin bloquear la operación de la orden.
- **Candidata a moverse a "después de la entrega"** si el sprint no cabe (ver `CAPACIDAD.md`).

### S3-04 · Estatus de la orden y botón "Avanzar" · M · 4 h
Como cajero
quiero avanzar la orden al siguiente estatus con un botón
para que todos sepan en qué punto va.
- **Requerimientos:** RF-M3-02 · **Reglas:** RN-19 · **Pendientes:** PD-39 (si "en proceso" exige anticipo: ajuste configurable; valor por acordar con Luis)
- **Criterios de aceptación:**
  - Dado el estatus actual, cuando se avanza, entonces la máquina de estados permite solo en espera → en proceso → listo → entregado y cancelado.
  - Dado cada cambio, cuando ocurre, entonces guarda usuario, dispositivo y hora.
  - Dada una transición ya inválida por un cambio de otra tablet, cuando llega, entonces se aplica como "por revisar".

### S3-05 · Anticipos y pagos de una orden · L · 8 h
Como cajero
quiero registrar el anticipo y los pagos con su método y quién cobró, y ver el saldo
para que lo que se debe esté siempre claro.
- **Requerimientos:** RF-M3-03, RF-M4-05 · **Reglas:** RN-08, RN-09, RN-10, RN-11, RN-18 · **Decisión:** ADR-0011
- **Criterios de aceptación:**
  - Dado el anticipo sugerido, cuando se registra, entonces se puede editar y queda con método y cajero.
  - Dado el saldo, cuando se muestra, entonces es el total menos la suma de pagos, nunca un dato capturado.
  - Dado un pago mayor al saldo, cuando se intenta, entonces se rechaza; en efectivo, la diferencia es cambio.
  - Dados efectivo y transferencia en la misma operación, cuando se registran, entonces son filas de pago distintas del mismo documento.
  - Dado un pago, cuando se guarda, entonces nunca se sobrescribe ni se borra.

### S3-06 · Entrega con saldo pendiente · S · 2 h
Como administrador
quiero poder entregar con saldo solo con mi autorización y un motivo
para que no se entregue sin cobrar por descuido.
- **Requerimientos:** RF-M3-04 · **Reglas:** RN-09, RN-19
- **Criterios de aceptación:**
  - Dado un cajero, cuando intenta entregar con saldo, entonces se rechaza.
  - Dado un administrador (o autorización con PIN), cuando entrega con saldo y motivo, entonces se registra y el saldo pasa a cuentas por cobrar.

### S3-07 · Garantía al entregar · M · 4 h
Como administrador
quiero que al entregar se cree el registro de garantía
para que la garantía sea escrita y no verbal.
- **Requerimientos:** RF-M3-05 · **Reglas:** RN-14 · **Pendientes:** PD-06 (⛔ duración, cobertura y exclusiones: campos configurables, sin valor inventado)
- **Criterios de aceptación:**
  - Dada una orden entregada, cuando se registra, entonces se crea la garantía con inicio, duración, cobertura y exclusiones desde la configuración o el producto.
  - Dada la duración sin definir, cuando se crea, entonces el campo queda vacío y editable, no con un valor supuesto.

### S3-08 · Cancelación de la orden · S · 2 h
Como administrador
quiero cancelar una orden con motivo
para cerrarla sin borrarla.
- **Requerimientos:** RF-M3-08 · **Reglas:** RN-18, RN-19 · **Pendientes:** PD-07 (anticipo al cancelar: se registra motivo y monto, sin regla automática)
- **Criterios de aceptación:**
  - Dado un administrador, cuando cancela con motivo, entonces la orden queda cancelada con la etapa en que estaba y entrada de bitácora.
  - Dado un cajero, cuando intenta cancelar, entonces se rechaza.

### S3-09 · Comprobante de trabajo en PDF con QR · L · 8 h  · `tablet`
Como cajero
quiero un comprobante con saldo, garantía y QR de autofacturación
para que el cliente tenga su documento.
- **Requerimientos:** RF-M3-06 · **Reglas:** RN-21, RN-22, RN-26 · **Decisión:** ADR-0005 · **Pendientes:** PD-09 (leyenda del plazo configurable), PD-10 (dominio de prueba)
- **Criterios de aceptación:**
  - Dado el anticipo cobrado, cuando se genera el comprobante, entonces trae folio, cliente, descripción y medidas, total, anticipo, saldo, condiciones, garantía y QR con código de verificación.
  - Dada la entrega con saldo liquidado, cuando se genera de nuevo, entonces refleja el saldo en cero.
  - Dado el QR, cuando otro teléfono lo escanea, entonces lee la dirección con el folio y el código.
  - Dado el comprobante, cuando se envía, entonces se comparte por WhatsApp y no se imprime en carta.

### S3-10 · Tablero y lista de órdenes con resumen · M · 4 h
Como administrador
quiero ver las órdenes por estatus y filtrarlas
para saber qué hay en producción y cuánto falta por cobrar.
- **Requerimientos:** RF-M3-07 · **Reglas:** RN-17
- **Criterios de aceptación:**
  - Dado el tablero, cuando se abre, entonces muestra el conteo por estatus.
  - Dados los filtros por estatus, cliente, responsable y fechas, cuando se combinan, entonces devuelven la intersección.
  - Dado el resumen, cuando se calcula, entonces muestra el valor en producción y el saldo por cobrar de lo ya listo.

## Mostrador

### S3-11 · Venta rápida y ticket actual · M · 4 h
Como cajero
quiero elegir productos, ajustar cantidades y ver el ticket actual
para vender en segundos.
- **Requerimientos:** RF-M4-01, RF-UX-07 · **Reglas:** RN-02, RN-06 · **Notas:** PP-08 (catálogo rápido) no aprobada: se usa la búsqueda normal
- **Criterios de aceptación:**
  - Dadas piezas estándar, servicios y vidrio a medida, cuando se agregan, entonces se calculan con las reglas de precio del Sprint 1.
  - Dado el ticket actual, cuando se cambia una cantidad, entonces el total y el desglose se actualizan con `TaxCalculator`.
  - Dado un ticket vacío, cuando se muestra, entonces enseña qué hacer.

### S3-12 · Cobro: efectivo, transferencia y mixto · M · 4 h
Como cajero
quiero cobrar en efectivo con cambio, en transferencia con referencia, o mixto
para cerrar la venta.
- **Requerimientos:** RF-M4-02 · **Reglas:** RN-09, RN-10 · **Pendientes:** PD-43 (transferencias: referencia opcional, sin estado de confirmación)
- **Criterios de aceptación:**
  - Dado un efectivo recibido mayor al total, cuando se cobra, entonces calcula el cambio.
  - Dado un pago mixto, cuando se registra, entonces la suma de las formas de pago es igual al total.
  - Dada una venta, cuando se cobra, entonces se paga completa; no hay anticipo en mostrador.

### S3-13 · Atribución y folio de la venta · S · 2 h
Como administrador
quiero que cada venta y pago guarden usuario, dispositivo y hora
para saber quién cobró qué.
- **Requerimientos:** RF-M4-03 · **Reglas:** RN-11, RN-15
- **Criterios de aceptación:**
  - Dada una venta o un pago, cuando se guarda, entonces lleva el usuario activo, el dispositivo y la hora en UTC.
  - Dada la venta, cuando se emite, entonces lleva folio provisional y luego `V-AAAA-0001`.

### S3-14 · Cobrar anticipos y saldos desde el mostrador · S · 2 h
Como cajero
quiero cobrar el saldo de una orden desde el mostrador
para cobrar en la misma pantalla.
- **Requerimientos:** RF-M4-05 · **Reglas:** RN-11
- **Criterios de aceptación:**
  - Dada una orden con saldo, cuando se cobra desde el mostrador, entonces se usa el mismo caso de uso `RegisterPayment` y cuenta en la caja de quien lo recibió.

### S3-15 · Cancelar una venta · S · 2 h
Como administrador
quiero cancelar una venta con motivo
para corregir un error sin borrar nada.
- **Requerimientos:** RF-M4-07 · **Reglas:** RN-18, RN-19 · **Pendientes:** PD-24 (efecto en la caja: se registra la cancelación, sin regla automática)
- **Criterios de aceptación:**
  - Dado un administrador, cuando cancela con motivo, entonces la venta queda cancelada con bitácora.
  - Dado un cajero, cuando intenta cancelar, entonces se rechaza.

### S3-16 · Turno de caja: apertura y fondo inicial · M · 4 h  · ⛔ PD-36
Como cajero
quiero abrir mi turno con un fondo inicial opcional
para que mis cobros queden en mi caja.
- **Requerimientos:** RF-M4-06 (nivel 1) · **Reglas:** RN-11 · **Pendientes:** PD-36 (caja compartida y unidad del corte), PD-37 (salidas de efectivo)
- **Criterios de aceptación:**
  - Dado un cajero, cuando abre su turno con o sin fondo inicial, entonces queda registrado.
  - Dado un pago o venta, cuando se cobra, entonces se liga al turno abierto.
  - Dada la unidad del corte, cuando Luis responda PD-36, entonces se ajusta la historia antes de construirla.

### S3-17 · Corte de caja por cajero · L · 8 h  · ⛔ PD-36
Como cajero
quiero cerrar mi turno con el efectivo contado y ver la diferencia
para saber si cuadra.
- **Requerimientos:** RF-M4-06 (nivel 1) · **Reglas:** RN-11, RN-17, RN-18, RN-19 · **Pendientes:** PD-36, PD-44 (tolerancia de sobrante o faltante: solo se registra)
- **Criterios de aceptación:**
  - Dado un turno, cuando se cierra, entonces calcula cobros por método, efectivo esperado, contado y diferencia con `CashShiftSummary` (función pura).
  - Dado un corte cerrado, cuando se intenta editar, entonces se rechaza.
  - Dado un administrador, cuando reabre un corte, entonces queda motivo, usuario y hora en bitácora.
  - Dado un corte con datos armados a mano, cuando se calcula, entonces coincide al centavo.
  - Dado el resumen, cuando se imprime, entonces sale en ticket térmico.

### S3-18 · Corte consolidado del día · M · 4 h
Como administrador
quiero ver el corte del día completo por método y por cajero
para revisar la caja de ZAMMIR.
- **Requerimientos:** RF-M4-06 (nivel 2) · **Reglas:** RN-17 · **Pendientes:** PD-36
- **Criterios de aceptación:**
  - Dado un día en hora de México, cuando se calcula, entonces suma los turnos y pagos de ese día por método y por cajero.
  - Dado un cajero, cuando intenta verlo, entonces no tiene acceso.

### S3-19 · Cerrar el corte con operaciones sin enviar · S · 2 h
Como cajero
quiero que me avise si cierro con operaciones sin enviar
para no cerrar con cifras incompletas.
- **Requerimientos:** RF-M4-06 · **Decisión:** `SINCRONIZACION.md` §6.1
- **Criterios de aceptación:**
  - Dadas operaciones pendientes de enviar, cuando se cierra el corte, entonces avisa cuántas son.
  - Dado el corte recibido por el servidor, cuando su recálculo difiere, entonces queda "por revisar".

## Impresión

### S3-20 · Puerto `TicketPrinter`, plantillas y adaptador falso · L · 8 h
Como Juanito (desarrollador)
quiero el puerto de impresión con plantillas independientes de los adaptadores
para cambiar de método sin tocar la aplicación.
- **Decisión:** ADR-0018 · **Reglas:** `00-principios` §2 (L, D)
- **Criterios de aceptación:**
  - Dadas las plantillas de venta, cobro de orden y corte, cuando generan el contenido, entonces no dependen del adaptador.
  - Dado el adaptador falso, cuando corre la batería de contrato de `TicketPrinter`, entonces pasa.
  - Dado un tipo de ticket nuevo, cuando se agrega, entonces no se modifica el adaptador.

### S3-21 · Adaptador capa 1: Web Bluetooth y ESC/POS · L · 8 h  · `tablet` · ⛔ PD-15
Como cajero
quiero imprimir el ticket por Bluetooth desde la tablet
para entregarlo al cliente al cobrar.
- **Requerimientos:** RF-M4-04, RNF-26 · **Decisión:** ADR-0018, resultado del Sprint 0 · **Pendientes:** PD-15
- **Criterios de aceptación:**
  - Dados los parámetros validados en el Sprint 0, cuando se imprime, entonces salen acentos, ñ, logo y QR con corte automático.
  - Dada la impresora desconectada, cuando se vuelve a imprimir, entonces reconecta con un toque.
  - Dado el cobro, cuando se mide hasta el ticket, entonces tarda menos de 5 segundos.
  - *(manual)* Imprimir con la impresora real y con la tablet sin internet.

### S3-22 · Adaptadores capa 2 y capa 3 · M · 4 h  · `tablet`
Como cajero
quiero un respaldo si la impresora Bluetooth no funciona
para no quedarme sin ticket.
- **Decisión:** ADR-0018
- **Criterios de aceptación:**
  - Dada la capa 2, cuando se imprime, entonces el ticket de 80 mm se manda al servicio de impresión de Android.
  - Dada la capa 3, cuando no hay impresora, entonces el ticket se comparte como PDF o imagen por WhatsApp.
  - Dados los tres adaptadores, cuando corren en la tablet, entonces pasan la misma batería de contrato.

### S3-23 · Estado de la impresora, prueba y reimpresión · M · 4 h  · `tablet`
Como cajero
quiero ver si la impresora está conectada, hacer una prueba y reimprimir un ticket
para resolver fallas sin perder la venta.
- **Requerimientos:** RF-UX-06 · **Decisión:** ADR-0018
- **Criterios de aceptación:**
  - Dado el indicador, cuando cambia el estado, entonces dice "Impresora conectada" o "Desconectada".
  - Dado el botón de configuración, cuando se toca "Prueba de impresión", entonces imprime un ticket de prueba.
  - Dada una impresora apagada o sin papel, cuando se cobra, entonces la venta queda guardada y el ticket se puede reimprimir.

### S3-24 · Ticket de venta con QR y leyenda de autofacturación · M · 4 h  · `tablet`
Como cliente final
quiero un ticket con QR y código para pedir mi factura
para facturar sin ir con un contador.
- **Requerimientos:** RF-M4-04, RF-M10-09 (generación del código) · **Reglas:** RN-21, RN-22, RN-26 · **Pendientes:** PD-09 (leyenda del plazo configurable), PD-10
- **Criterios de aceptación:**
  - Dado el ticket, cuando se imprime, entonces trae nombre del negocio, folio, fecha, cajero, conceptos, total, forma de pago, QR, código de verificación y la leyenda del plazo desde la configuración.
  - Dado un documento sin enviar, cuando se imprime, entonces lleva folio provisional y código público.

## Clientes y aceptación

### S3-25 · Historial del cliente y cliente recurrente · M · 4 h
Como cajero
quiero ver todo lo que un cliente ha hecho con ZAMMIR
para atenderlo mejor.
- **Requerimientos:** RF-M5-02, RF-M5-03
- **Criterios de aceptación:**
  - Dado un cliente, cuando se abre su ficha, entonces lista cotizaciones, órdenes, ventas, pagos y garantías.
  - Dado un cliente con dos o más trabajos entregados, cuando se muestra, entonces aparece como recurrente (vista, no dato guardado).

### S3-26 · Aceptación E1: del cotizador a la garantía · L · 8 h  · `tablet`
Como Juanito (desarrollador)
quiero automatizar el recorrido completo de un trabajo
para probar el corazón del negocio de punta a punta.
- **Reglas:** E1 de `docs/calidad/PRUEBAS_DE_ACEPTACION.md`
- **Criterios de aceptación:**
  - Dado el recorrido, cuando se ejecuta (medir, cotizar, PDF, compartir, aceptar, crear la orden, anticipo, avanzar, entregar, saldo y comprobante), entonces todos los pasos pasan con totales exactos.
  - *(manual)* Repetir en la tablet real.

### S3-27 · Aceptación E2: mostrador y corte · M · 4 h  · `tablet`
- **Reglas:** E2 · **Pendientes:** PD-36
- **Criterios de aceptación:**
  - Dadas ventas en efectivo, transferencia y mixta, cuando se hace el corte por cajero y consolidado, entonces la diferencia queda calculada.
  - *(manual)* Ticket térmico con QR en la impresora real.

### S3-28 · Aceptación E3 (ventas) y E4 (cobros por PIN) · M · 4 h  · `tablet`
- **Reglas:** E3 (10 ventas en modo avión), E4 (cobros atribuidos), RNF-07
- **Criterios de aceptación:**
  - Dadas 10 ventas en modo avión, cuando se reconecta, entonces hay cero duplicados, folios correctos y totales exactos.
  - Dados tres usuarios cobrando, cuando se revisan los pagos, entonces cada uno está atribuido a quien lo hizo.

### S3-29 · Aceptación E10: 30 tickets y PDF legibles · S · 2 h  · `tablet`
- **Reglas:** E10 (ajustado por ADR-0005) · **Requerimientos:** RNF-26
- **Criterios de aceptación:**
  - *(manual)* Imprimir 30 tickets seguidos sin error.
  - *(manual)* Abrir la cotización y el comprobante en otro teléfono: se leen bien y el QR se escanea.

### S3-30 · Cierre del Sprint 3 · S · 2 h  · `tablet`
- **Reglas:** `00-principios` §5.2 · **Plan:** compuerta de salida de la fase 7
- **Criterios de aceptación:**
  - Dada la compuerta común, cuando se corre, entonces está en verde.
  - Dado el cálculo del corte, cuando se mide, entonces tiene cobertura y mutación según umbral.
  - Dados los pagos, cuando se revisa su estructura, entonces solo se agregan.
  - *(manual)* Lista de tablet firmada: E1 a E4 y E10 en el equipo real.
  - Dada la revisión, cuando termina, entonces la retrospectiva y la recalibración quedan registradas.
