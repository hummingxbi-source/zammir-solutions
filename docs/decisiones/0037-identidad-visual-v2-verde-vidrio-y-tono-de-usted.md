# ADR-0037: Identidad visual v2 (verde vidrio y letra elegante) y tono de usted con los clientes

- **Estado:** Aceptada (propuesta) — la elección es de Luis; Juanito la confirma al fusionar
- **Fecha:** 2026-11-14
- **Decide:** Luis (cuestionario del 8 de noviembre de 2026) y Juanito
- **Modifica:** [ADR-0028] (solo los valores de color y la tipografía de títulos; la estructura y los componentes no cambian)
- **Concreta:** PD-35, PD-11, [RNF-28]

## Contexto

La identidad v1 [ADR-0028] se derivó de la demo (papel cálido, acento azul marino, Fraunces) mientras no había respuesta del cliente. En el cuestionario, Luis contestó cómo quiere que ZAMMIR se vea y se oiga:

- Quiere que sus clientes sientan **confianza y seguridad**, y eligió **"una mañana clara y fresca"** como imagen del negocio.
- Paleta: **verde vidrio** (verde botella y menta).
- Letra: **elegante y cálida** (Playfair Display).
- Cuando el sistema le habla a un cliente: **de usted**, formal y respetuoso.
- El nombre del negocio se escribe **ZAMMIR** (la tarjeta impresa dice "ZAMIR" con una sola M).

## Decisión

1. **Paleta v2 "verde vidrio"** en `tokens.css`: acento `#0F5C57`, oscuro `#0A3F3B`, claro `#5FB3A6`, papel claro y fresco `#F2F7F5`, paneles `#E4EEEB`, tinta `#1D2B2A`. Los valores de estado (éxito, peligro, aviso, información) y el latón secundario se conservan.
2. **Títulos y cifras en Playfair Display** (400 y 700, latín, `woff2`), que viaja con la aplicación y se guarda para uso sin internet [ADR-0028 decisión 3]. Fraunces sale del proyecto. Source Serif 4 (lectura) e IBM Plex Mono (rótulos) se quedan.
3. **Contraste AA** medido: tinta sobre papel 13.5:1, tinta suave 6.9:1, acento sobre papel 7.2:1, blanco sobre acento 7.8:1, borde de controles 4.5:1 sobre blanco. Lo verifica la prueba de accesibilidad con axe en el navegador.
4. **La marca de ZAMMIR** (la casa-hexágono con ventana de su tarjeta) se vectoriza de la foto de la tarjeta y se usa en la barra lateral y como ícono de la aplicación (192, 512 y maskable), con el color del texto que la rodea. Cuando Luis mande el logo en su archivo original se reemplaza el vector (PD-11).
5. **Tono de usted en todo texto que lee el cliente:** cotización, ticket, comprobantes, mensaje de WhatsApp, portal de facturas y aviso de privacidad. Lo que ve el personal de ZAMMIR en la tablet conserva el trato de tú, que Luis no pidió cambiar.
6. **No cambia ninguna regla de negocio:** cambian valores de diseño y textos.

## Consecuencias

- La paleta v2 queda en un solo archivo de tokens; elegir otra es cambiar valores, no componentes. El cuestionario ofrecía cuatro paletas y cuatro letras: si Luis cambia de idea, ya están definidas.
- El éxito (verde) y el acento (verde vidrio) son parecidos; por eso el estado nunca se comunica solo con color [ADR-0028 decisión 7] y las gráficas distinguen series con tonos de familias distintas (verde vidrio, latón, aluminio).
- Los íconos de la aplicación cambian: quien ya tenga instalada la aplicación en una tablet verá el ícono nuevo al actualizarla.
- Falta reemplazar el vector por el logo original y revisar los documentos impresos (cotización y ticket) con la marca; queda para cuando llegue el archivo.
