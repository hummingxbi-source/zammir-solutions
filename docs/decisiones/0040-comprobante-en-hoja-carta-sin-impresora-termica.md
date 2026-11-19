# ADR-0040: Comprobante en hoja tamaño carta; sin impresora térmica

- **Estado:** Aceptada
- **Fecha:** 2026-11-19
- **Decide:** Luis (dueño de ZAMMIR), comunicado por Juanito
- **Sustituye a:** [ADR-0005] (sin impresión carta) y [ADR-0018] (impresión de tickets en tres capas)
- **Modifica:** [ADR-0008] (se cancela la prueba de concepto de la impresora térmica)
- **Relacionada:** [ADR-0039]

## Contexto

El plan incluía una impresora térmica de 80 mm con Bluetooth, con el riesgo técnico de que el navegador no pudiera hablar con ella [R1]. Luis no quiere tickets pequeños, como los de supermercado: quiere una hoja tamaño carta con el logo y el detalle de la compra. También prevé una impresora de red o Wi-Fi. Juanito propone, y Luis acepta, que el comprobante se envíe por WhatsApp, como hacen la mayoría de las tiendas, con la posibilidad de imprimirlo en cualquier venta.

## Decisión

1. **Se elimina la impresora térmica de 80 mm** del alcance: el ticket térmico, la conexión Bluetooth (Web Bluetooth y ESC/POS), el estado "impresora conectada" y la compra del modelo candidato (PD-15).
2. **El comprobante es una hoja tamaño carta** con el logo de ZAMMIR, folio, fecha, cajero, cliente cuando lo hay, el detalle de lo comprado, total, forma de pago y los términos que ya existen. Se ajusta a A4 sin recortarse.
3. **El mismo formato** se usa para cotizaciones, órdenes de trabajo (anticipo y saldo) y ventas de mostrador (piezas pequeñas con precio definido, como herrajes). El comprobante de corte de caja también va en carta.
4. **La acción principal es "Enviar por WhatsApp"** (menú de compartir del dispositivo y, de respaldo, enlace de WhatsApp con mensaje prellenado) y junto a ella, siempre visible, **"Imprimir"**. Imprimir es opcional en cada venta; no sale solo.
5. **Imprimir usa el servicio de impresión de Android** (diálogo de impresión del navegador) hacia una impresora de red o Wi-Fi. Si no hay impresora, se guarda el PDF o se comparte por WhatsApp.
6. **No se menciona la factura** en el comprobante mientras `FACTURACION` esté apagado [ADR-0039].
7. **El código de la impresora térmica se retira** en lugar de dejarlo apagado: nunca se probó con un equipo real y el historial de git lo conserva si Luis cambia de opinión.

## Consecuencias

- Cambian RF-M2-06, RF-M3-06, RF-M4-04, RF-M4-06 y RF-UX-06; ver `REQUERIMIENTOS.md`.
- Desaparece el riesgo R1; quedan PD-15, PR-11, PP-14, PP-24 y PP-27 resueltos o reformulados.
- El equipo a comprar es solo tablets. La impresora de Luis la define él; hay que **probar con su impresora real** que Android la encuentre y que la hoja salga bien (carta, márgenes, logo).
- Hay que pedir a Luis el **logo original** en buena resolución; ahora es un elemento de cada comprobante.
- La prueba de tablet con impresora se reduce a imprimir el comprobante en una hoja carta real.
- La tablet de campo no tendrá impresión directa si no hay impresora cerca: el WhatsApp es el camino normal.
- Una reimpresión debe quedar marcada como copia y con rastro (PP-14 sigue por aprobar).
