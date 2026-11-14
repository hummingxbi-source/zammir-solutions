# Puesta en producción, paso a paso

> Guía para crear los proyectos de **pruebas** y **producción** y dejarlos conectados: Supabase (base de datos y funciones), Vercel (la aplicación), Cloudflare (dominio) y GitHub (despliegue y respaldos). Parte de [`ENTORNOS.md`](../arquitectura/ENTORNOS.md) y de [ADR-0003]. Las cuentas son **empresariales** y el código es de la empresa [ADR-0010].
>
> **Regla de oro:** las llaves y contraseñas se escriben **solo en los paneles** (Vercel, Supabase, GitHub). Nunca en el repositorio, en un chat ni en un documento.

## Resumen: qué se crea y cómo se conecta

| Entorno | Base y funciones | Aplicación | Para qué |
|---|---|---|---|
| **Pruebas** | Supabase `zammir-pruebas` (plan gratuito) | Vercel `zammir-pruebas` (rama `main`) | Probar cada cambio con la tablet real |
| **Producción** | Supabase `zammir-produccion` (plan Pro) | Vercel `zammir-produccion` (rama `produccion`) | ZAMMIR trabajando con datos reales |

- La **estructura** de la base (migraciones) y las **funciones** se suben con el flujo de GitHub *Desplegar a Supabase* (`.github/workflows/desplegar-supabase.yml`), una vez por entorno.
- La **aplicación** la despliega Vercel sola al fusionar a su rama.
- Cada cambio se **prueba primero en pruebas** y se lleva a producción fusionando `main` en `produccion`.

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
5. **Authentication → Users → Add user:** crear la cuenta del primer administrador (correo y contraseña largos, **sin** enviar invitación). Luego en **SQL Editor** darle el rol:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol": "ADMIN"}'::jsonb
   where email = 'CORREO-DEL-ADMINISTRADOR';
   ```

6. Repetir los pasos 2 a 5 para **producción** (`zammir-produccion`, plan **Pro**) cuando ya se haya probado todo en pruebas.

> **No** usar `supabase config push`: empujaría la configuración de desarrollo (por ejemplo, registro abierto) al proyecto real. Los ajustes de Authentication se hacen en el panel.

## Paso 2 · GitHub: secretos y entornos (despliegue de la base)

1. En el repositorio: **Settings → Environments → New environment** y crear **`pruebas`** y **`produccion`**. En `produccion`, activar **Required reviewers** (una persona debe aprobar cada despliegue).
2. Dentro de cada entorno, **Add secret**:

   | Secreto | De dónde sale |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | Supabase → *Account → Access Tokens → Generate new token* |
   | `SUPABASE_PROJECT_REF` | El *Project ref* del paso 1 |
   | `SUPABASE_DB_PASSWORD` | La contraseña de la base del paso 1 |

3. **Actions → Desplegar a Supabase → Run workflow**, entorno **`pruebas`**. Aplica todas las migraciones, despliega las funciones y comprueba que `salud` responda 200.

## Paso 3 · Secretos de las funciones (en el panel de Supabase)

En **Edge Functions → Secrets** (o con `supabase secrets set`), por entorno:

| Secreto | Pruebas | Producción |
|---|---|---|
| `BILLING_PROVIDER` | `simulated` (facturas **sin validez fiscal**) | **Sin valor** hasta tener el PAC real (S4-15, S5-02): sin valor, no se emiten facturas [ADR-0031] |
| `PORTAL_HASH_PEPPER` | Cadena aleatoria de 32+ caracteres | **Otra** cadena aleatoria distinta, guardada en el gestor |
| `INVOICE_RETRY_WAIT_SECONDS`, `INVOICE_RETRY_MAX_ATTEMPTS` | Valores de [ADR-0033] | Igual |
| `TURNSTILE_SECRET_KEY` | Opcional | Opcional (ver PP-30) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` **no se configuran**: Supabase las entrega a las funciones.

## Paso 4 · Vercel (la aplicación)

