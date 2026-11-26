# Plan de producción y pruebas físicas

> Es el **orden de trabajo** para llevar el sistema de `main` a una tablet real y entregarlo. Los pasos detallados de cada panel (Supabase, GitHub, Vercel, Cloudflare) están en [`PUESTA_EN_PRODUCCION.md`](PUESTA_EN_PRODUCCION.md). Aquí se dice **qué se hace primero, quién lo hace, cómo se sabe que quedó y qué no se debe hacer**.
>
> **Regla de oro:** las llaves, contraseñas y tokens se escriben **solo en los paneles** (Vercel, Supabase, GitHub, Cloudflare) y en el gestor de contraseñas. Nunca en el repositorio, en un chat ni en un documento. Ningún agente de IA recibe llaves ni datos reales [RNF-19].

## 0. Decisiones que ya están tomadas

| Tema | Decisión |
|---|---|
| Un solo entorno | **Un proyecto de Supabase y uno de Vercel** (`zammir-pruebas`) hasta la entrega. Se prueba en producción con **datos inventados** y en la entrega el proyecto de Supabase **se borra y se crea vacío** [ADR-0043]. |
| Dominio | **`zammir-solutions.com`**, comprado en Cloudflare con renovación automática. La aplicación vive en **`https://sistema.zammir-solutions.com`** y la raíz queda libre (PD-10, resuelto). Con la facturación en pausa [ADR-0039] los documentos no llevan QR, así que el dominio todavía no está impreso en ningún lado. |
| Planes | Supabase y Vercel **gratuitos** [ADR-0038]. La cuenta solo admite dos proyectos activos de Supabase y uno es de otro cliente, que **no se toca**. |
| Facturación | Apagada: **no** se define `VITE_FACTURACION` en Vercel ni `FACTURACION_ACTIVA` en Supabase, y `BILLING_PROVIDER` queda **sin valor** [ADR-0039]. |
| Impresión | Hoja carta con la impresión de Android [ADR-0040]. Falta confirmar el modelo de la impresora de Luis (PD-54). |
| Verificación en dos pasos | No se usa [ADR-0041]. |
| Titularidad | Las cuentas, el dominio y el código son de **HummingX BI**; los datos son de ZAMMIR [ADR-0045]. |
| Repositorio | **Público hasta la entrega**; se vuelve privado después de firmar (PD-59, [ADR-0045]). No se usan *Required reviewers*. |

## 1. Quién hace qué

| Quién | Qué |
|---|---|
| **Juanito** | Todo lo que pide una cuenta o un pago: crear proyectos, pegar llaves en los paneles, activar el respaldo, recrear el proyecto en la entrega. |
| **Claude** | Ajustar el código y la documentación, leer los resultados que Juanito le copie (sin llaves), corregir lo que salga en las pruebas y mantener la lista de hallazgos. |
| **Luis** | Decidir lo pendiente (catálogo, garantía, texto legal, impresora), dar los nombres de quienes usan la tablet, probar con su equipo y firmar la aceptación. |

## 2. Fase 0 · Cuentas y dominio ✅ (2026-11-23)

- [x] **Gestor de contraseñas** con una bóveda para ZAMMIR.
- [x] **`zammir-solutions.com`** comprado en Cloudflare, con renovación automática. Los datos del titular están en el gestor, no aquí. En la entrega se transfiere a ZAMMIR si quedó a nombre de HummingX.
- [x] **Organización "HummingX BI"** en Supabase y proyecto en Vercel.

## 3. Fase 1 · El entorno en la nube ✅ (2026-11-23)

1. [x] Supabase `zammir-pruebas`: pasos 1 a 5 de `PUESTA_EN_PRODUCCION.md` (registro abierto **apagado**, contraseñas de 12 caracteres o más, primer administrador con su rol).
2. [x] GitHub: entorno **`pruebas`** con sus tres secretos (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).
3. [x] **Actions → Desplegar a Supabase** con entorno `pruebas`: terminó en verde.
4. ➖ **`PORTAL_HASH_PEPPER` no se definió en `zammir-pruebas`, y no hace falta:** solo lo usa el portal de autofacturación, que está apagado; sin él, la función usa la llave de servicio (`supabase/functions/_shared/portal.ts`). Se define en el proyecto nuevo de la entrega (§7, paso 3). `BILLING_PROVIDER` queda **sin valor** mientras la facturación esté en pausa.
5. [x] Vercel `zammir-pruebas`: rama de producción `main`, con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de ese Supabase.
6. [x] **Dominio:** `sistema.zammir-solutions.com` en Vercel y su `CNAME` en Cloudflare, en **solo DNS** (nube gris). Responde por `https://`.

**Listo cuando:** `https://sistema.zammir-solutions.com` carga y entra el administrador. ✅

