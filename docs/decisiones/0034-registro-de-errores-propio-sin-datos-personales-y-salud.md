# ADR-0034: Registro de errores propio sin datos personales y comprobación de salud para el monitoreo

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-05
- **Decide:** Juanito (se propone en S4-28; confirmar al revisar el Sprint 4)

## Contexto

- Hace falta enterarse de los errores del navegador y de las funciones de servidor, y de las caídas del servicio, sin guardar datos personales de los clientes de ZAMMIR [RNF-34, ADR-0010].
- Un servicio externo de errores (de los que se instalan con una cuenta y una llave) manda por omisión direcciones, usuarios y datos de las peticiones a terceros; hay que decidir con cuidado y necesita una cuenta que crea Juanito (ENTORNOS §8).
- Los errores del navegador pueden contener lo que escribió una persona (un nombre, un correo, un RFC) dentro de un mensaje.

## Decisión

1. **Registro propio en la base** (`error_log`), sin servicios de terceros. Se guarda solo: origen (navegador o servidor), nombre y mensaje del error, pila, ruta, versión y hora. **No se guarda** IP, usuario, sesión, cuerpo de peticiones ni la causa (`cause`) del error.
2. **La limpieza vive en el núcleo** (`scrubText`, `scrubRoute`, `buildErrorReport`) y se aplica **dos veces**: en el navegador antes de enviar y en el servidor al recibir (el navegador no es de fiar). Quita correos, teléfonos, RFC, CURP, tokens, claves y la consulta (`?…`/`#…`) de las direcciones; cambia identificadores y folios de la ruta por `:id`; acota tamaños (mensaje 500, pila 2000 caracteres). No puede reconocer un nombre propio: por eso el código nunca pone en un mensaje de error un valor escrito por una persona, y esto se revisa en las revisiones de código.
3. **El navegador atrapa** los errores que nadie atrapó (`error`, promesas rechazadas) y los de una pantalla que se rompe (límite de errores con mensaje en lenguaje del oficio y botón "Volver a abrir"). Cada sesión envía como máximo 10 errores distintos y no repite el mismo. Sin internet el error se descarta: no vale una cola ni datos guardados en la tablet.
4. **Las funciones de servidor** usan `servir(nombre, manejador)` en vez de `Deno.serve`: una excepción sin atrapar se limpia, se guarda y la persona recibe un 500 sin detalles.
5. **Recepción pública** `registrar-error`: responde siempre 204, ignora cuerpos mal formados o de más de 8 KB y la base limita a **60 errores por minuto** en total, para que un ciclo de fallas no llene la tabla.
6. **Solo administradores leen** `error_log` (política y `admin_error_log()`); nadie lo escribe desde el navegador. Se purga a los 90 días con `error_log_purge` (se programa con el mantenimiento de S4-26): nada de esto es contable.
7. **Disponibilidad:** la función pública `salud` responde `{ok:true}` (200) si la base contesta y 503 si no. **Un servicio de monitoreo externo** la consulta cada pocos minutos y avisa a Juanito (correo o mensaje). La herramienta concreta (UptimeRobot, Better Stack u otra de plan gratuito) y su cuenta las decide y crea Juanito: se propone como PP-32. Hasta entonces el criterio "el monitoreo avisa a Juanito" queda a la espera de esa cuenta.

## Consecuencias

- Los errores quedan en nuestra base, con la misma protección y respaldos que lo demás; no hay terceros con acceso.
- Ver el registro en pantalla (una sección para administradores) no se construyó: hoy se lee con `admin_error_log()` desde el panel de Supabase. Se propone en PP-32 si hace falta.
- Si el limpiador deja pasar un dato nuevo (por ejemplo otro formato de documento), se agrega una regla con su prueba; el servidor siempre vuelve a limpiar, así que un navegador con una versión vieja no abre un hueco.
