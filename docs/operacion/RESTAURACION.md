# Restauración de un respaldo

> Historia S5-06 · recorrido **E9** · requerimiento **RNF-21**. El respaldo nocturno corre desde el 24 de noviembre de 2026. Lo que ya se probó es el procedimiento en local, con datos inventados; **falta ensayar la restauración de una copia real de la nube** en Supabase local [ADR-0043].
> Para quién: Juanito (HummingX BI) y quien lo releve. Va enlazada desde el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §7.

## 1. Para qué sirve y qué se promete

Si se pierde o se daña la base de producción (un error humano, una falla de la plataforma), hay que volver a tener **los datos de ZAMMIR** en un entorno limpio y comprobar que están completos.

- **Cuántos días hacia atrás** [RNF-21]: respaldos diarios con **al menos 30 días** de historial. El plan gratuito de Supabase no incluye respaldos [ADR-0038], así que la única copia es el **respaldo nocturno** de GitHub (`.github/workflows/respaldo-nocturno.yml`), cifrado y con 30 días de vida.
- **Qué no copia todavía:** las **fotos de medición** del depósito `order-photos` (PD-57). Hasta que se amplíe el respaldo, una restauración trae los datos y las cuentas, pero no las fotos.
- **Cuánto se puede perder:** con respaldos diarios, **hasta un día de captura** del servidor. La tablet no pierde lo que ya capturó: lo guarda y lo envía cuando vuelve a haber servidor. GitHub puede retrasar varias horas una corrida programada: las del 21 al 25 nov empezaron entre las 15:47 y las 19:40 UTC, no a las 08:00 UTC del horario.
- **Cuánto tarda:** el objetivo de tiempo lo define ZAMMIR con Juanito **(pendiente)**. El ensayo local midió los pasos (§4) para tener una referencia.

## 2. Qué copias existen

| Copia | Qué trae | Quién la toma | Estado |
|---|---|---|---|
| Respaldos diarios del plan de Supabase | — | — | **No existen** en el plan gratuito [ADR-0038] |
| Respaldo nocturno de GitHub | Datos de `public` y las cuentas (`auth.users` y `auth.identities`), cifrados | El flujo *Respaldo nocturno*, cada noche, con 30 días de vida | **Activo** desde el 24 nov 2026. **No trae las fotos de medición** (PD-57) |
| Exportación del negocio (Configuración) | Datos en CSV, JSON y PDF para leer; **sin PIN ni cuentas de tablets** | Un administrador, a mano | Existe (S5-08). **No sustituye al respaldo**: no se puede restaurar a partir de ella |

## 3. Procedimiento (producción)

> Se ejecuta en un proyecto de Supabase **nuevo y limpio**. **Nunca** se restaura encima del de producción sin haber comprobado antes la copia en uno limpio.

1. **Avisar y decidir.** Qué falló, desde qué fecha y hora se quiere volver, y quién autoriza (Luis o Ricardo). Anotar la hora de inicio. Las tablets siguen capturando sin internet; no hay que pedirles nada.
2. **Comprobar la copia y crear el proyecto limpio.**
   - Primero se restaura la copia en **Supabase local** (§4), para comprobar que abre y está completa.
   - La cuenta gratuita solo admite **dos proyectos** y uno es de otro cliente, que **no se toca** [ADR-0043]. Para un proyecto nuevo en la nube hay que borrar el dañado, **solo después** de comprobar la copia en local. Si no se puede borrar, se pasa la cuenta a un plan de pago mientras dura la emergencia: es el riesgo materializado del [ADR-0038].
3. **Poner la estructura.** Aplicar **todas las migraciones desde cero** (`supabase link` y `supabase db push`, o `pnpm db:reset` en local). Es la misma estructura de siempre, sin datos de prueba.
4. **Poner los datos**, según de dónde venga la copia:
   - *Respaldo del panel de Supabase:* no existe en el plan gratuito [ADR-0038]. Si algún día se cambia de plan, usar la opción de restaurar a un proyecto nuevo **(verificar en el panel: los nombres pueden cambiar)**.
   - *Respaldo nocturno de GitHub* (`.github/workflows/respaldo-nocturno.yml`): bajar el archivo `respaldo-zammir-AAAA-MM-DD.tar.enc` de **Actions → Respaldo nocturno** y abrirlo con la frase `CLAVE_DE_RESPALDO`: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:CLAVE_DE_RESPALDO -in respaldo-zammir-AAAA-MM-DD.tar.enc | tar -x`. Salen `public.dump` y `auth.dump`, que se restauran como dice la siguiente viñeta.
   - *Exportación nocturna o `pg_dump`:* restaurar solo los **datos** de `public` y de las cuentas (`auth.users` y `auth.identities`) con `pg_restore --data-only --disable-triggers`. Es exactamente lo que hace el ensayo (`scripts/ensayo-de-restauracion.mjs`); léelo como receta. Antes de restaurar hay que vaciar los datos de arranque que traen las migraciones (categorías, ajustes y documentos legales) para no duplicarlos.
5. **Reapuntar la aplicación.**
   - En Vercel, cambiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` al proyecto nuevo, **solo en *Production***, y volver a desplegar.
   - Desplegar migraciones y funciones con el flujo *Desplegar a Supabase*, no a mano.
   - Poner `PORTAL_HASH_PEPPER` en los secretos de las funciones. Mientras la facturación esté en pausa, `BILLING_PROVIDER` queda sin valor y no hay llaves del PAC ni de Turnstile [ADR-0039].
   - El dominio no cambia.
