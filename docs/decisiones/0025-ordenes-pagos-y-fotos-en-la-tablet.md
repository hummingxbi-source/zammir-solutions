# ADR-0025: Órdenes de trabajo, pagos que solo se agregan y fotos de medición

- **Estado:** Aceptada (propuesta por el desarrollador; Juanito puede cambiarla)
- **Fecha:** 2026-10-31
- **Decide:** Juanito (propuesta del desarrollador)
- **Concreta:** [ADR-0011], [ADR-0012], [ADR-0016], [ADR-0023], [ADR-0024], [RN-08], [RN-09], [RN-10], [RN-11], [RN-14], [RN-18], [RN-19], PD-06, PD-07, PD-39

## Contexto

El Sprint 3 agrega las órdenes de trabajo (anticipo, avance, entrega, garantía, cancelación) y el dinero que entra por ellas. Una orden se trabaja en varias tablets (se crea en una y se cobra el saldo en otra) y debe funcionar sin internet, así que entra por la misma cola de operaciones que las cotizaciones.

## Decisión

1. **Una operación por acción**, con el documento completo en la creación: `CreateWorkOrder`, `UpdateWorkOrder` (parche por campo; gana el último que llega, el anterior queda en la bitácora), `AdvanceWorkOrder`, `DeliverWorkOrder`, `CancelWorkOrder` y `RegisterPayment`. El servidor valida todas las cargas con el mismo código que la tablet; una carga inválida es un rechazo estructural (200 con `ok:false`), **nunca** una falla del servidor que se reintente para siempre (se corrigió que la función de borde solo validaba `IssueQuote`).
2. **Lo que ya ocurrió físicamente nunca se rechaza por dinero ni por permiso: se aplica y queda "por revisar" con su motivo.** Pago mayor al saldo, cobro a una orden cancelada, entregar con saldo sin administrador y motivo, cancelar sin administrador, empezar sin anticipo ni autorización (PD-39), cotización no aceptada o ya convertida. La excepción es la carga mal formada.
3. **Los pagos solo se agregan.** Tabla `payments` con disparador que impide modificar o borrar (también al dueño de la base), `amount_cents` es lo **aplicado** (el cambio no cuenta), un cobro mixto son varias filas del mismo grupo y el **saldo siempre se calcula** (total − pagos). Un efectivo recibido menor a lo aplicado no cabe en la tabla.
4. **Anticipo exigido** = porcentaje configurado del total, **redondeado hacia arriba** ([ADR-0011]); se guarda en la orden. **PD-39:** pasar a "en proceso" sin anticipo registrado exige un administrador (él mismo, o el PIN de uno); el ajuste `require_deposit_to_start` (valor de trabajo `true`) lo hace configurable.
5. **Garantía al entregar** (`warranties`), con duración, cobertura y exclusiones **vacías hasta que se definan** (PD-06); la duración solo sale de `warranty_months_default` cuando existe. El comprobante escribe únicamente lo que tiene valor.
6. **Réplica de órdenes y pagos** por número de cambio ([ADR-0022], [ADR-0024]) con las vistas `work_orders_for_device` y `payments_for_device` (sin datos fiscales). Una orden con un cambio por enviar no se sobrescribe; un pago ya guardado no se toca. Así el saldo se cobra desde otra tablet. `reconcileOrders` pone el folio `OT-AAAA-NNNN` y "Enviado" en la tablet.
7. **Comprobante de trabajo** = el modelo de documento de la cotización más un bloque `receipt` (pagos, saldo, garantía, QR). El QR se dibuja como cuadros vectoriales con la librería `qrcode` (solo para calcular la matriz) y su contenido se comprueba en pruebas con `jsqr` (solo pruebas). El enlace es `<dirección base>/f/<folio>/<código>`; el código es el `public_code` aleatorio de la orden. Sin dirección configurada (PD-10) se usa un dominio de prueba que no existe.
8. **Fotos de la medición:** se reducen en la tablet (lado mayor 1600 px, JPEG calidad 0.7, máximo 800 KB y 10 por orden — límites propuestos), se guardan en IndexedDB y **se suben aparte de la cola** a un bucket privado `order-photos` (ruta `<orden>/<foto>.jpg`), de modo que una foto lenta nunca bloquea una orden. Repetir una subida no duplica. No hay tabla de fotos todavía.

## Consecuencias

- **Pendiente:** `cash_shift_id` de los pagos queda vacío hasta S3-16 (turno de caja); desde entonces todo cobro exigirá turno abierto. Las ventas de mostrador (`counter_sale`) están reservadas en la tabla de pagos y rechazadas en el receptor hasta S3-11.
- **Pendiente:** capturar una orden manual desde la pantalla (hoy existe el caso de uso `createManualWorkOrder`, no la pantalla); lista de "por revisar" para administradores (PP-22); la compresión con el lienzo del navegador solo se puede comprobar en la tablet.
- Las dos tablets pueden contarle al servidor dos cosas distintas del mismo cobro solo si el mismo `opId` cambia, lo que la idempotencia impide.
