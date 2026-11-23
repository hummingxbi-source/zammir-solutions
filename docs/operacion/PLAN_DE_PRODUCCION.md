# Plan de producción y pruebas físicas

> Es el **orden de trabajo** para llevar el sistema de `main` a una tablet real y a producción. Los pasos detallados de cada panel (Supabase, GitHub, Vercel, Cloudflare) están en [`PUESTA_EN_PRODUCCION.md`](PUESTA_EN_PRODUCCION.md); aquí se dice **qué se hace primero, quién lo hace, cómo se sabe que quedó y qué no se debe hacer**.
>
> **Regla de oro:** las llaves, contraseñas y tokens se escriben **solo en los paneles** (Vercel, Supabase, GitHub, Cloudflare) y en el gestor de contraseñas. Nunca en el repositorio, en un chat ni en un documento. Ningún agente de IA recibe llaves ni datos reales [RNF-19].

## 0. Decisiones que ya están tomadas

| Tema | Decisión |
|---|---|
| Dominio | **`zammir-solutions.com`** (propuesto por Juanito el 2026-11-20; falta que Luis lo conozca y esté de acuerdo, PD-10). La aplicación vive en el subdominio **`sistema.zammir-solutions.com`** y la raíz queda libre. Con la facturación en pausa [ADR-0039] los documentos ya no llevan QR, así que el dominio no se imprime todavía. |
| Probar en producción | Se prueba en la **tablet con producción**, con **datos inventados**, antes de la entrega. Los cambios nuevos pasan **primero por pruebas**. |
| Planes | Supabase y Vercel **gratuitos** [ADR-0038]. El plan gratuito de Supabase permite **dos proyectos activos**: uno de pruebas y uno de producción. |
| Facturación | Apagada: **no** se define `VITE_FACTURACION` en Vercel ni `FACTURACION_ACTIVA` en Supabase, y `BILLING_PROVIDER` queda **sin valor** en producción [ADR-0039]. |
| Impresión | Hoja carta con la impresión de Android [ADR-0040]; falta confirmar el modelo de la impresora de Luis (PD-54). |

## 1. Quién hace qué

| Quién | Qué |
|---|---|
| **Juanito** | Todo lo que pide una cuenta o un pago: comprar el dominio, crear proyectos, pegar llaves en los paneles, aprobar el despliegue a producción. |
| **Claude** | Ajustar el código y la documentación, leer los resultados que Juanito le copie (sin llaves), corregir lo que salga en las pruebas y mantener la lista de hallazgos. |
| **Luis** | Decidir lo pendiente (catálogo, garantía, texto legal, impresora), probar con su equipo y firmar la aceptación. |

## 2. Fase 0 · Antes de empezar (Juanito, ~1 hora)

- [ ] **Gestor de contraseñas** listo y con una bóveda para ZAMMIR.
- [ ] **Comprar `zammir-solutions.com`** (Cloudflare Registrar si lo ofrece; si no, otro registrador y después apuntar el DNS a Cloudflare). Activar renovación automática. Anotar a nombre de quién queda y, si es de Juanito, que **se transfiere a ZAMMIR en la entrega**.
- [ ] **Organización en Supabase** (por ejemplo "HummingX BI") y **equipo en Vercel** con la cuenta empresarial.

**Listo cuando:** puede entrar a los cuatro paneles y el dominio aparece en Cloudflare.

## 3. Fase 1 · Entorno de pruebas (Juanito, con Claude ayudando; ~2 horas)

Es el entorno donde se prueba **cada cambio antes de llevarlo a producción**, y donde se ensaya lo delicado.