**Cómo llega un cambio:** PR con la compuerta en verde (incluye pruebas con Supabase local), vista previa de Vercel y fusión a `main`, que se despliega sola. Los cambios de la base se suben con *Desplegar a Supabase*.

## 4. Fase 2 · Primera tablet (Juanito con la tablet; ~1 hora)

1. Abrir `https://sistema.zammir-solutions.com` en Chrome e **instalar la aplicación**.
2. Como administrador, en la computadora: **Usuarios** → dar de alta a dos personas de prueba con su PIN → **Generar código**.
3. En la tablet: **Conectar esta tablet** con el código y entrar con el PIN.
4. En **Configuración**, comprobar que aparecen los textos legales y los días para marcar una cuenta como atrasada.
5. **Prueba de modo avión:** cotizar y cobrar sin internet, volver a conectar y ver que lo guardado se envía.

**Listo cuando:** la venta hecha sin internet aparece en Reportes después de reconectar.

## 5. Fase 3 · Respaldos (Juanito; ~1 hora)

El plan gratuito no incluye respaldos de la plataforma, así que este es **el único respaldo** [PD-32]. Se activa ya, con datos de prueba, para ensayarlo antes de que haya un solo dato que importe.

1. [x] En el entorno `produccion` de GitHub: secretos `SUPABASE_DB_URL` (Session pooler del único proyecto) y `CLAVE_DE_RESPALDO` (guardada también en el gestor). Hecho el 2026-11-24.
2. [x] **Actions → Respaldo nocturno → Run workflow**: la primera copia salió en verde el 2026-11-24 (`respaldo-zammir-2026-11-24`, unos 215 KB). Desde entonces corre sola cada noche.
3. [x] **Ensayar la restauración** de una copia de la nube con Supabase local y anotar el resultado en su registro de ensayos. **Aprobado el 2026-11-25** con `scripts/ensayo-restauracion-nube.sh` (`RESTAURACION.md` §6).
4. [x] **Entorno propio del respaldo y fotos** [ADR-0045, ADR-0046], **antes** de fusionar el PR que cambia el flujo. Hecho el 2026-11-25:
   - en Supabase, **Storage → S3 Configuration**: crear una llave de acceso S3 y anotar el *endpoint* y la región;
   - en GitHub, crear el entorno `respaldo` (sin revisores) con `SUPABASE_DB_URL`, `CLAVE_DE_RESPALDO`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID` y `SUPABASE_S3_SECRET_ACCESS_KEY`.
5. [x] Fusionar el PR, correr **Respaldo nocturno** a mano y comprobar que salen `respaldo-zammir-…` y `fotos-zammir-…`. Después, quitar `SUPABASE_DB_URL` y `CLAVE_DE_RESPALDO` del entorno `produccion`. Hecho el 2026-11-25 (PR #128): las dos copias salieron en verde.
6. [ ] Tomar una foto de medición en la tablet (P2), correr el respaldo a mano y comprobar que la copia de fotos ya no sale vacía.

## 6. Fase 4 · Pruebas físicas (Juanito, Luis y el equipo; S4-33, S5-05, S5-09)

**Equipo:** las **dos tablets**, la impresora de Wi-Fi de Luis y un celular con WhatsApp.

| # | Prueba | Se ve bien cuando |
|---|---|---|
| 1 | **Impresora:** darla de alta en la tablet (Mopria o complemento del fabricante) | La tablet la encuentra |
| 2 | **Imprimir** una cotización, una venta, un comprobante de trabajo y un corte | Salen en hoja carta, con logo, sin cortes ni letras ilegibles; el segundo intento sale con **COPIA** |
| 3 | **Enviar por WhatsApp** esos mismos documentos | Llegan como PDF legible en el celular |
| 4 | Imprimir con la impresora apagada, a propósito | El sistema dice qué hacer y se puede guardar el PDF o mandarlo |
| 5 | **Recorridos E1 a E10** de `docs/calidad/PRUEBAS_DE_ACEPTACION.md` en la tablet real | Todos pasan; lo que falle va a la lista de hallazgos |
| 6 | **Tiempos** (S4-33): abrir el cotizador, emitir una cotización, cobrar una venta | Se sienten inmediatos; se anota lo que tarde |
| 7 | **Accesibilidad** (S4-33): letra, botones, contraste, uso con una mano | Se lee y se toca sin esfuerzo |
| 8 | **Dos tablets** al mismo tiempo (cobrar en una y mirar Reportes en la otra) | Los folios no chocan y los totales coinciden |
| 9 | **Cabeceras de seguridad** (PP-33): entrar, sincronizar, subir una foto e imprimir | Nada se bloquea; la consola del navegador no muestra avisos de la política de contenido |

**Lista de hallazgos.** Cada problema se anota con: pantalla, qué se esperaba, qué pasó, hora, y una foto si ayuda (**sin datos reales ni llaves**). Se pasa a Claude, que lo corrige en una rama. El arreglo se revisa en la vista previa de Vercel y llega a `sistema.zammir-solutions.com` al fusionarse.

## 7. Fase 5 · Entrega: proyecto nuevo y datos reales

Solo cuando las pruebas físicas pasaron y Luis aceptó lo probado. **No se borran filas a mano:** la bitácora, el historial de precios y los documentos legales están protegidos contra borrado a propósito [RN-18], y esa protección no se desactiva [ADR-0043].

**Proyecto vacío:**

1. Borrar el proyecto `zammir-pruebas` en Supabase y crear uno nuevo vacío (pasos 1 a 5 de `PUESTA_EN_PRODUCCION.md`, con **otra** contraseña de base). Incluye **apagar el registro abierto** y exigir **contraseñas de 12 caracteres o más** (paso 1.4).
2. GitHub: los secretos del proyecto nuevo van al entorno **`produccion`**, **sin** *Required reviewers* [ADR-0045], con un `SUPABASE_ACCESS_TOKEN` **nuevo**. El entorno `pruebas` se vacía y el token viejo **se revoca en Supabase**: es de la cuenta y alcanza también el otro proyecto.
3. **Desplegar a Supabase** con entorno `produccion`, y los secretos de las funciones (`PORTAL_HASH_PEPPER` **nuevo**).
4. Vercel: cambiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` por las del proyecto nuevo, **solo para *Production***, y quitarlas de *Preview*, para que una vista previa no escriba en los datos reales. Redesplegar.
5. En el entorno `respaldo`: actualizar `SUPABASE_DB_URL` y las cuatro `SUPABASE_S3_*` con una llave S3 **nueva** del proyecto nuevo. Correr el respaldo a mano y confirmar que salen las dos copias del proyecto nuevo.

