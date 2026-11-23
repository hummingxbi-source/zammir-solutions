# ADR-0041: Sin verificación en dos pasos en las cuentas de administración

- **Estado:** Aceptada
- **Fecha:** 2026-11-23
- **Decide:** Juanito (HummingX BI)
- **Relacionada:** [ADR-0038], [ADR-0035]

## Contexto

La revisión de seguridad [S5-07] y el plan de producción recomendaban activar la verificación en dos pasos en GitHub, Supabase, Vercel y Cloudflare. Juanito considera que el procedimiento es demasiado tedioso para su trabajo diario y pide quitarlo del plan.

## Decisión

1. **No se usa verificación en dos pasos** en las cuentas de GitHub, Supabase, Vercel, Cloudflare ni en las de administrador de la aplicación.
2. **Se compensa** con contraseñas largas y distintas guardadas en un gestor de contraseñas, una cuenta por persona y sin contraseñas compartidas.
3. Se quita de la lista de verificación del plan y de PP-33.

## Consecuencias

- **Riesgo aceptado por Juanito:** quien obtenga una contraseña (por filtración, descuido o engaño) entra a la cuenta sin un segundo obstáculo. Las cuentas con más alcance son GitHub (secretos del despliegue y respaldos cifrados), Supabase (la base de datos) y el registrador del dominio.
- Si en el futuro cambia de opinión, se puede activar en cada panel en minutos sin tocar el código; esta decisión se sustituiría con otro ADR.
- La revisión de seguridad y la guía de operación quedan actualizadas.
