# Puesta en producción, paso a paso

> Guía para crear el proyecto en la nube y dejarlo conectado: Supabase (base de datos y funciones), Vercel (la aplicación), Cloudflare (dominio) y GitHub (despliegue y respaldos). Parte de [`ENTORNOS.md`](../arquitectura/ENTORNOS.md) y de [ADR-0003]. Las cuentas son **empresariales** y el código es de la empresa [ADR-0010].
>
> El **orden de trabajo** (qué se hace primero, quién y cómo se sabe que quedó) está en [`PLAN_DE_PRODUCCION.md`](PLAN_DE_PRODUCCION.md); esta guía trae el detalle de cada panel.
>
> **Regla de oro:** las llaves y contraseñas se escriben **solo en los paneles** (Vercel, Supabase, GitHub). Nunca en el repositorio, en un chat ni en un documento.

## Resumen: qué se crea y cómo se conecta

Hay **un solo entorno en la nube** [ADR-0043]: la cuenta de Supabase solo admite dos proyectos gratuitos y uno es de otro cliente.

| Cuándo | Base y funciones | Aplicación | Para qué |
|---|---|---|---|
| **Hasta la entrega** | Supabase `zammir-pruebas` (plan gratuito, [ADR-0038]) | Vercel `zammir-pruebas` (rama `main`), en `https://sistema.zammir-solutions.com` | Probar con la tablet real y **datos inventados** |
| **Desde la entrega** | Proyecto de Supabase **nuevo y vacío**, creado al borrar el anterior | El mismo proyecto de Vercel y el mismo dominio, con las llaves nuevas | ZAMMIR trabajando con datos reales |

- La **estructura** de la base (migraciones) y las **funciones** se suben con el flujo de GitHub *Desplegar a Supabase* (`.github/workflows/desplegar-supabase.yml`).
- La **aplicación** la despliega Vercel sola al fusionar a `main`.
- Cada cambio se prueba antes en la integración continua (con Supabase local) y en la **vista previa** de Vercel del PR.

## Paso 1 · Supabase (hacer primero con **pruebas**)

