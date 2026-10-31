# ADR-0027: Turno de caja por persona e impresión de tickets por medios intercambiables

- **Estado:** Aceptada (propuesta por el desarrollador; Juanito puede cambiarla)
- **Fecha:** 2026-10-31
- **Decide:** Juanito (propuesta del desarrollador)
- **Concreta:** [ADR-0016], [ADR-0026], [RN-11], [RN-17], [RN-18], PD-15, PD-24, PD-36, PD-37, PD-44

## Contexto

Cada cobro debe poder atribuirse a una persona y a su caja [RN-11], y el corte debe cuadrar aunque las tablets estén sin internet. Las preguntas a Luis sobre cómo quieren la caja (PD-36) no tienen respuesta todavía, y la impresora de tickets (PD-15) ni siquiera ha llegado.

## Decisión

### Turno de caja

1. **Un turno por persona.** Abrir un turno (con fondo opcional), cobrar y cerrarlo con el efectivo contado. Una persona solo puede tener uno abierto. Con turno el cobro exige turno abierto; el pago y la venta guardan `cashShiftId`.
2. **El día de un turno es el día de su apertura, en hora de México** [RN-17]. El corte del día suma los turnos de ese día, por método de pago y por persona.
3. **Efectivo esperado = fondo + efectivo cobrado** (sin retiros: PD-37). La transferencia no entra al cajón. Una venta cancelada sale del cobro del turno y se muestra aparte (PD-24 sin respuesta).
4. **El servidor recalcula el efectivo esperado** al recibir `CloseCashShift`; si difiere del que calculó la tablet, el cierre se aplica y queda por revisar (`CASH_SUMMARY_MISMATCH`). Lo que ya ocurrió físicamente nunca se rechaza.
5. **Un corte cerrado no se edita.** Solo un administrador (o quien tenga su PIN) lo reabre, con motivo; cada reapertura queda en una tabla que solo recibe altas.
6. **Cerrar con operaciones sin enviar** avisa cuántas son, pero no lo impide: el servidor vuelve a calcular cuando lleguen.

### Impresión

7. **Puerto `TicketPrinter`** con tres medios que intentan en orden: Bluetooth (Web Bluetooth), impresión de Android y compartir el ticket como archivo. Si uno falla, sigue el siguiente; cancelar no insiste. La venta ya está guardada: un ticket que no sale se reimprime.
8. **El ticket es un documento de bloques** (`PrintDocument`) que se convierte a ESC/POS (página 858, QR nativo) o a texto plano. Las plantillas (venta, cobro de orden, corte, página de prueba) se comparan contra una versión aprobada y el codificador se prueba byte a byte.
9. **Ancho de papel y parámetros Bluetooth configurables** mientras no se defina la impresora (PD-15): 32 caracteres por omisión y los identificadores de servicio más comunes.
10. **El QR del ticket lleva solo el folio y el código público**, y la leyenda de autofacturación viene de la configuración (PD-09, PD-10).

### Historial del cliente

11. **Cliente recurrente = dos o más órdenes entregadas.** Las canceladas y las cotizaciones no cuentan. El mínimo es una constante en un solo lugar y va en el cuestionario a Luis.

## Consecuencias

- Si Luis prefiere una sola caja para todos, cambia la asignación del turno, no el cálculo del corte.
- Con la tablet de pruebas falta comprobar Bluetooth, la impresión de Android, el ancho de papel y los acentos en papel real.
- El cobro de órdenes desde la pantalla de Órdenes también exige turno abierto; el aviso manda a abrirlo en el Mostrador.
