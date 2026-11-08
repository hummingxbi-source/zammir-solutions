# Cuestionario simplificado: qué se quitó y qué asumimos

El cuestionario HTML (`CUESTIONARIO_PARA_LUIS.html`) pasó de 91 a 35 preguntas. Lo que se quitó son decisiones técnicas o datos que ya tenemos; Luis no tiene por qué decidirlas.
Las preguntas completas siguen en `CUESTIONARIO_LUIS.md` por si se necesitan.

## Datos que ya no se piden (salen de la constancia fiscal o ya los tenemos)

Razón social, RFC, régimen, código postal, domicilio y nombre del negocio: salen de la foto de la constancia. El logo se pide por WhatsApp.

## Decisiones que toma el equipo técnico (propuesta; Juanito las aprueba)

| Tema | Lo que asumimos |
|---|---|
| Certificado de sello digital (CSD) | Los archivos los sube **HummingX** al proveedor de timbrado, con Luis guiado en el trámite (se corrige lo que decían los documentos). |
| Cuentas de producción | A nombre de Luis / ZAMMIR (persona física); HummingX como colaborador. Dominio y certificado siempre de ZAMMIR. |
| Dominio, aviso de privacidad y términos | Los propone HummingX; no se le preguntan a Luis. |
| Tablets e impresora | Las compra Juanito con el dinero de Luis (1 impresora); fechas ya acordadas. Ancho de papel: 58 mm. |
| Timbres | Se propone el paquete según unas 8 facturas al mes. |
| Facturación | Pago mixto, autofacturación hasta fin de mes, factura global, cancelaciones y reintentos: reglas propuestas por HummingX. |
| Persona de prueba, primera factura con contador | Se coordinan en la entrega; no se preguntan. |
| Parte C completa (afinaciones) | Vigencia 15 días, bloqueo 5 min, cierre de sesión 30 min, historial 90 días, aviso a las 6 h, etc.: se usan las propuestas ya registradas. |

## Pendiente de aprobación

Según la regla 12 de `CLAUDE.md`, lo anterior debe registrarse como ADR cuando Juanito lo apruebe. Las respuestas de Luis se anotan en `PENDIENTES.md` como siempre.
