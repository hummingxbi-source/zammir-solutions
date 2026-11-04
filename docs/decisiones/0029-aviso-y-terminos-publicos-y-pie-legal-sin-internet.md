# ADR-0029: Aviso y términos públicos, y pie legal de los documentos sin internet

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-03
- **Decide:** Juanito (se propone en S4-11 y S4-12; confirmar al revisar el Sprint 4)

## Contexto

- Las cotizaciones y los comprobantes se generan en la tablet **sin internet** y deben decir qué aviso de privacidad rige, dónde leerlo completo y cómo ejercer los derechos sobre los datos [RF-M9-01, RF-M9-02, RF-M9-04].
- El cliente final abre ese enlace en su teléfono, sin entrar al sistema. Hasta ahora la tabla `legal_documents` solo la leían administradores y tablets (`docs/arquitectura/AUTENTICACION.md` §6: "anónimos → nada").
- Los términos del servicio (anticipo, garantía, cancelación, tiempos de entrega) son reglas del negocio que ZAMMIR aún no entrega (PD-12). No se pueden inventar [CLAUDE.md regla 1].
- El aviso debe declarar a los proveedores técnicos [RNF-17] y la transferencia de datos fiscales al PAC [RF-M9-05].

## Decisión

1. **Lectura pública acotada.** Los anónimos pueden **leer** las versiones de `legal_documents` que ya rigen (`effective_from <= now()`); nunca las de fecha futura, y no pueden publicar, modificar ni borrar. El canal para ejercer derechos sale de `public_business_contact()`, una función que expone solo nombre, WhatsApp y domicilio del negocio, no la tabla de ajustes.
2. **Páginas públicas** `/aviso` y `/terminos`, fuera del marco de la aplicación, que muestran la versión vigente y, al pie, el canal de derechos. Sin datos del negocio no inventan un canal: mandan a preguntar al vendedor.
3. **Pie legal en la tablet, sin internet.** La copia local de la entrada con PIN (`LoginSnapshot`) guarda **todas las versiones** del aviso y de los términos. Al generar un documento, `buildDocumentLegal` elige la versión vigente en ese momento y compone: aviso con versión y fecha, enlace (solo si ya hay dirección base, PD-10), canal de derechos (WhatsApp del negocio, solo si ya está definido) y los términos vigentes. Si una bajada no trae lo legal, se conserva el de la copia anterior.
4. **Los términos no se siembran.** Mientras ZAMMIR no los entregue, los documentos salen sin ese bloque; un administrador los publica desde Configuración con el mismo mecanismo de versiones que el aviso.
5. **Aviso, versión 2 del borrador.** Una migración agrega la versión 2 del borrador (la 1 se conserva) que nombra a Vercel, Supabase y Cloudflare, declara la transferencia al PAC y dice dónde ejercer derechos. Sigue siendo un borrador pendiente del asesor de ZAMMIR (PD-12).

## Consecuencias

- Un documento ya emitido conserva el texto de la versión que regía cuando se generó; cambiar el aviso no reescribe documentos viejos.
- Cuando se agreguen proveedores nuevos (por ejemplo Render, RNF-17), se publica una versión nueva del aviso; no hace falta cambiar código.
- La superficie pública crece en dos puntos (lectura de documentos vigentes y la función de contacto). Ambos son de solo lectura y no exponen datos personales.
- El enlace de los documentos depende de que se defina la dirección base pública (PD-10); mientras tanto el documento lleva versión y canal de derechos, sin enlace.
