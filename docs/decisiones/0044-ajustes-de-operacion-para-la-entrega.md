# ADR-0044: Ajustes de operación para la entrega

- **Estado:** Aceptada
- **Fecha:** 2026-11-24
- **Decide:** Juanito (HummingX BI)
- **Resuelve:** PD-08, PD-24, PD-33, PD-41, PD-43, PD-44, PD-46 y PD-49; da el mecanismo de PD-02
- **Deja como observación:** PD-07
- **Modifica:** [ADR-0026] punto 4 y [ADR-0027] punto 3 (la cancelación de una venta ya toca la caja, con una devolución)
- **Plan:** [`docs/plan/fase-10-ajustes-para-la-entrega.md`](../plan/fase-10-ajustes-para-la-entrega.md)

## Contexto

Al preparar las preguntas finales para Luis, Juanito revisó cuáles le tocan al cliente y cuáles son decisiones de operación que HummingX puede tomar. Al revisar el código para responderlas salieron además estos huecos:

- Cancelar una venta de un turno ya cerrado descuadra la caja sin dejar rastro.
- Los días de una cuenta por cobrar se cuentan desde que se crea la orden.
- Ninguna orden se marca como atrasada.
- Las categorías del catálogo son fijas.
- Los cantos, perforaciones y biselados no se pueden ligar a una pieza de vidrio.

## Decisión

1. **Reportes (PD-08).** "Ventas" se queda como está: ventas de mostrador más pagos recibidos de órdenes en el periodo (base de efectivo recibido [RN-20]).
2. **Cancelar una venta de mostrador (PD-24).**
   - Al cliente se le devuelve el dinero **por el mismo medio** con que pagó.
   - La devolución se registra en el turno abierto de quien cancela.
   - El cobro original se queda en el turno donde se cobró, así que un corte cerrado ya no cambia después.
   - Se sigue necesitando administrador (o su PIN) y motivo.
3. **Cuentas atrasadas (PD-33).**
   - El saldo se vuelve exigible al entregar, y los días se cuentan **desde la entrega**.
   - Una cuenta está atrasada **desde el día siguiente a la entrega** sin pagarse: umbral por omisión de 1 día, configurable.
   - Lo que todavía no se entrega aparece como "Por entregar".
   - La fecha de entrega es la de la tablet, no la del momento en que se envió.
4. **Fecha de entrega (PD-41).**
   - Se elige con un calendario al crear la orden y es obligatoria.
   - Se puede cambiar, con rastro, mientras la orden no esté entregada ni cancelada.
   - La orden está **atrasada** si hoy es posterior a esa fecha y no se ha entregado.
5. **Transferencias (PD-43).** Un administrador marca **"Ya llegó"** después de revisar su banco; queda quién y cuándo. Mientras no se marque, se ve "Por confirmar". No cambia los totales.
6. **Diferencia en el corte (PD-44).** Cualquier diferencia entre el efectivo contado y el esperado, **desde un centavo**, exige una explicación escrita para cerrar el turno. Se conserva el conteo a ciegas.
7. **Entregas por partes (PD-46).**
   - **Una orden por cada parte**, marcada "por partes" y ligada a las demás partes del mismo trabajo.
   - Se arma al convertir la cotización, eligiendo las líneas de cada parte.
8. **Categorías (PD-49).** El administrador agrega, renombra, ordena y desactiva categorías. No se borran. No se desactivan si tienen productos activos.
9. **Cargos extra (mecanismo de PD-02 y RN-02).**
   - Los cantos, perforaciones, biselados y similares son productos de tipo **"Cargo extra"**, en m² por omisión.
   - Se agregan a una línea de vidrio y se cobran con la medida de esa línea.
   - Su importe se suma al de la línea antes de separar el IVA.
   - Los precios los captura Luis en el catálogo.
10. **Catálogo sin límite.** Las listas del administrador se leen por páginas para que nunca se corten en silencio a las 1000 filas.
11. **Anticipo al cancelar una orden (PD-07).** Lo define HummingX y se le comunica a Luis **el día de la entrega**. Hasta entonces el sistema sigue igual: anota el anticipo y no lo devuelve solo.

## Por qué

- Son reglas de operación diarias (caja, cobranza, órdenes) que Juanito puede fijar con buen criterio, y preguntarlas retrasaría la entrega.
- Las que solo Luis sabe siguen en el cuestionario: precios, garantía, IVA de sus productos, impresora, fechas.
- Ninguna supone un valor de negocio que Luis no haya dicho. El umbral de 1 día y las unidades de los cargos extra quedan configurables [CLAUDE.md regla 1].

## Consecuencias

- Nueve historias (AJ-01 a AJ-09) con unas 55 horas de trabajo, en el orden y con el diseño del plan de la fase 10. Si el tiempo no alcanza, Juanito recorta desde el final; AJ-09 es el primer candidato a pasar después de la entrega.
- Requerimientos nuevos en `REQUERIMIENTOS.md`: RF-M1-08, RF-M1-09, RF-M3-09, RF-M3-10, RF-M4-09, RF-M4-10 y RF-M4-11. RF-M6-01 cuenta los días desde la entrega.
- Las preguntas a Luis bajan a diez: nombres, correos, catálogo, precio de los cargos extra, IVA, garantía, aviso de privacidad, impresora, wifi y fechas.
