# Restauración de un respaldo

> Historia S5-06 · recorrido **E9** · requerimiento **RNF-21**. Borrador: el procedimiento de producción se **ensaya de verdad** cuando exista el proyecto de producción y sus respaldos (S4-26, S4-27, S5-01). Lo que ya se probó es el procedimiento en local, con datos inventados.
> Para quién: Juanito (HummingX BI) y quien lo releve. Va enlazada desde el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §7.

## 1. Para qué sirve y qué se promete

Si se pierde o se daña la base de producción (un error humano, una falla de la plataforma), hay que volver a tener **los datos de ZAMMIR** en un entorno limpio y comprobar que están completos.

- **Cuántos días hacia atrás** [RNF-21]: respaldos diarios con **al menos 30 días** de historial. Si el plan de Supabase guarda menos, se programa una exportación nocturna a otro almacenamiento con 30 días **(pendiente: la retención real del plan, PD-32, S4-27)**.
- **Cuánto se puede perder:** con respaldos diarios, **hasta un día de captura** del servidor. La tablet no pierde lo que ya capturó: lo guarda y lo envía cuando vuelve a haber servidor.
- **Cuánto tarda:** el objetivo de tiempo lo define ZAMMIR con Juanito **(pendiente)**. El ensayo local midió los pasos (§4) para tener una referencia.

## 2. Qué copias existen

| Copia | Qué trae | Quién la toma | Estado |
|---|---|---|---|
| Respaldos diarios del plan de Supabase | Toda la base (datos, cuentas de acceso) | La plataforma | **Pendiente**: confirmar plan y retención (PD-32) |
| Exportación nocturna externa | Toda la base, por si la retención del plan es menor a 30 días | Un trabajo programado | **Pendiente** (S4-27) |
| Exportación del negocio (Configuración) | Datos en CSV, JSON y PDF para leer; **sin PIN ni cuentas de tablets** | Un administrador, a mano | Existe (S5-08). **No sustituye al respaldo**: no se puede restaurar a partir de ella |

## 3. Procedimiento (producción)

> Se ejecuta en un proyecto de Supabase **nuevo y limpio**. **Nunca** se restaura encima del de producción sin haber comprobado antes la copia en uno limpio.

1. **Avisar y decidir.** Qué falló, desde qué fecha y hora se quiere volver, y quién autoriza (Luis o Ricardo). Anotar la hora de inicio. Las tablets siguen capturando sin internet; no hay que pedirles nada.
2. **Crear el proyecto limpio** (Supabase, plan de pago de producción o uno de ensayo).
3. **Poner la estructura.** Aplicar **todas las migraciones desde cero** (`supabase link` y `supabase db push`, o `pnpm db:reset` en local). Es la misma estructura de siempre, sin datos de prueba.
4. **Poner los datos**, según de dónde venga la copia:
   - *Respaldo del panel de Supabase:* usar la opción de restaurar a un proyecto nuevo **(verificar en el panel: los nombres pueden cambiar)**.
   - *Respaldo nocturno de GitHub* (`.github/workflows/respaldo-nocturno.yml`): bajar el archivo `respaldo-zammir-AAAA-MM-DD.tar.enc` de **Actions → Respaldo nocturno** y abrirlo con la frase `CLAVE_DE_RESPALDO`: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:CLAVE_DE_RESPALDO -in respaldo-zammir-AAAA-MM-DD.tar.enc | tar -x`. Salen `public.dump` y `auth.dump`, que se restauran como dice la siguiente viñeta.
   - *Exportación nocturna o `pg_dump`:* restaurar solo los **datos** de `public` y de las cuentas (`auth.users` y `auth.identities`) con `pg_restore --data-only --disable-triggers`. Es exactamente lo que hace el ensayo (`scripts/ensayo-de-restauracion.mjs`); léelo como receta. Antes de restaurar hay que vaciar los datos de arranque que traen las migraciones (categorías, ajustes y documentos legales) para no duplicarlos.
5. **Reapuntar la aplicación.** En Vercel cambiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` al proyecto nuevo y volver a desplegar; desplegar las funciones (`supabase functions deploy`) y poner sus secretos (`BILLING_PROVIDER`, llaves del PAC y de Turnstile, `PORTAL_HASH_PEPPER`). Si el dominio es el mismo, los QR de los tickets siguen funcionando.
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
- [ ] Un **administrador** inicia sesión y ve **Facturas**, **Usuarios** y **Configuración**.
- [ ] Una **tablet** se conecta, baja el catálogo, entra con PIN, cotiza y envía.
- [ ] El portal `/factura` encuentra un folio de prueba.
- [ ] La función `salud` responde `{"ok":true}`.
- [ ] Una factura ya emitida se puede descargar (XML y PDF) y no se puede facturar otra vez.

## 6. Registro de ensayos

| Fecha | Dónde | Quién | Resultado | Tiempo | Notas |
|---|---|---|---|---|---|
| 8 nov 2026 | Local (datos inventados) | Claude | Aprobado: 28 tablas idénticas | ~45 s | Primer ensayo; ver sección 4 |
| *(pendiente)* | Producción, con un respaldo real | Juanito | | | S5-06 completo; confirmar el punto 7 de las tablets |

## 7. Pendientes que afectan a este documento

| Falta | Depende de |
|---|---|
| Plan de Supabase y retención de respaldos | PD-32 |
| Exportación nocturna externa | S4-27 |
| Proyecto de producción donde ensayar | PD-10, S4-26, S5-01 |
| Objetivo de tiempo de recuperación | Luis y Juanito |
| Comprobar el paso de las tablets | Ensayo en producción |
