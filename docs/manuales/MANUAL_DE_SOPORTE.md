# Manual de soporte (borrador)

> Historia S4-29. Para **Juanito** (HummingX BI) y para quien lo releve. Cubre lo que hay que saber para desplegar, vigilar, dar de alta, resolver problemas, restaurar un respaldo y atender solicitudes sobre los datos de un cliente.
> Documento **interno** de HummingX: no forma parte del expediente que recibe ZAMMIR [ADR-0045]. Lo que depende de decisiones o del contrato está marcado con **(pendiente: …)** y su pendiente (`PD-xx` / `PP-xx`, ver [`PENDIENTES.md`](../producto/PENDIENTES.md)).
> Reglas que no se rompen: **nunca datos reales en pruebas**, **ningún agente de IA entra a producción** [RNF-19] y **el certificado (CSD) de ZAMMIR nunca pasa por el código**: se sube directo al proveedor de timbrado [RF-M10-02].

## 1. El sistema en una página

| Pieza | Qué es | Dónde vive |
|---|---|---|
| Aplicación | La que usan las tablets y la computadora. Funciona sin internet y guarda lo que se captura en la tablet. | Vercel |
| Base de datos y cuentas | Todos los datos, las cuentas de administradores y las tablets registradas. | Supabase (Postgres y Auth) |
| Funciones de servidor | Lo que no puede hacer la tablet: recibir operaciones, registrar tablets, registro de errores y salud. Las de facturación (facturar, cancelar, reintentar y el portal) están apagadas [ADR-0039]. | Supabase (Edge Functions) |
| Fotos de medición | Las fotos de cada orden que toma la tablet. | Supabase (depósito `order-photos`) |
| Proveedor de timbrado (PAC) | **En pausa** [ADR-0039]. Existe un proveedor **simulado** sin validez fiscal, solo para ensayar. | — |

Los detalles técnicos están en [`docs/arquitectura/`](../arquitectura/README.md). Cómo se pasa de una tablet a la base: [`SINCRONIZACION.md`](../arquitectura/SINCRONIZACION.md).

## 2. Cuentas y accesos

| Cuenta | Para qué | Quién |
|---|---|---|
| GitHub (`hummingxbi-source/zammir-solutions`) | Código, integración continua, despliegue de la base y respaldo nocturno. Público hasta la entrega; privado después (PD-59) | HummingX BI |
| Supabase (un solo proyecto, plan gratuito [ADR-0038, ADR-0043]) | Base de datos, cuentas, fotos y funciones | HummingX BI (organización "HummingX BI") |
| Vercel (plan gratuito) | Despliegue de la aplicación | HummingX BI |
| Cloudflare | Dominio `zammir-solutions.com` y DNS | HummingX BI |
| Proveedor de timbrado | En pausa [ADR-0039] | — |
| Monitoreo de disponibilidad | Avisar a HummingX si el servicio se cae | **Pendiente (PP-32)** |

Las cuentas, el dominio y el código son de HummingX BI; los datos son de ZAMMIR [ADR-0045]. Ninguna llave se guarda en el repositorio ni se pega en un chat [CLAUDE.md regla 7]. Quién tiene cada acceso: [guía de operación](../operacion/GUIA_DE_OPERACION.md) §7.

## 3. Desplegar

**Flujo normal** ([`ENTORNOS.md`](../arquitectura/ENTORNOS.md) §4):

1. Todo cambio entra por una rama y un Pull Request; nadie sube a `main` directamente.
2. La integración continua corre **toda** la compuerta de calidad (formato, lint, tipos, dependencias, pruebas, base de datos, integración, extremo a extremo, mutación y escaneo de secretos). Si algo está en rojo, no se fusiona.
3. Al fusionar a `main`, Vercel despliega a `https://sistema.zammir-solutions.com`. Los cambios de la base se suben con el flujo *Desplegar a Supabase*.
4. Al cerrar un sprint se prueba a mano en la tablet.
5. Hasta la entrega hay **un solo proyecto**, con datos inventados. En la entrega se borra y se crea uno nuevo vacío, con migraciones desde cero y llaves nuevas [ADR-0043].

