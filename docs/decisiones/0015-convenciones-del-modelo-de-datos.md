# ADR-0015: Convenciones del modelo de datos

- **Estado:** Propuesta — Juanito la aprueba con la arquitectura
- **Fecha:** 2026-10-26
- **Decide:** Juanito
- **Detalle en:** `docs/arquitectura/MODELO_DE_DATOS.md`

## Decisión

1. **Identificadores:** UUID generado en el dispositivo para toda entidad creada en la tablet [ADR-0012].
2. **Dinero:** columnas `bigint` en centavos con sufijo `_cents`. Prohibido `numeric` con decimales o flotantes [RN-05].
3. **Tasas y porcentajes:** enteros en puntos base (`1600` = 16%, `5000` = 50%), nunca decimales. La fórmula de desglose es `base = redondear(total × 10 000 / (10 000 + tasa_bps))` [ADR-0011].
4. **Fechas:** `timestamptz` en UTC; las fechas de calendario (vigencia, entrega estimada) son `date` calculadas en hora de México [RN-17].
5. **Nombres:** tablas y columnas en inglés, `snake_case`, según el glosario [ADR-0009].
6. **Lo contable se agrega:** ventas, órdenes, pagos, cotizaciones emitidas, cortes y facturas no tienen permiso de borrado; sus columnas inmutables se protegen con disparadores; las cancelaciones llevan motivo, usuario, dispositivo y hora [RN-18].
7. **Valores derivados no se guardan** si se pueden calcular sin ambigüedad: saldo de una orden, cotización vencida, cliente recurrente. Se exponen con vistas. Lo que se guarda se congela al momento del hecho (totales de un documento, anticipo exigido) [RN-03].
8. **Instantáneas:** líneas de documentos guardan una copia de nombre, unidad, precio, regla de precio y datos fiscales del producto al emitirse [RN-03].
9. **Configuración en tabla**, con valores validados por esquema en `packages/core`; ningún porcentaje ni plazo es literal en el código [principios §3.3].
10. **Auditoría:** `audit_log` registra usuario, dispositivo, fecha, valor anterior y nuevo [RN-19].

## Consecuencias
- Las vistas de saldo y antigüedad dependen de que los pagos sean la única fuente del saldo.
- Una columna decimal, un flotante o un `DELETE` sobre tablas contables fallan en revisión y en pruebas de base de datos.
