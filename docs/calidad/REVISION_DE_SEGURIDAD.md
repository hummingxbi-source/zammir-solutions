# Revisión de seguridad

> Historia S5-07. Requerimientos: RNF-08 a RNF-13 y RNF-19. Se hizo sobre el entorno local con la base creada desde cero y el código de `main` al 8 de noviembre de 2026.
> Lo que se revisó **a mano** quedó además como **prueba automática**, para que un cambio futuro no abra un hueco sin que la integración continua lo avise.

## Resultado en una línea

La base y el código cumplen lo que se pidió. Se encontró **un permiso de sobra** (corregido) y quedan **tres recomendaciones** para producción (abajo, en *Pendiente*).

## Por requerimiento

| Requerimiento | Qué se revisó | Resultado | Quién lo vigila ahora |
|---|---|---|---|
| **RNF-08** HTTPS siempre | Vercel y Supabase sirven por HTTPS. | Cumple por la plataforma. Faltan **cabeceras de seguridad** propias (ver *Pendiente*). | Se confirma al desplegar a producción (S5-01). |
| **RNF-09** Contraseñas y PIN | Las contraseñas de administradores las guarda Supabase Auth. El PIN se guarda con **hash y sal** y tiene límite de intentos [ADR-0013]. | Cumple. | Pruebas de PIN y de bloqueo (`06_users`, `pin_lockout`, pruebas de entrada con PIN). |
| **RNF-10** RLS en **todas** las tablas; llaves de servicio solo en el servidor | Las 26 tablas del esquema `public` (el esquema `private` solo tiene funciones); permisos de `anon` y de usuarios con sesión; vistas; funciones; depósito de fotos; el código del navegador y el paquete compilado. | Cumple (con el permiso corregido abajo). | `22_revision_de_seguridad.test.sql`, `seguridad-del-codigo.test.ts` y `pnpm check:bundle` en el CI. |
| **RNF-11** Reglas en el servidor | Precios, totales, permisos y plazos se validan con el mismo código del núcleo en `receive_operation` y en las funciones de servidor; el rol de administrador se lee del token en el servidor. | Cumple. | Pruebas de integración con Supabase local (302) y de RLS por rol. |
| **RNF-12** Endpoints públicos con límite | El portal de autofacturación: respuesta uniforme, límites por IP y por folio con huellas (nunca el dato en claro), campo trampa, tiempo mínimo y Turnstile opcional [ADR-0030]. | Cumple. Turnstile espera su cuenta (PD-51). | `17_portal_factura`, `18_portal_solicitud` y sus pruebas de integración. |
| **RNF-13** Desarrollo seguro y dependencias | `pnpm audit`: **ninguna vulnerabilidad en las dependencias de producción**. Hay 7 avisos (1 baja, 6 moderadas) en herramientas de desarrollo (`qs`, `minimatch`, `glob`, `deepmerge` dentro de pruebas, lint y compilación) que **no se entregan**. | Cumple. | Paso 8c del CI: `pnpm audit --prod --audit-level high`. |
| **RNF-19** Ningún agente de IA con datos reales | Las pruebas, el código y las capturas del manual usan solo datos inventados; el CSD no pasa por el código; los accesos de producción se entregan a Juanito por un canal seguro. | Cumple como regla de trabajo. | Escaneo de secretos del CI y `seguridad-del-codigo.test.ts`. |

## Lo que se midió en la base

- **26 tablas, todas con RLS activada.** Tres no tienen ninguna política a propósito, porque solo las toca el servidor: `device_registration_codes`, `folio_counters` y `portal_attempts`.
- **Un visitante sin sesión (`anon`)** solo puede leer los documentos legales vigentes. No tiene permiso sobre ninguna otra tabla ni vista, y solo puede llamar tres funciones: `is_admin`, `is_device` y `public_business_contact` (el contacto público del negocio).
- **Un usuario con sesión** llama exactamente 13 funciones (las de administrador, la recepción de operaciones de una tablet y las de identidad). Toda función de ese grupo que escribe o lee con derechos elevados **comprueba el rol dentro de la propia función**. Lo del proveedor de timbrado, el portal, los reintentos y el registro de errores es **solo del servidor**.
- **Las ocho vistas** que usan las tablets (`*_for_device`, `login_users`, `sellable_products`) corren con los derechos de su dueño, por eso cada una filtra por administrador o tablet; ninguna la ve un visitante.
- **Toda función `SECURITY DEFINER` fija su `search_path`.**
- **El depósito de fotos de medición es privado** y sus políticas son solo para tablets y administradores.
- **Nadie con sesión puede borrar ni vaciar una tabla** (nada contable se borra desde el navegador [RN-18]).

## Hallazgo corregido

| | |
|---|---|
| **Qué** | La tabla `invoice_requests` (facturas pedidas) se creó con los permisos por omisión de Supabase: cualquier usuario con sesión tenía `INSERT`, `UPDATE`, `DELETE` y `TRUNCATE` sobre ella. |
| **Gravedad** | Baja. RLS ya impedía escribir (solo hay una política de lectura para administradores) y el servidor no expone `TRUNCATE`; pero `TRUNCATE` no pasa por RLS y nada contable debe poder borrarse. |
| **Corrección** | Migración `20261109000000_revision_de_seguridad.sql`: se quitan todos los permisos a `anon` y a usuarios con sesión y se deja solo `SELECT` (los administradores leen las facturas). |
| **Para que no vuelva** | La prueba 22 revisa **todas** las tablas: nadie con sesión ni anónimo tiene `DELETE`, `TRUNCATE`, `REFERENCES` ni `TRIGGER`. |

## Pendiente (no bloquea esta historia)

1. **Cabeceras de seguridad en el navegador** (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, protección contra que otra página meta la aplicación en un marco). No hay `vercel.json` todavía. Una política de contenido mal puesta rompe la conexión con Supabase o el portal, así que conviene definirla **al configurar el despliegue de producción** (S4-26 / S5-01) y probarla con la tablet. Propuesta PP-33.
2. **Las huellas del PIN viajan a las tablets.** La vista `login_users` entrega a toda tablet activa el hash y la sal de los PIN, para poder entrar sin internet [ADR-0013]. Es una decisión de diseño conocida: un PIN de 4 a 6 dígitos se puede adivinar si alguien extrae esos datos de una tablet. Se mitiga con la revocación de tablets, el límite de intentos y PIN más largo para administradores; está en los riesgos de `AUTENTICACION.md` y sigue vigente.
3. **Cuentas de administrador.** Hoy el rol se pone a mano en la cuenta de Supabase. Para producción conviene activar la verificación en dos pasos de esas cuentas y documentar quién tiene acceso (manual de soporte, S5-14).

## Cómo se repite esta revisión

```bash
pnpm db:reset && pnpm test:db          # RLS, permisos, vistas, funciones (22_revision_de_seguridad)
pnpm test                              # incluye seguridad-del-codigo.test.ts
pnpm build && pnpm check:bundle        # el paquete del navegador no trae secretos
pnpm audit --prod --audit-level high   # dependencias de producción
```

El escaneo de secretos de los cambios (gitleaks) corre en cada Pull Request. Si se agrega una tabla, una vista o una función que rompa una de estas reglas, la prueba 22 falla y dice cuál.