**Migraciones.** Son archivos en `supabase/migrations/`, solo hacia adelante. Una migración que ya se aplicó en pruebas no se edita: se agrega otra. Las aplica la integración continua o Juanito con la CLI, nunca a mano en el panel.

**Variables de entorno.** Están listadas, sin valores, en `.env.example`. Los valores viven solo en los paneles de Vercel y Supabase y en los secretos de GitHub. Las más importantes:

| Variable | Dónde | Para qué |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Navegador | Conectar la aplicación con Supabase (públicas, protegidas por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo funciones de servidor | **Nunca** al navegador |
| `BILLING_PROVIDER` | Servidor | **Sin valor** mientras la facturación esté en pausa: no se emite nada [ADR-0039]. `simulated` solo para ensayarla (sin validez fiscal) |
| `INVOICE_RETRY_WAIT_SECONDS`, `INVOICE_RETRY_MAX_ATTEMPTS` | Servidor | Espera y tope de los reintentos de facturas (por omisión 120 s y 8 intentos) |
| `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY` | Servidor / navegador | Protección del portal contra automatización (opcional, PD-51) |
| `PORTAL_HASH_PEPPER`, `PORTAL_WINDOW_SECONDS`, `PORTAL_MAX_FAILS_*` | Servidor | Límites de intentos del portal |
| `VITE_APP_VERSION`, `APP_VERSION` | Navegador / servidor | Versión que se anota en cada error |

**Después de desplegar**, comprueba: la función `salud` responde (§6) y una tablet entra, cotiza y envía. *(Con la facturación activa, también que el portal `/factura` abra.)*

## 4. Altas de rutina

### Un administrador nuevo
1. En Supabase → *Authentication* → *Users*, crea la cuenta con correo y contraseña.
2. Asígnale el rol de administrador en los metadatos de la cuenta (`app_metadata`: `{"rol": "ADMIN"}`). Sin ese rol, el sistema le dice *"Esta cuenta no es de administrador"*.
3. Que entre a una sección de administración (por ejemplo **Usuarios**) para confirmar.

### Una persona del mostrador (cajero/vendedor o administrador en la tablet)
Un administrador entra a **Usuarios** → *Dar de alta a una persona*: nombre, rol y **PIN** (de 4 a 6 dígitos; los administradores usan más). Nadie se borra: se **desactiva**.
- **PIN olvidado:** **Restablecer PIN** → *PIN nuevo* → *Guardar PIN*.
- **Alguien ya no trabaja con ustedes:** **Desactivar**. Su historial se conserva.

### Una tablet nueva
1. Un administrador, en **Usuarios** → *Tablets*, toca **Generar código** (sirve **una sola vez** y vence en pocos minutos).
2. En la tablet, **Conectar esta tablet**: escribe el código y un nombre (por ejemplo, *Mostrador*).
3. La tablet debe **conectarse una vez a internet** para recibir el catálogo y la configuración; sin eso no puede cotizar.
- **Código vencido o ya usado:** genera otro.
- **Tablet perdida o robada:** en *Tablets*, **Revocar**. Deja de poder trabajar y se conserva su registro.
- **Reconectar la misma tablet:** primero *Olvidar el registro de esta tablet*, y luego un código nuevo.

## 5. Facturación

- **En pausa [ADR-0039].** El interruptor `FACTURACION` está **apagado** por omisión: no aparecen *Facturas*, el historial de facturas del cliente ni el portal `/factura`; los documentos no llevan QR y las funciones públicas del portal responden "no disponible" (404). Para reactivarla hay que prender **los dos lados**: `VITE_FACTURACION=true` en el navegador (Vercel) y `FACTURACION_ACTIVA=true` en las funciones de servidor (Supabase), y completar antes la lista de reactivación del ADR-0039 (datos fiscales del contador, PAC, CSD).

- **Simulada vs. real.** Con `BILLING_PROVIDER=simulated` las facturas son de prueba y **no tienen validez fiscal**. Antes de operar con datos reales hace falta el proveedor (PD-05) y el certificado de ZAMMIR subido **directo al proveedor** (PD-04). El adaptador del proveedor real es la historia S4-15 **(pendiente)**.
- **Facturas "en proceso".** Si el proveedor no contesta, la solicitud queda guardada completa y se reintenta con **el mismo identificador**, así que nunca se timbra dos veces. Un administrador puede tocar **Reintentar** en **Facturas** → **Emitidas**. La pasada automática la hace la función `reintentar-facturas` llamada con la llave de servicio; **programarla (cron) está pendiente (S4-26)**, por eso hoy los reintentos son manuales.
- **Cancelar una factura mal emitida.** Solo administradores, con uno de los motivos del SAT (01 a 04; el 01 pide el folio de la factura que la sustituye). Queda en la bitácora con motivo y quién la canceló. Nada se borra.
- **Timbres del año.** Se compara lo timbrado con el límite del paquete, que se guarda en el ajuste `stamps_yearly_limit` (y el porcentaje de aviso en `stamps_warning_percent`, 80 % por omisión). **Sin límite configurado no hay aviso** **(pendiente: cuántos incluye la anualidad, PD-26)**.
- **El cliente no encuentra su compra en el portal.** Puede que el documento todavía no haya llegado al servidor (la tablet envía al tener internet). Revisa en la tablet si hay operaciones **sin enviar**.
- **Factura global del público en general:** la hace el contador de ZAMMIR, no el sistema [ALCANCE §3].

## Impresión

- **Todo sale en hoja tamaño carta** [ADR-0040]. Ya no hay impresora de tickets, ni Bluetooth, ni ESC/POS.
- **Cómo imprime:** la aplicación abre una página de impresión y usa la impresión de Android de la tablet. La impresora debe ser de **Wi-Fi o red** y estar dada de alta en la tablet (Mopria o el complemento del fabricante). El modelo de la impresora de Luis sigue por confirmar (PD-54).
- **Si no imprime:** el usuario puede guardar el PDF o mandarlo por WhatsApp; el envío por WhatsApp es el camino principal y no depende de la impresora.
- **Marca COPIA:** la tablet recuerda qué documentos ya imprimió. Es solo local; el rastro de cada reimpresión en la bitácora está pendiente (PP-14).
- **Prueba en la tablet con la impresora real:** pendiente (S5-05).

## 6. Vigilar el sistema

### Disponibilidad
La función pública `salud` (`<dirección de Supabase>/functions/v1/salud`) responde `{"ok":true}` (200) si la base contesta y 503 si no. Un servicio de monitoreo la consulta cada pocos minutos y avisa a Juanito **(pendiente: elegir y crear esa cuenta, PP-32; hasta entonces no hay aviso automático)**.

### Errores
Los errores del navegador y de las funciones de servidor se guardan **sin datos personales** en la tabla `error_log` (se limpian correos, teléfonos, RFC, claves y consultas de direcciones, en el navegador y otra vez en el servidor) [ADR-0034].
- Se leen con la función `admin_error_log()` desde una sesión de administrador (por ahora, en el editor SQL de Supabase; una pantalla de errores es opcional, PP-32).
- Se purgan a los 90 días con `error_log_purge()` **(la programación del mantenimiento está pendiente, S4-26)**.
- Cuando el usuario ve *"Esta pantalla tuvo un problema"*, ya se registró el error: pídele la hora aproximada y la sección en que estaba, **no** sus datos personales.

### Bitácora
**Usuarios** → **Bitácora**: quién hizo qué, desde qué tablet y cuándo. Solo se consulta.

## 7. Respaldo y restauración

- **Meta** [RNF-21]: respaldos diarios con **al menos 30 días** de historial. El plan gratuito de Supabase no tiene respaldos [ADR-0038]: la única copia es el **respaldo nocturno** de GitHub (*Actions → Respaldo nocturno*), cifrado con `CLAVE_DE_RESPALDO` y con 30 días de vida.
- **Exportación del negocio (S5-08):** además del respaldo, un administrador puede llevarse todos los datos en CSV, JSON y PDF desde **Configuración** → **Exportar los datos**. No sustituye al respaldo (no trae los PIN ni las cuentas de acceso, y el PDF de cada factura se vuelve a generar), pero es una copia legible por cualquier programa. Los archivos traen datos personales: se guardan en un lugar seguro.
- **Qué se respalda:** los datos del esquema `public` (clientes, cotizaciones, órdenes, ventas, pagos, cortes y bitácora) y las cuentas de acceso (`auth.users` y `auth.identities`). Las **fotos de medición** van en otra copia cifrada, `fotos-zammir-…`; se guardan las dos más recientes [ADR-0046].
- **Restauración (recorrido E9).** El procedimiento completo, la lista de verificación y el registro de ensayos están en [`docs/operacion/RESTAURACION.md`](../operacion/RESTAURACION.md). En resumen: se restaura **siempre en un proyecto de Supabase limpio** (nunca encima del de producción), con las migraciones desde cero y luego los datos y las cuentas de la copia, y se comprueba que cada tabla quedó igual. Ya se ensayó en local con datos inventados (`pnpm ensayo:restauracion`, 28 tablas idénticas en menos de un minuto); el 25 nov se ensayó también con una **copia real de la nube**, restaurada en Supabase local (`scripts/ensayo-restauracion-nube.sh`, 69 s). Falta comprobar cómo vuelven a conectarse las tablets.
- Después de restaurar, las **tablets** probablemente deban conectarse otra vez con un código nuevo (un proyecto nuevo tiene otras llaves de sesión); lo que tuvieran sin enviar se conserva en la tablet. Los folios definitivos los asigna el servidor.

## 8. Solicitudes de un cliente sobre sus datos

Cualquier persona puede pedir **ver, corregir o cancelar** el uso de sus datos [RF-M9-04]. El canal visible es el correo o WhatsApp del negocio **(pendiente: correo del negocio, pregunta 63 a Luis)**.

1. **Registra la solicitud:** quién, cuándo, qué pide y por qué canal llegó. No pidas más datos de los necesarios.
2. **Comprueba quién es**: debe poder demostrar que es el cliente (por ejemplo, desde el WhatsApp registrado en su ficha).
3. **Ubícalo** en **Clientes** (búsqueda por nombre o WhatsApp) y revisa su ficha.
4. **Corregir:** edita la ficha. La bitácora conserva el cambio.
5. **Ver / copia de sus datos:** la copia de **un solo cliente** hoy se arma a mano con su ficha y sus documentos **(pendiente: PP-34)**. Lo que sí existe es la **exportación completa del negocio** (**Configuración** → **Exportar los datos**, solo administradores): CSV, JSON y PDF, sin PIN ni cuentas de tablets, y cada exportación queda en la bitácora. Si la persona pide *todos* sus datos y no hay forma de separarlos, no entregues la exportación completa: trae datos de todos los clientes.
6. **Cancelar el uso:** lo contable **no se borra** (ventas, órdenes, pagos y facturas solo se cancelan con motivo y rastro, RN-18). Qué datos personales se pueden quitar de un documento contable es una pregunta para el **asesor de ZAMMIR (pendiente)**; no improvises.
7. **Responde** por el mismo canal y guarda la fecha de respuesta.

El aviso de privacidad vigente se edita en **Configuración** (cada edición crea una versión nueva y las anteriores se conservan). El texto final lo valida el asesor de ZAMMIR **(pendiente)**.

## 9. Problemas frecuentes

| Qué pasa | Por qué | Qué hacer |
|---|---|---|
| La tablet dice que no puede cotizar | Le falta conectarse **una vez** a internet para recibir catálogo y configuración | Conectarla a internet unos minutos y abrir la aplicación |
| *"El código no sirve: no existe, ya se usó o ya venció"* | Los códigos de registro sirven una vez y vencen | Generar otro en **Usuarios** → *Tablets* |
| *"Esta tablet ya está conectada"* | Ya tiene registro | *Olvidar el registro* y generar un código nuevo, si de verdad se necesita |
| Una persona no puede entrar con su PIN | PIN olvidado o persona desactivada | **Usuarios** → *Restablecer PIN* / *Activar* |
| Hay operaciones *sin enviar* desde hace horas | La tablet no ha tenido internet | Conectarla; se envían solas. No borres datos de la tablet |
| *"Hay un problema con un documento. Avisa a soporte."* | El servidor rechazó una operación estructuralmente | Anotar el folio provisional y la hora; revisar `error_log` y la bitácora |
| El corte de caja puede cambiar | Hay operaciones sin enviar | Esperar a que lleguen al servidor antes de revisar el corte |
| Una cuenta por cobrar no se resalta como atrasada | La orden no se ha entregado (sale "Por entregar"), o desde la entrega pasaron menos días que el umbral | **Configuración** → *Cuentas por cobrar atrasadas* (1 a 365 días; por omisión 1, contados desde la entrega). La tablet recuerda el último valor para trabajar sin internet |
| Una factura está *En proceso* | El proveedor de timbrado no contestó | **Reintentar** en **Emitidas**; nunca se duplica |
| *"Esta cuenta no es de administrador"* | Falta el rol en la cuenta | Ver §4, *Un administrador nuevo* |
| El portal rechaza un folio | Ya facturado, fuera de plazo (fin de mes) o código incorrecto | Un administrador puede facturar desde **Facturas** aun fuera de plazo |
| La exportación dice *"No se pudieron preparar los datos"* | La base tardó más de 60 segundos o no contestó (con muchos años de datos puede pasar) | Intentar de nuevo; si sigue, avisar: hay que partirla por tablas (PP-34) |
| Sale *"Esta pantalla tuvo un problema"* | Error inesperado de una pantalla | Tocar **Volver a abrir**; lo guardado en la tablet no se pierde; avisar a Juanito con la hora |

## 10. Soporte a ZAMMIR

- Atención por **WhatsApp o correo, de lunes a viernes de 9:00 a 21:00** [ADR-0045]. Los datos de contacto van en el contrato y en la guía rápida. HummingX no compromete disponibilidad de 24 horas [RNF-20]. Las fallas de terceros (internet, nube, SAT, proveedor de timbrado) quedan fuera, pero el sistema sigue capturando sin internet y reintenta.
- Al reportar un problema, pide: **sección**, **hora aproximada**, **folio** (si hay) y **qué esperaba ver**. No pidas ni aceptes por chat contraseñas, PIN, llaves ni datos fiscales completos.

## 11. Lo que falta para cerrar este manual

| Falta | Depende de |
|---|---|
| Aviso automático de caídas | Cuenta del monitoreo (PP-32) |
| Probar la impresión en la tablet con la impresora de Wi-Fi de Luis | Modelo de la impresora (PD-54) y la tablet (S5-05) |
| Reintentos y purga programados | Mantenimiento programado (S4-26) |
| Proveedor de timbrado y certificado (al reactivar la facturación) | PD-04, PD-05, S4-15, [ADR-0039] |
| Comprobar la copia de las fotos con una foto real y la reconexión de las tablets después de restaurar | PD-57, S5-06 |
| Copia de los datos de un solo cliente, y partir la exportación completa si crece demasiado | PP-34 |
| Criterio para cancelar datos personales | Asesor de ZAMMIR |
