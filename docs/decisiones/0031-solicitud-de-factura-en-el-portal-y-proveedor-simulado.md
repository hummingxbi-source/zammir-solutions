# ADR-0031: Solicitud de factura en el portal, archivos guardados y proveedor simulado explícito

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-04
- **Decide:** Juanito (se propone en S4-19; confirmar al revisar el Sprint 4)

## Contexto

- El portal `/factura` ya muestra conceptos y total solo a quien tiene el folio y el código (ADR-0030). S4-19 agrega pedir la factura con los datos fiscales y descargarla [RF-M10-13, RF-M10-14].
- El PAC real aún no está elegido (PD-05) y su adaptador es S4-15; hoy solo existe el adaptador simulado, que **no tiene validez fiscal** (ADR-0007).
- La forma de pago de una factura con pago mixto la define el contador (PD-28). El correo con la factura espera su decisión (PD-50).
- Cada concepto del CFDI debe cuadrar (cantidad × valor unitario = importe) y el SAT admite hasta 6 decimales en el valor unitario.

## Decisión

1. **Dos funciones públicas más, sobre la misma puerta:** `solicitar-factura` y `descargar-factura` pasan por `accessPortalDocument` (formato, límites de intentos, automatización y respuesta uniforme), igual que `consultar-factura`. Pedir la factura exige además la casilla del aviso de privacidad (que menciona la transferencia al PAC, RF-M9-05), valida formatos y catálogos del SAT **antes** de gastar un timbre y se decide siempre en el servidor [RNF-11].
2. **Una solicitud, un timbre:** el navegador genera un identificador al abrir la página y lo reenvía en cada intento. Reenviar el mismo formulario tras un éxito (doble toque, red caída al responder) devuelve la misma factura; otra solicitud sobre una operación ya facturada se rechaza [RN-24].
3. **La factura es un registro fiscal y se conserva:** se guarda el timbre, el XML, el PDF, los datos del receptor, la forma de pago y la versión del aviso de privacidad vigente al pedirla. El folio `F-AAAA-0001` (año de México) lo asigna la base al guardar el timbre, sin huecos y de forma idempotente. Una solicitud fallida se registra y libera la operación; nada se borra [RN-18].
4. **Proveedor simulado solo si se pide explícitamente:** las funciones solo emiten si `BILLING_PROVIDER=simulated`; sin esa variable responden `BILLING_NOT_CONFIGURED`. Así una factura sin validez fiscal nunca sale por omisión en producción. Las pruebas de integración encienden las funciones con `supabase/functions/pruebas.env`.
5. **Pago mixto no se factura solo:** efectivo es `01` y transferencia `03` [RN-28]; con pagos mixtos o sin pagos el portal manda a pedir la factura en el negocio hasta que el contador responda PD-28.
6. **Nunca se inventan claves del SAT:** si a una línea le falta clave de producto o servicio, unidad u objeto de impuesto (del producto o de su categoría), no se factura y se manda a pedirla en el negocio (PD-29).
7. **Valor unitario en millonésimas de peso** (`unitValueMicros`) para que cada concepto cuadre con el SAT sin perder centavos.
8. **Datos del receptor:** el RFC se normaliza (mayúsculas, sin espacios); el nombre se respeta tal como lo escribe la persona, que debe copiarlo de su constancia. La compatibilidad entre el régimen y el uso la revisa el PAC al timbrar y su rechazo se traduce a un mensaje que manda a revisar los datos.
9. **El correo no se captura todavía:** hasta decidir cómo se envía (PD-50) no se pide el correo, para no guardar un dato personal que no se usa. El resultado ofrece descargar PDF y XML.

## Consecuencias

- Cuando se conecte el PAC real (S4-15) solo cambia el proveedor que construye `proveedorDeTimbrado`; el flujo, la base y la pantalla no se tocan.
- Hasta entonces, ninguna factura del portal tiene validez fiscal y el entorno de producción no debe tener `BILLING_PROVIDER=simulated`.
- Se guarda más información fiscal en la base (RFC y nombre del receptor): entra en las obligaciones del aviso de privacidad y de los respaldos (S4-27).
- Con Turnstile configurado, cada llamada pide un token nuevo (es de un solo uso): quien descarga el PDF y el XML resuelve la verificación otra vez.
