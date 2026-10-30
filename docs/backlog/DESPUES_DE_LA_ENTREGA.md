# Después de la entrega

> Lo que **no** entra a los sprints S0 a S5 [ADR-0019]. No se estima aquí con detalle: cuando alguna pieza se active, se convierte en historias con criterios y se asigna a un sprint, moviendo otra para que quepa.

## Fuera de la entrega por decisión de Juanito [ADR-0019]

| Pieza | Requerimientos | Estado | Para activarla |
|---|---|---|---|
| **P1** — Portal de seguimiento para el cliente final: aceptar la cotización en línea y ver la línea de tiempo | RF-M2-11 | Apagado por interruptor (PD-13) | Que Luis lo active **y** Juanito apruebe el diseño del portal (la demo no lo tiene aprobado) |
| **P2** — Existencias de piezas estándar con alerta de mínimo | RF-M1-07 | Apagado por interruptor (PD-14) | Que Luis lo active |
| **Recorrido guiado con globos de ayuda** | RF-UX-04 | Fuera de la entrega | Decisión de Juanito. "Primeros pasos" y el botón "¿Por dónde empiezo?" sí van (S4-23) |

## Propuestas sin aprobar (`PENDIENTES.md`)

Ninguna entra a un sprint mientras Juanito no la apruebe. Con la capacidad actual (`CAPACIDAD.md`), aprobar cualquiera obliga a mover otra cosa.

| ID | Propuesta | Sprint sugerido si se aprueba |
|---|---|---|
| PP-04 | Campo "descripción" en el producto | 1 |
| PP-05 | Código del producto generado por el sistema | 1 |
| PP-06 | Gráfica de distribución del catálogo | Después |
| PP-07 | Lista de "Atención" (atrasadas, detenidas, cuentas viejas) | 4 |
| PP-08 | Marca de "venta rápida" por producto | 3 |
| PP-09 | Retiros y gastos de caja (depende de PD-37) | 3 |
| PP-10 | Marca "detenida" con motivo en una orden | 3 |
| PP-11 | Aviso de "trabajo listo" por WhatsApp | 3 |
| PP-12 | Reposición con causa (depende de PD-40) | Después |
| PP-13 | Comparar periodos equivalentes en reportes | 4 (afecta S4-05) |
| PP-14 | Reimpresión marcada "COPIA" | 3 |
| PP-15 | Convertir solo algunas líneas de una cotización en orden | Después |
| PP-16 | Fecha estimada sugerida por producto (depende de PD-41) | Después |
| PP-17 | Valor contratado junto a lo cobrado | 4 |
| PP-18 | Metros cuadrados vendidos en productos más vendidos | 4 |
| PP-19 | Seguimiento de cotizaciones por vencer y tasa de aceptación | 4 o después |

PP-01 a PP-03 ya están incorporadas en RF-UX y PD-31.

## Candidatas a salir de los sprints si no cabe la carga

Detalle en `CAPACIDAD.md`. Las que el plan ya marcaba como movibles:

| Historia | Por qué se puede mover |
|---|---|
| S3-03 Fotos opcionales de la medición | Opcional [RF-M3-01]; la fase 7 propone moverla antes que cortes, pagos o impresión |
| S2-15, S2-16 Duplicar cotizaciones e historial por cliente | La fase 6 los marca como comodidades a recortar primero |
| S4-24 Panel de inicio con contenido por rol | Depende de PD-31 sin definir |
