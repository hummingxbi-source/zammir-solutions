# ADR-0026: Ventas de mostrador en una sola operación

- **Estado:** Aceptada (propuesta por el desarrollador; Juanito puede cambiarla)
- **Fecha:** 2026-10-31
- **Decide:** Juanito (propuesta del desarrollador)
- **Concreta:** [ADR-0016], [ADR-0025], [RN-09], [RN-10], [RN-11], [RN-18], [RN-19], PD-24

## Contexto

La venta de mostrador se cobra al momento y completa: no hay anticipo ni saldo [RF-M4-02]. Cada venta y cada pago deben guardar quién cobró, desde qué tablet y cuándo [RN-11], y todo debe funcionar sin internet.

## Decisión

1. **Una sola operación `CreateCounterSale`** lleva la venta (líneas y totales calculados por el dominio) y su cobro completo (una fila por forma de pago, del mismo grupo). El servidor guarda la venta y sus pagos en la misma transacción y le da el folio `V-AAAA-NNNN` como último paso. No hay una venta "sin cobrar" en el servidor.
2. **El dinero recibido nunca se rechaza:** si el cobro no suma el total, la venta se guarda con sus pagos y queda "por revisar" (`PAYMENT_NOT_EQUAL_TOTAL`). Una carga mal formada (por ejemplo, efectivo recibido menor a lo aplicado) sí se rechaza y no guarda nada.
3. **El ticket actual es un valor puro** (`Ticket`): cada cambio devuelve un ticket nuevo con importes recalculados por las reglas de precio y el IVA del dominio. El mismo producto con las mismas medidas y precio suma cantidad en lugar de repetirse.
4. **Cancelar (`CancelCounterSale`)** es de un administrador (o de un cajero con el PIN de uno), con motivo y bitácora. La venta cancelada y sus pagos se conservan. **PD-24 sin respuesta:** la cancelación se registra y no toca la caja; las ventas canceladas salen de las "activas" y queda a la vista cuáles fueron.
5. **El saldo de una orden se cobra desde el mostrador con el mismo `registerWorkOrderPayment`** del detalle de la orden: el pago cuenta para quien lo recibió.
6. **Réplica:** las ventas bajan a las demás tablets por número de cambio (`counter_sales_for_device`, sin datos fiscales) para que un administrador cancele desde cualquier tablet.

## Consecuencias

- `cash_shift_id` de los pagos y las ventas sigue vacío hasta S3-16 (turno de caja); desde entonces todo cobro exigirá turno abierto.
- El ticket impreso y su QR (S3-20, S3-24) leen el modelo de la venta ya guardada.
- La venta sin cliente es válida; el cliente es opcional en el mostrador (la captura de cliente en pantalla queda como mejora).