1. En [vercel.com](https://vercel.com), con la cuenta empresarial: **Add New → Project → Import** el repositorio `hummingxbi-source/zammir-solutions`.
2. El archivo `vercel.json` del repositorio ya trae la compilación (`pnpm --filter @zammir/web build`), la carpeta de salida y las cabeceras. **No cambiar** esos campos en el panel.
3. **Environment Variables** (para *Production*):
   - `VITE_SUPABASE_URL` = *Project URL* del proyecto de Supabase **de ese entorno**.
   - `VITE_SUPABASE_ANON_KEY` = la llave pública (publishable o *anon*) de **ese mismo** proyecto.
4. **Settings → Git → Production Branch:** `main` para el proyecto de pruebas; `produccion` para el de producción (crear esa rama desde `main` la primera vez).
5. **Deploy**. Abrir la dirección que da Vercel y comprobar que carga la pantalla de inicio.

> Pruebas y producción son **dos proyectos de Vercel distintos**, cada uno con las llaves de **su** Supabase. Mezclarlas es el error más caro: una tablet de pruebas escribiría en producción.

## Paso 5 · Dominio (Cloudflare)

> **El dominio no puede cambiar después de imprimir el primer ticket real**: los códigos QR apuntan a él [RNF-37, PD-10]. Elegirlo con Luis antes de comprarlo.

1. Comprar el dominio a nombre de **ZAMMIR** (Cloudflare Registrar si ofrece la terminación elegida; si no, un registrador mexicano) y poner su DNS en **Cloudflare**.
2. En el proyecto de Vercel de **producción**: **Settings → Domains → Add** el dominio (por ejemplo `sistema.dominio.mx`).
3. En Cloudflare, crear el registro DNS que Vercel indique (normalmente un `CNAME`) y dejarlo **solo DNS** (nube gris) para que Vercel emita el certificado.
4. Esperar a que Vercel muestre el dominio en verde y abrirlo con `https://`.
5. Anotar el dominio en `APP_PUBLIC_URL` (variable de las funciones de producción) y en el acta de entrega.

## Paso 6 · Primera tablet (pruebas, luego producción)

1. Abrir la dirección **https** en la tablet (con Chrome) y, cuando lo ofrezca, **instalar la aplicación**.
2. Entrar con la cuenta del administrador → **Usuarios**: dar de alta a las personas con su PIN → **Generar código**.
3. En la tablet: **Conectar esta tablet**, escribir el código y el nombre de la tablet. Entrar con el PIN.
4. Probar con el modo avión: cotizar, cobrar y ver que lo guardado sale al volver el internet.

## Paso 7 · Respaldos nocturnos (solo producción)

El plan Pro de Supabase guarda **7 días** de respaldos diarios y ZAMMIR pide **30** [RNF-21, PD-32]. El flujo `.github/workflows/respaldo-nocturno.yml` saca cada noche una copia **cifrada** y la guarda 30 días.

1. En el entorno `produccion` de GitHub, agregar los secretos:
   - `SUPABASE_DB_URL`: la cadena de conexión (Supabase → *Connect → Session pooler*), con su contraseña.
   - `CLAVE_DE_RESPALDO`: una frase larga. **Guardarla también fuera de GitHub**: sin ella, una copia no se puede abrir.
2. **Actions → Respaldo nocturno → Run workflow** para probar a mano. Debe terminar en verde y dejar un archivo `respaldo-zammir-AAAA-MM-DD.tar.enc`.
3. **Ensayar la restauración** de esa copia en un proyecto limpio (ver [`RESTAURACION.md`](RESTAURACION.md)) antes de dar el respaldo por bueno.

## Lista de verificación antes de dar por lista la producción

- [ ] Dos proyectos de Supabase y dos de Vercel, cada uno con **sus** llaves.
- [ ] Registro abierto apagado y contraseñas de 12+ caracteres en Supabase de producción.
- [ ] Migraciones y funciones desplegadas por el flujo (no a mano); `salud` responde 200.
- [ ] Producción **sin datos de prueba** (sin catálogo inventado, sin personas de prueba).
- [ ] `BILLING_PROVIDER` **sin valor** en producción hasta tener el PAC y el CSD reales.
- [ ] Dominio de ZAMMIR en HTTPS, apuntando al proyecto de producción, y anotado en el acta.
- [ ] Tablet instalada desde el dominio y registrada; ensayo en modo avión hecho.
- [ ] Respaldo nocturno corrió en verde y se ensayó su restauración.
- [ ] Verificación en dos pasos en las cuentas de administrador y en las de Supabase, Vercel, GitHub y Cloudflare (PP-33).
- [ ] Cabeceras de seguridad probadas con la tablet (PP-33: la política de contenido se agrega al final, porque una mal puesta rompe la conexión).
- [ ] Anualidad: fechas de renovación de Supabase, Vercel, dominio y PAC anotadas en la guía de operación.

## Si algo sale mal

- **La aplicación de producción se ve vacía o no deja entrar:** revisar que sus variables `VITE_*` sean las de **su** Supabase y volver a desplegar.
- **Una migración falló a medias:** no se edita la migración que ya corrió; se corrige con una nueva. Ver [`GUIA_DE_OPERACION.md`](GUIA_DE_OPERACION.md).
- **Se perdió algo:** [`RESTAURACION.md`](RESTAURACION.md).
