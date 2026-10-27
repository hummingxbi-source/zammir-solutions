# ADR-0005: Impresión tamaño carta fuera del alcance

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

El cotizador pedía imprimir en impresora tamaño carta [DC RF-M2-06]. ZAMMIR no tiene impresora [DC §2] y el equipo acordado es de dos tablets y una impresora térmica.

## Decisión

- No se imprime en tamaño carta desde el sistema.
- Cotizaciones y comprobantes de trabajo siguen generándose como PDF tamaño carta y se comparten por WhatsApp o se descargan.
- Lo único que se imprime es el ticket térmico de 80 mm (ventas, cobros y corte de caja).

## Consecuencias

- Se cambian RF-M2-06 y RF-M3-06 en `REQUERIMIENTOS.md`.
- Desaparece una ruta de impresión que habría que probar en cada dispositivo.
- Si el cliente quiere imprimir un PDF, lo hace desde el visor de su dispositivo, fuera del sistema.