**Datos reales:**

- [ ] **Administradores** (Luis y Ricardo) con su correo. **Cada uno escribe su contraseña en persona** [ADR-0045].
- [ ] **Usuarios reales** con PIN propio (S5-04): Luis y Ricardo como administradores y la persona del mostrador como **Cajero / vendedor** [ADR-0045]. Cada quien escribe su PIN en persona.
- [ ] **Las dos tablets** reconectadas con códigos nuevos.
- [ ] **Catálogo real** y reglas de precio (S5-03; PD-02 y PD-03).
- [ ] **Datos del negocio, garantía y textos legales** definitivos (PD-06, PD-11, PD-12).
- [ ] **Aceptación firmada** por Luis (S5-10).
- [ ] **Capacitaciones** con Luis, Ricardo y el equipo de mostrador (S5-11 a S5-13).
- [ ] **Entrega:** se firma el acta con el registro de accesos (anexo B) y se anotan las fechas de renovación del dominio. El dominio y las cuentas siguen a nombre de HummingX BI [ADR-0045] (S5-14 a S5-16).
- [ ] **Después de firmar:** pasar el repositorio a privado y comprobar que Vercel siga desplegando (PD-59).

## 8. Lo que no se hace

- **No** tocar el otro proyecto de Supabase de la cuenta: es de otro cliente.
- **No** usar datos reales de clientes ni de precios de ZAMMIR antes de recrear el proyecto en la fase 5.
- **No** reutilizar ni copiar nada del proyecto de pruebas al nuevo.
- **No** correr `supabase config push` (empujaría el registro abierto de desarrollo al proyecto real).
- **No** editar una migración que ya corrió: se corrige con otra nueva.
- **No** activar la facturación sin completar antes la lista de reactivación del ADR-0039.

## 9. Si algo sale mal

| Pasa esto | Se hace |
|---|---|
| La aplicación no deja entrar o se ve vacía | Revisar que las variables `VITE_*` de Vercel sean las del proyecto de Supabase actual y redesplegar |
| El despliegue de la base falla | Leer el paso que falló en Actions; no tocar la base a mano. Se corrige con una migración nueva |
| Un arreglo rompió algo | En Vercel, *Promote* el despliegue anterior; después corregir en `main` |
| La política de contenido bloquea algo (pantalla en blanco, no sincroniza) | *Promote* el despliegue anterior y pasar a Claude el aviso de la consola |
| Supabase pausó el proyecto | Reactivarlo desde el panel; no se pierden datos [ADR-0038] |
| Se perdió información | `RESTAURACION.md` |
| Una tablet no conecta | Generar un código nuevo y repetir *Conectar esta tablet* |

## 10. Pendientes que afectan este plan

| Pendiente | Efecto |
|---|---|
| **PD-54** | Sin el modelo de la impresora no se cierra la prueba 1 de la fase 4 |
| **PR-38** (era PD-32) | Respaldo en verde y restauración ensayada el 25 nov; se repite con el proyecto nuevo de la entrega (P12) |
| **PD-57** | La copia de las fotos está activa; falta comprobarla con una foto real |
| **PP-33** | Las cabeceras de seguridad se confirman con la prueba 9 de la fase 4 |