6. **Verificar** con la lista de la sección 5.
7. **Tablets.** Un proyecto nuevo tiene sus propias llaves de sesión: **cada tablet probablemente deberá conectarse otra vez con un código nuevo** (*Conectar esta tablet*). **Pendiente de comprobar en el ensayo real:** que lo que una tablet tenía sin enviar se acepte después de reconectarla (la operación lleva el identificador de la tablet de antes).
8. **Cerrar.** Anotar hora de fin, cuánto se perdió (hasta dónde llega la copia) y qué faltó. Pegar el resultado en la tabla de la sección 6.

## 4. Ensayo en local (hecho)

Se repite con datos inventados, contra Supabase **local**:

```bash
pnpm db:start
pnpm test:integracion                                  # opcional: llena la base con datos de prueba variados
pnpm ensayo:restauracion --confirmo-borrar-la-base-local
```

El ensayo: crea una cuenta de administrador de prueba; guarda **cuántos renglones y un resumen del contenido de cada tabla**; toma el respaldo con `pg_dump`; **borra y recrea la base desde cero con las migraciones** (el entorno limpio); restaura con `pg_restore`; y comprueba que **cada tabla quedó idéntica**, que la cuenta de administrador restaurada **inicia sesión** y que **la numeración automática sigue** sin chocar con lo restaurado. Falla (código distinto de cero) si algo no coincide. Se niega a correr sin la bandera de confirmación porque borra la base local.

Resultado del 8 de noviembre de 2026, con los datos que dejan las pruebas de integración:

| Paso | Tiempo |
|---|---|
| Respaldo (380 KB) | 0.8 s |
| Base limpia desde las migraciones | 42.1 s |
| Restauración | 1.6 s |

**28 tablas y 3,201 renglones, todas idénticas** (mismo número de renglones y mismo contenido); la cuenta restaurada inicia sesión y su función de administrador responde; la numeración automática siguió contando.

**Qué demuestra y qué no.** Demuestra que la estructura se recrea desde cero, que **los datos y las cuentas de acceso** se pueden restaurar completos y que sabemos comprobarlo. **No** demuestra: el respaldo de la plataforma de Supabase (no existe todavía), cuánto tarda con los datos de varios años, ni el paso de las tablets (punto 7).

## 5. Lista de verificación después de restaurar

- [ ] Cada tabla del negocio tiene el mismo número de renglones que la copia (clientes, cotizaciones, órdenes, ventas, pagos, turnos de caja, facturas, bitácora).
- [ ] Los **saldos** de cuentas por cobrar y el **total cobrado** de un día conocido coinciden con los de antes.
- [ ] Los **folios** siguen su cuenta: una venta nueva recibe el número que sigue, sin repetir.
- [ ] Un **administrador** inicia sesión y ve **Usuarios** y **Configuración**.
- [ ] Una **tablet** se conecta, baja el catálogo, entra con PIN, cotiza y envía.
- [ ] La función `salud` responde `{"ok":true}`.
- [ ] Las **fotos de medición** de una orden conocida se ven (cuando el respaldo las incluya, PD-57).
- [ ] *Solo con la facturación activa [ADR-0039]:* el portal `/factura` encuentra un folio de prueba, y una factura ya emitida se descarga (XML y PDF) y no se puede facturar otra vez.

## 6. Registro de ensayos

| Fecha | Dónde | Quién | Resultado | Tiempo | Notas |
|---|---|---|---|---|---|
| 8 nov 2026 | Local (datos inventados) | Claude | Aprobado: 28 tablas idénticas | ~45 s | Primer ensayo; ver sección 4 |
| 20 nov 2026 | Local (datos inventados, tras llenar la base con las pruebas de integración) | Claude | Aprobado: 28 tablas idénticas (3,841 renglones), la cuenta de administrador restaurada inicia sesión y la numeración sigue sin chocar | respaldo 0.7 s · base limpia 38.4 s · restauración 1.4 s | Segundo ensayo, con todas las migraciones actuales (umbral, hoja carta); 439 pruebas de la base y 317 de integración en verde antes del ensayo |
| *(pendiente, antes del 28 nov)* | Supabase local, con una copia real del respaldo de la nube | Juanito | | | S5-06 completo; paso 4 a mano (el ensayo `pnpm ensayo:restauracion` solo restaura la copia que él mismo saca de la base local) |

## 7. Pendientes que afectan a este documento

| Falta | Depende de |
|---|---|
| Fotos de medición en el respaldo | PD-57 |
| Ensayo con una copia del proyecto en la nube | Juanito, con Docker y `CLAVE_DE_RESPALDO`; se restaura en Supabase local [ADR-0043] |
| Objetivo de tiempo de recuperación | Luis y Juanito |
| Comprobar el paso de las tablets | Ensayo en producción |