1. Entrar a [supabase.com](https://supabase.com) con la cuenta empresarial y crear una **organización** (por ejemplo "HummingX BI").
2. **New project** con estos datos:
   - Nombre: `zammir-pruebas`.
   - **Región: East US (North Virginia)**. Supabase no tiene región en México; es la más cercana y con todas las funciones.
   - **Contraseña de la base:** una larga y aleatoria. Guardarla en el gestor de contraseñas; se pide al desplegar.
3. Esperar a que termine de crear el proyecto (unos minutos). Anotar, **sin pegarlos en ningún lado**, de **Project Settings**:
   - **Project URL** y **Project ref** (la parte antes de `.supabase.co`).
   - La llave **publishable** o *anon* (pública; va en Vercel). La llave **service role** (secreta) **no se copia a ningún lado**: las funciones la reciben solas.
4. **Authentication → Sign In / Providers:** apagar **Allow new users to sign up** (nadie debe poder crear cuentas por su cuenta). En *Email*, exigir contraseñas de **12 caracteres o más**.
5. **Authentication → Users → Add user:** crear la cuenta de cada administrador, **sin** enviar invitación. En la entrega, Luis y Ricardo están presentes y **cada uno escribe su propia contraseña** (12 caracteres o más); HummingX no la conoce [ADR-0045]. Luego en **SQL Editor** darle el rol:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol": "ADMIN"}'::jsonb
   where email = 'CORREO-DEL-ADMINISTRADOR';
   ```

6. **En la entrega** se borra el proyecto y se repiten los pasos 2 a 5 con uno nuevo vacío y **otra** contraseña de base [ADR-0043]. No se vacían tablas a mano: la bitácora y los documentos legales están protegidos contra borrado [RN-18].

> **No** usar `supabase config push`: empujaría la configuración de desarrollo (por ejemplo, registro abierto) al proyecto real. Los ajustes de Authentication se hacen en el panel.

## Paso 2 · GitHub: secretos y entornos (despliegue de la base)

1. En el repositorio: **Settings → Environments → New environment** y crear **`pruebas`**, **`produccion`** y **`respaldo`**. Hasta la entrega, `pruebas` guarda los secretos de despliegue del único proyecto. En la entrega, los del proyecto nuevo van a `produccion` y `pruebas` se vacía. **No** se ponen *Required reviewers*: no existen en un repositorio privado con la cuenta gratuita, y el despliegue solo se corre a mano [ADR-0045]. `respaldo` guarda los secretos del respaldo nocturno (paso 7).
2. Dentro de cada entorno, **Add secret**:

   | Secreto | De dónde sale |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | Supabase → *Account → Access Tokens → Generate new token* |
   | `SUPABASE_PROJECT_REF` | El *Project ref* del paso 1 |
   | `SUPABASE_DB_PASSWORD` | La contraseña de la base del paso 1 |

3. **Actions → Desplegar a Supabase → Run workflow**, con el entorno que tiene los secretos (`pruebas` hasta la entrega, `produccion` después). Aplica todas las migraciones, despliega las funciones y comprueba que `salud` responda 200.

## Paso 3 · Secretos de las funciones (en el panel de Supabase)

En **Edge Functions → Secrets** (o con `supabase secrets set`):

| Secreto | Hasta la entrega | Proyecto de la entrega |
|---|---|---|
| `BILLING_PROVIDER` | **Sin valor** mientras la facturación esté en pausa [ADR-0039]; `simulated` solo para ensayarla (facturas **sin validez fiscal**) | **Sin valor** hasta tener el PAC real (S4-15, S5-02): sin valor, no se emiten facturas [ADR-0031] |
| `PORTAL_HASH_PEPPER` | Opcional: solo lo usa el portal de autofacturación, apagado; sin él usa la llave de servicio | **Otra** cadena aleatoria de 32+ caracteres, guardada en el gestor |
| `INVOICE_RETRY_WAIT_SECONDS`, `INVOICE_RETRY_MAX_ATTEMPTS` | Valores de [ADR-0033] | Igual |
| `TURNSTILE_SECRET_KEY` | Opcional | Opcional (ver PP-30) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` **no se configuran**: Supabase las entrega a las funciones.

## Paso 4 · Vercel (la aplicación)

1. En [vercel.com](https://vercel.com), con la cuenta empresarial: **Add New → Project → Import** el repositorio `hummingxbi-source/zammir-solutions`.
2. El archivo `vercel.json` del repositorio ya trae la compilación (`pnpm --filter @zammir/web build`), la carpeta de salida y las cabeceras. **No cambiar** esos campos en el panel.
3. **Environment Variables** (para *Production*):
   - `VITE_SUPABASE_URL` = *Project URL* del proyecto de Supabase **de ese entorno**.
   - `VITE_SUPABASE_ANON_KEY` = la llave pública (publishable o *anon*) de **ese mismo** proyecto.
4. **Settings → Git → Production Branch:** `main`.
5. **Deploy**. Abrir la dirección que da Vercel y comprobar que carga la pantalla de inicio.

> **En la entrega**, las variables `VITE_*` se cambian por las del proyecto nuevo y se definen **solo para *Production***, no para *Preview*. Así una vista previa de un PR no se conecta a los datos reales [ADR-0043].

## Paso 5 · Dominio (Cloudflare)

> **Hecho el 2026-11-23:** `zammir-solutions.com`, comprado en Cloudflare Registrar con renovación automática, y la aplicación en `sistema.zammir-solutions.com` (PD-10). El dominio no debe cambiar después de imprimir el primer comprobante con QR [RNF-37]; con la facturación en pausa todavía no se imprime ninguno [ADR-0039].

Si hubiera que repetirlo:

1. Comprar el dominio (Cloudflare Registrar si ofrece la terminación elegida; si no, otro registrador) y poner su DNS en **Cloudflare**. Queda a nombre de **HummingX BI** [ADR-0045].
2. En el proyecto de Vercel: **Settings → Domains → Add** el subdominio (`sistema.zammir-solutions.com`).
3. En Cloudflare, crear el registro DNS que Vercel indique (normalmente un `CNAME`) y dejarlo **solo DNS** (nube gris) para que Vercel emita el certificado.
4. Esperar a que Vercel muestre el dominio en verde y abrirlo con `https://`.
5. Anotar el dominio en el acta de entrega. `APP_PUBLIC_URL` aparece en `.env.example` y en `ENTORNOS.md`, pero hoy ninguna función lo lee: no hace falta definirlo.

## Paso 6 · Primera tablet

1. Abrir la dirección **https** en la tablet (con Chrome) y, cuando lo ofrezca, **instalar la aplicación**.
2. Entrar con la cuenta del administrador → **Usuarios**: dar de alta a las personas con su PIN → **Generar código**.
3. En la tablet: **Conectar esta tablet**, escribir el código y el nombre de la tablet. Entrar con el PIN.
4. Probar con el modo avión: cotizar, cobrar y ver que lo guardado sale al volver el internet.

## Paso 7 · Respaldos nocturnos

El plan gratuito de Supabase **no incluye respaldos de la plataforma** y ZAMMIR pide **30 días** de historial [RNF-21, PD-32, ADR-0038]: este respaldo nocturno es **la única copia**, así que activarlo y ensayar su restauración es obligatorio antes de operar con datos reales. El flujo `.github/workflows/respaldo-nocturno.yml` saca cada noche una copia **cifrada** y la guarda 30 días.

1. En el entorno `respaldo` de GitHub, agregar los secretos (hasta la entrega apuntan al único proyecto; en la entrega se cambian por los del nuevo). *Hasta que se fusione el PR del entorno propio, el flujo los lee de `produccion` [ADR-0045].*
   - `SUPABASE_DB_URL`: la cadena de conexión (Supabase → *Connect → Session pooler*), con su contraseña.
   - `CLAVE_DE_RESPALDO`: una frase larga. **Guardarla también fuera de GitHub**: sin ella, una copia no se puede abrir.
2. **Actions → Respaldo nocturno → Run workflow** para probar a mano. Debe terminar en verde y dejar un archivo `respaldo-zammir-AAAA-MM-DD.tar.enc`.
3. **Ensayar la restauración** de esa copia en Supabase local (ver [`RESTAURACION.md`](RESTAURACION.md)) antes de dar el respaldo por bueno.

> El respaldo copia la base y las cuentas, pero **todavía no las fotos de medición** (PD-57).

## Lista de verificación antes de dar por lista la producción

- [ ] Proyecto de Supabase **recreado vacío** en la entrega, con sus llaves nuevas en GitHub (`produccion`) y en Vercel [ADR-0043].
- [ ] Variables `VITE_*` de Vercel **solo en *Production***, no en *Preview*.
- [ ] Registro abierto apagado y contraseñas de 12+ caracteres en Supabase de producción.
- [ ] Migraciones y funciones desplegadas por el flujo (no a mano); `salud` responde 200.
- [ ] Producción **sin datos de prueba** (sin catálogo inventado, sin personas de prueba).
- [ ] `BILLING_PROVIDER` **sin valor** en producción hasta tener el PAC y el CSD reales.
- [ ] Dominio de ZAMMIR en HTTPS y anotado en el acta. ✅ en HTTPS desde el 2026-11-23.
- [ ] Tablet instalada desde el dominio y registrada; ensayo en modo avión hecho.
- [ ] Respaldo nocturno corrió en verde, desde el entorno `respaldo`, y se ensayó su restauración.
- [ ] Contraseñas largas y distintas en un gestor para las cuentas de administrador y las de Supabase, Vercel, GitHub y Cloudflare. La verificación en dos pasos **no se usa** [ADR-0041].
- [ ] Cabeceras de seguridad, incluida la política de contenido, probadas con la tablet (PP-33; prueba 9 de la fase 4 de `PLAN_DE_PRODUCCION.md`).
- [ ] Fecha de renovación del dominio anotada en la guía de operación (Supabase y Vercel son gratuitos [ADR-0038]; el PAC está en pausa [ADR-0039]).

## Si algo sale mal

- **La aplicación de producción se ve vacía o no deja entrar:** revisar que sus variables `VITE_*` sean las del proyecto de Supabase actual y volver a desplegar.
- **Una migración falló a medias:** no se edita la migración que ya corrió; se corrige con una nueva. Ver [`GUIA_DE_OPERACION.md`](GUIA_DE_OPERACION.md).
- **Se perdió algo:** [`RESTAURACION.md`](RESTAURACION.md).