1. Supabase `zammir-pruebas`: pasos 1 a 5 de `PUESTA_EN_PRODUCCION.md` (registro abierto **apagado**, contraseñas de 12+ caracteres, primer administrador con su rol).
2. GitHub: entorno **`pruebas`** con sus tres secretos (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).
3. **Actions → Desplegar a Supabase** con entorno `pruebas`. Debe terminar en verde con `salud` en 200.
4. Secretos de las funciones en Supabase: `BILLING_PROVIDER=simulated` y `PORTAL_HASH_PEPPER` (una cadena larga aleatoria).
5. Vercel `zammir-pruebas`: rama de producción `main`, y las dos variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` **de ese Supabase**.

**Listo cuando:** abre la dirección de Vercel, entra el administrador con correo y contraseña y se ve el panel de inicio.

## 4. Fase 2 · Entorno de producción (Juanito; ~2 horas)

Mismo recorrido, con otras llaves y con estas diferencias:

1. Supabase `zammir-produccion`, **otra** contraseña de base y **otra** cuenta de administrador.
2. GitHub: entorno **`produccion`** con **Required reviewers** (una persona aprueba cada despliegue).
3. **Desplegar a Supabase** con entorno `produccion` (pide su aprobación).
4. Secretos de las funciones: `PORTAL_HASH_PEPPER` (otra cadena distinta) y **`BILLING_PROVIDER` sin valor**. `FACTURACION_ACTIVA` **sin definir**.
5. Rama `produccion` creada desde `main`. Vercel `zammir-produccion`, rama de producción `produccion`, con **las llaves del Supabase de producción** (mezclarlas es el error más caro: una tablet de pruebas escribiría en producción). **No** definir `VITE_FACTURACION`.
6. **Dominio:** en Vercel de producción, *Settings → Domains → Add* `sistema.zammir-solutions.com`; en Cloudflare, el `CNAME` que Vercel indique, en **solo DNS** (nube gris). Esperar a que Vercel lo muestre en verde y abrirlo con `https://`.
7. Anotar el dominio en `APP_PUBLIC_URL` (secreto de las funciones de producción) y en la guía de entrega.

**Listo cuando:** `https://sistema.zammir-solutions.com` carga, entra el administrador de producción y `salud` responde 200.

## 5. Fase 3 · Primera tablet (Juanito con la tablet; ~1 hora)

1. Abrir `https://sistema.zammir-solutions.com` en Chrome y **instalar la aplicación**.
2. Como administrador (en la computadora): **Usuarios** → dar de alta a dos personas de prueba con su PIN → **Generar código**.
3. En la tablet: **Conectar esta tablet** con el código y entrar con el PIN.
4. En **Configuración**, comprobar que aparecen los textos legales y los días de cuentas atrasadas.
5. **Prueba de modo avión:** cotizar y cobrar sin internet, volver a conectar y ver que lo guardado se envía.

**Listo cuando:** la venta hecha sin internet aparece en Reportes después de reconectar.

## 6. Fase 4 · Respaldos (Juanito; ~1 hora)

Antes de que exista **un solo dato que importe**. El plan gratuito no incluye respaldos de la plataforma, así que este es **el único respaldo** [PD-32].

1. En el entorno `produccion` de GitHub: secretos `SUPABASE_DB_URL` (Session pooler) y `CLAVE_DE_RESPALDO` (guardada también en el gestor).
2. **Actions → Respaldo nocturno → Run workflow**: debe dar un archivo `respaldo-zammir-AAAA-MM-DD.tar.enc`.
3. **Ensayar la restauración** de esa copia en el proyecto de **pruebas** (ver `RESTAURACION.md`) y anotar el resultado en su registro de ensayos.

## 7. Fase 5 · Pruebas físicas (Juanito, Luis y el equipo; S4-33, S5-05, S5-09)

**Equipo:** una o dos tablets, la impresora de Wi-Fi de Luis y un celular con WhatsApp.

| # | Prueba | Se ve bien cuando |
|---|---|---|
| 1 | **Impresora:** dar de alta la impresora en la tablet (Mopria o complemento del fabricante) | La tablet la encuentra |
| 2 | **Imprimir** una cotización, una venta, un comprobante de trabajo y un corte | Salen en hoja carta, con logo, sin cortes ni letras ilegibles; el segundo intento sale con **COPIA** |
| 3 | **Enviar por WhatsApp** esos mismos documentos | Llegan como PDF legible en el celular |
| 4 | Si la impresión falla a propósito (impresora apagada) | El sistema dice qué hacer y se puede guardar el PDF o mandarlo |
| 5 | **Recorridos E1 a E10** de `docs/calidad/PRUEBAS_DE_ACEPTACION.md` en la tablet real | Todos pasan; lo que falle va a la lista de hallazgos |
| 6 | **Tiempos** (S4-33): abrir el cotizador, emitir una cotización, cobrar una venta | Se sienten inmediatos; se anota lo que tarde |
| 7 | **Accesibilidad** (S4-33): letra, botones, contraste, uso con una mano | Se lee y se toca sin esfuerzo |
| 8 | **Dos tablets** al mismo tiempo (cobrar en una y mirar Reportes en la otra) | Los folios no chocan y los totales coinciden |

