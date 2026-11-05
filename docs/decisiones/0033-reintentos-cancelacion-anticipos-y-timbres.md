# ADR-0033: Reintentos con la solicitud guardada, cancelación solo de administradores, anticipos en la opción (a) y timbres con límite configurable

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-05
- **Decide:** Juanito (se propone en S4-20 a S4-22; confirmar al revisar el Sprint 4)

## Contexto

- Si el proveedor de timbrado no contesta, la factura queda "en proceso" y debe poder terminarse sin timbrar dos veces [RN-24, RF-M10-15].
- Una factura mal emitida no se corrige: se cancela con un motivo del SAT y se vuelve a emitir [RF-M10-19, RN-28]. Nada contable se borra [RN-18, RN-19].
- Los anticipos tienen dos tratamientos posibles; cuál se usa lo define el contador [RN-27, PD-12].
- El paquete de timbres tiene un límite que todavía no se conoce [PD-26].

## Decisión

1. **La solicitud se guarda completa** (`request_snapshot`) al empezar. Reintentar usa ese mismo contenido y el mismo `requestId`, así que el proveedor nunca recibe dos solicitudes distintas por la misma operación. Se cuentan los intentos y se guarda el último error (`attempts`, `last_error`).
2. **Reintentos automáticos y manuales.** La función `reintentar-facturas` recorre las solicitudes en proceso (espera mínima `INVOICE_RETRY_WAIT_SECONDS`, tope `INVOICE_RETRY_MAX_ATTEMPTS`, 50 por pasada). Con la llave de servicio hace la pasada automática; con la sesión de un administrador y un `requestId`, reintenta esa. **Programar la pasada automática (cron del proveedor o externo) queda para S4-26**; mientras tanto el administrador reintenta a mano.
3. **Cancelar es solo de administradores** (`cancelar-factura`, verificado en el servidor). Motivos del SAT 01 a 04; el 01 exige el folio de otra factura vigente que la sustituye. Si el receptor debe aceptarla, queda "cancelación solicitada" y sigue vigente hasta entonces. Cada cancelación deja una entrada en la bitácora con motivo y quién la hizo; la fila nunca se borra, y al cancelarse libera la operación para facturarla de nuevo.
4. **Anticipos: solo la opción (a).** Es la única construida. Con la (b) configurada, una orden de trabajo no se factura y el sistema lo dice (`DEPOSIT_TREATMENT_UNSUPPORTED`); no se supone ninguna regla [RN-27, PD-12].
5. **Timbres:** se cuentan los timbrados (vigentes y cancelados) del año en hora de México contra el ajuste `stamps_yearly_limit`. Sin límite configurado no hay aviso ni se inventa uno; con límite, aviso al `warning_percent` (80 % por omisión) y otro al agotarse [PD-26, RF-M10-20].
6. **Historial del cliente:** la ficha del cliente muestra sus facturas (vigentes y canceladas) [RF-M10-21].

## Consecuencias

- Hasta S4-26 las pasadas automáticas no corren solas.
- Las facturas siguen siendo de prueba hasta conectar el PAC real (S4-15) [ADR-0031].
- Si el contador elige la opción (b) de anticipos, hay que construirla antes de facturar órdenes con anticipo.
