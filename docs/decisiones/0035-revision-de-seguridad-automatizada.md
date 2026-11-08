# ADR-0035: Revisión de seguridad automatizada: invariantes de la base, escaneo del paquete y auditoría de producción

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-08
- **Decide:** Juanito (se propone en S5-07)

## Contexto

- RLS en todas las tablas, llaves de servicio solo en el servidor y nada contable que se borre son requisitos que se rompen con un descuido: una tabla nueva con los permisos por omisión de Supabase, una vista sin filtro o una variable secreta usada en el navegador [RNF-10, RN-18].
- La revisión de S5-07 encontró justo un caso (`invoice_requests` con permisos de sobra). Una revisión a mano se queda vieja con el siguiente cambio.

## Decisión

1. **Invariantes de la base en pgTAP** (`22_revision_de_seguridad`): toda tabla con RLS; lista cerrada de tablas sin política; `anon` solo lee documentos legales; toda vista sin `security_invoker` filtra por administrador o tablet; toda función `SECURITY DEFINER` fija `search_path` y comprueba el rol; listas cerradas de funciones que pueden llamar `anon` y los usuarios con sesión; depósitos de archivos privados; nadie con sesión borra ni vacía tablas. **Agregar un renglón a una lista es una decisión de seguridad** y se hace con revisión.
2. **Pruebas sobre el código** (`seguridad-del-codigo.test.ts`): el código del navegador no nombra llaves ni variables solo del servidor ni lee `process.env`; el repositorio no versiona llaves privadas ni tokens con rol de servicio; `.env.example` no lleva valores.
3. **Escaneo del paquete compilado** (`pnpm check:bundle`, paso 8b del CI): ningún secreto ni token que no sea el rol `anon` en `apps/web/dist`.
4. **Auditoría de dependencias de producción** (`pnpm audit --prod --audit-level high`, paso 8c del CI). Los avisos de herramientas de desarrollo no frenan, pero se revisan en cada revisión de seguridad.
5. **Correctivo:** la migración `20261109000000` quita los permisos por omisión de `invoice_requests` y deja solo `SELECT` para usuarios con sesión.

## Consecuencias

- Una tabla nueva debe traer sus `revoke`/`grant` explícitos; si no, la prueba 22 falla.
- La auditoría de dependencias necesita internet en el CI y un aviso nuevo de gravedad alta en una dependencia de producción detiene las fusiones hasta resolverlo (actualizar o justificar).
- Las cabeceras de seguridad (CSP y similares) quedan para el despliegue de producción (PP-33).
