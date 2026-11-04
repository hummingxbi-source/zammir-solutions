# ADR-0030: Portal de autofacturación sin sesión, con respuesta uniforme y límites de intentos

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-04
- **Decide:** Juanito (se propone en S4-18; confirmar al revisar el Sprint 4)

## Contexto

- El cliente final abre el portal con el QR de su ticket, en su teléfono, sin cuenta ni sesión [RF-M10-09].
- Antes de mostrar nada hay que comprobar, **en el servidor**, que el folio existe, el código coincide, la operación está liquidada, no está facturada y está en plazo [RF-M10-10, RN-24 a RN-26, RNF-11].
- Nunca se debe revelar si un folio existe cuando falla el código, y hay que limitar intentos por IP y por folio y frenar a los programas [RF-M10-11, RNF-12].
- La base solo debe tocarse con funciones del servidor, nunca con tablas directas [S4-18].
- El QR ya imprime `…/f/{folio}/{código}` (RN-26, S3-04); el folio puede ser el provisional de una tablet si el documento aún no llega al servidor.

## Decisión

1. **Una sola puerta:** la función de servidor `consultar-factura` (pública, sin JWT). El navegador nunca lee tablas ni llama a las funciones `portal_*`: están revocadas para anónimos y tablets y solo las ejecuta el rol de servicio.
2. **La lógica vive en el núcleo** (`lookupInvoiceDocument`) con puertos, para probarla a fondo sin Deno. La función de Deno solo conecta la base, el servicio contra automatización y HTTP.
3. **Respuesta uniforme:** código incorrecto, folio inexistente, formato inválido y tráfico automatizado responden exactamente lo mismo (`404 NOT_AVAILABLE`). Solo cuando el código **sí** cuadra se dice por qué no se puede facturar (`409`: cancelada, ya facturada, con saldo o fuera de plazo), porque quien llama tiene el ticket. El mensaje de "no encontrado" incluye que un documento hecho sin internet puede tardar en aparecer, así cubre RF-M10-17 sin revelar nada.
4. **Límites:** se cuentan los intentos **fallidos** de los últimos 15 minutos por huella de IP (tope 15) y por huella de folio escrito (tope 5), aunque el folio no exista. Al llegar al tope responde `429` con `Retry-After`. Los valores son de seguridad, no del negocio, y se pueden cambiar con variables de entorno.
5. **Sin datos personales de más:** de la IP y del folio solo se guarda una huella (SHA-256 con pimienta del servidor); los intentos se borran solos al día.
6. **Verificación ligera contra automatización** en dos capas: campo trampa y tiempo mínimo de llenado (siempre), y Cloudflare Turnstile (Cloudflare ya es proveedor declarado, RNF-17) cuando hay llaves configuradas. Si el servicio no responde, no se deja pasar.
7. **"No facturada" y una factura por operación [RN-24]:** tabla `invoice_requests` con un índice único parcial por venta y por orden entre las solicitudes vigentes o en proceso. Aquí solo existe lo necesario para saber si algo ya se facturó; datos fiscales, timbrado y reintentos se agregan en S4-16 y S4-20.
8. **Cuándo se liquidó:** una venta, al venderse; una orden, con el último pago, y solo si los pagos ya cubren el total. El plazo es el último día de ese mes en hora de México [RN-26]; la regla vive en un solo lugar y es ampliable (PD-09).

## Consecuencias

- Un atacante no distingue folios existentes de inexistentes, y adivinar un código de 8 caracteres (31⁸ combinaciones) por folio se frena a 5 intentos cada 15 minutos.
- Un ataque desde muchas IPs contra muchos folios sigue limitado por folio; la verificación externa lo encarece más. Si hace falta, se baja el tope o se exige siempre Turnstile.
- Usar la IP de `cf-connecting-ip` / `x-forwarded-for` exige que el dominio pase por Cloudflare (PD-10); mientras tanto el límite por IP depende de lo que entregue la plataforma.
- El portal todavía no pide los datos fiscales ni timbra: eso es S4-19 y las historias de facturación.