**Lista de hallazgos.** Cada problema se anota con: pantalla, qué se esperaba, qué pasó, hora, y una foto si ayuda (**sin datos reales ni llaves**). Se pasa a Claude, que lo corrige en una rama. **El arreglo se prueba primero en el entorno de pruebas** y después se lleva a producción fusionando `main` en `produccion` (con aprobación).

## 8. Fase 6 · Limpieza antes de la entrega

Producción se entrega **sin datos de prueba** (S4-26). **No se borran filas a mano:** la bitácora, el historial de precios y los documentos legales están protegidos contra borrado a propósito [RN-18], y esa protección no se desactiva.

El método se **ensaya primero en pruebas** y solo después se usa en producción:

1. **Opción A, restablecer la base** (`supabase db reset --linked`): vacía la base y vuelve a aplicar las migraciones. **Pendiente de comprobar en pruebas** qué pasa con las cuentas de administrador y con los archivos de fotos.
2. **Opción B, proyecto nuevo:** borrar `zammir-produccion` en Supabase y crear otro con el mismo nombre. Es lo más limpio, pero cambia las llaves: hay que volver a poner los secretos en GitHub y Vercel, redesplegar la base y volver a conectar el dominio.
3. Después de cualquiera de las dos: crear de nuevo el **administrador**, dar de alta a las **personas reales** y **reconectar las tablets** con códigos nuevos.

Antes de limpiar, **tomar un respaldo** y confirmar que la restauración funciona.

## 9. Fase 7 · Datos reales y entrega

Solo cuando las pruebas físicas pasaron y Luis aceptó lo probado:

- [ ] **Catálogo real** y reglas de precio (S5-03; PD-02 y PD-03).
- [ ] **Datos del negocio, garantía y textos legales** definitivos (PD-06, PD-11, PD-12).
- [ ] **Usuarios reales** con PIN propio (S5-04).
- [ ] **Aceptación firmada** por Luis (S5-10).
- [ ] **Capacitaciones** con Luis, Ricardo y el equipo de mostrador (S5-11 a S5-13).
- [ ] **Entrega:** el dominio queda a nombre de ZAMMIR, se entrega la guía de operación con los accesos por un canal seguro y se anotan las fechas de renovación (S5-14 a S5-16).

## 10. Lo que no se hace

- **Sin verificación en dos pasos:** Juanito decidió no usarla [ADR-0041]. Se compensa con contraseñas largas y distintas en un gestor, y con el cuidado de no compartir cuentas.
- **No** usar datos reales de clientes ni de precios de ZAMMIR antes de la fase 7.
- **No** correr `supabase config push` (empujaría el registro abierto de desarrollo al proyecto real).
- **No** mezclar llaves de pruebas con producción.
- **No** editar una migración que ya corrió: se corrige con otra nueva.
- **No** activar la facturación sin completar antes la lista de reactivación del ADR-0039.

## 11. Si algo sale mal

| Pasa esto | Se hace |
|---|---|
| La aplicación de producción no deja entrar o se ve vacía | Revisar que las variables `VITE_*` de Vercel sean las del Supabase **de ese entorno** y redesplegar |
| El despliegue de la base falla | Leer el paso que falló en Actions; no tocar la base a mano. Se corrige con una migración nueva |
| Un arreglo rompió algo en producción | En Vercel, *Promote* el despliegue anterior; después corregir en `main` |
| Se perdió información | `RESTAURACION.md` |
| Una tablet no conecta | Generar un código nuevo y repetir *Conectar esta tablet* |

## 12. Pendientes que afectan este plan

| Pendiente | Efecto |
|---|---|
| **PD-10** | Luis debe conocer y aprobar `zammir-solutions.com` |
| **PD-54** | Sin el modelo de la impresora no se cierra la prueba 1 de la fase 5 |
| **PP-33** | La `Content-Security-Policy` se agrega al final de la fase 5, probándola con la tablet; una política mal puesta rompe la conexión con Supabase |
| **PD-32** | El respaldo nocturno debe estar en verde antes de cualquier dato real |
