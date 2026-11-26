# Guía de operación

> Historia S5-14 · requerimientos RNF-20 y RNF-32 · [DC §13]. Para **HummingX BI** y quien la releve: cómo se mantiene ZAMMIR funcionando una vez entregado.
> Documento interno de HummingX: no forma parte del expediente que recibe ZAMMIR [ADR-0045]. Lo que depende del contrato está marcado **(pendiente: …)**.
> Esta guía es el **índice de operación**: el detalle está en el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) y en la [guía de restauración](RESTAURACION.md).

## 1. Qué hace falta saber (en una página)

| | |
|---|---|
| **Qué es** | Cotizador y mostrador en tablet que funcionan **sin internet**, con órdenes de trabajo, cuentas por cobrar y reportes. Una sola vidriería, en Otumba. La facturación está construida pero **en pausa** [ADR-0039]. |
| **Dónde vive** | Aplicación en **Vercel** (`https://sistema.zammir-solutions.com`); base de datos, cuentas, fotos y funciones de servidor en **Supabase**. Los dos en plan gratuito [ADR-0038]. Dominio en **Cloudflare**. Código, despliegue de la base y respaldo en **GitHub**. |
| **De quién es** | Las cuentas, el dominio y el código son de **HummingX BI**. Los datos son de **ZAMMIR**, y HummingX los trata por su cuenta [ADR-0045]. |
| **Qué se rompe primero** | Casi nada de lo que ve el mostrador: la tablet guarda lo capturado y lo envía cuando vuelve la conexión. Lo que sí requiere servidor es entrar a las secciones de administración y registrar tablets. |
| **Regla de oro** | Los datos reales **nunca** se usan en pruebas y **ningún agente de IA** entra a producción [RNF-19]. |

## 2. Rutina

### Cada día (2 minutos)
- [ ] Abrir `<dirección de Supabase>/functions/v1/salud`: debe responder `{"ok":true}`. Un monitoreo externo podría avisar solo **(pendiente: cuenta del monitoreo, PP-32)**.
- [ ] Si alguien reportó un problema, pedir **sección, hora y folio** (nunca PIN ni contraseñas) y revisar `error_log` (§6 del manual de soporte).

### Cada semana (10 minutos)
- [ ] **Respaldo:** en GitHub, **Actions → Respaldo nocturno**, la última corrida debe ser de las últimas 24 horas, estar en verde y dejar sus dos copias (`respaldo-zammir-…` y `fotos-zammir-…`). GitHub puede retrasar varias horas una corrida programada; si una no salió, correrla a mano (*Run workflow*).
- [ ] **Errores:** `select * from public.admin_error_log(100)` desde una sesión de administrador (o el editor SQL de Supabase). Un error que se repite se atiende; uno aislado se anota.
- [ ] **Tablets:** en **Usuarios → Tablets**, la columna *Último envío* de cada una debe ser reciente. Una tablet que lleva días sin enviar tiene capturas sin llegar.

### Cada mes
- [ ] **Límites del plan gratuito:** en el panel de Supabase, el uso de la base y del almacenamiento de fotos (PD-58). Después de pasar el repositorio a privado, los minutos de Actions en GitHub (*Settings → Billing*): son 2,000 al mes y, si se acaban, el respaldo también se detiene (PD-59).
- [ ] **Dependencias:** `pnpm audit --prod` sin hallazgos graves (también corre en cada Pull Request).
- [ ] **Limpieza del registro de errores** a los 90 días: `select public.error_log_purge(90)` **(pendiente: programarla, S4-26)**.
- [ ] **Una exportación de los datos** (Configuración → Exportar los datos) guardada en un lugar seguro, como copia legible adicional (no sustituye al respaldo).
- [ ] **Mientras el repositorio sea público:** GitHub apaga los flujos programados de un repositorio público si pasan 60 días sin actividad. Revisar que *Respaldo nocturno* siga activo.

### Cada año y en fechas fijas
- [ ] **Dominio** `zammir-solutions.com`: renovación automática en Cloudflare; anotar la fecha y revisar que el medio de pago siga vigente.
- [ ] **Ensayo de restauración** de un respaldo (E9): al menos una vez al año y después de cambios grandes. Ver [RESTAURACION.md](RESTAURACION.md).
- [ ] *Al reactivar la facturación [ADR-0039]:* vencimiento del certificado de sello digital (CSD) de ZAMMIR y renovación del proveedor de timbrado.

## 3. Desplegar

El detalle está en el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §3. En corto:

1. Todo cambio entra por **rama y Pull Request**; la integración continua corre toda la compuerta de calidad (formato, lint, tipos, dependencias, pruebas, base de datos, integración, extremo a extremo, mutación, escaneo de secretos y del paquete del navegador, auditoría de dependencias). Con algo en rojo **no se fusiona**.
2. Al fusionar a `main`, Vercel despliega a `https://sistema.zammir-solutions.com`. Los cambios de la base y de las funciones se suben con el flujo *Desplegar a Supabase*.
3. Después de la entrega hay **un solo proyecto**, con los datos reales, y **no hay entorno de pruebas en la nube**. Los cambios se prueban en Supabase local, en el CI y en la vista previa de Vercel, que **no** tiene llaves de la base [ADR-0043].
4. Las migraciones van **solo hacia adelante**: una migración ya aplicada nunca se edita.
5. Después de desplegar: `salud` responde y una tablet entra, cotiza y envía.

**Si un despliegue sale mal:** en Vercel se vuelve a la versión anterior de la aplicación (*Promote*). Una migración **no se deshace**: se corrige con otra migración hacia adelante.

## 4. Restaurar un respaldo

Procedimiento, lista de verificación y registro de ensayos: **[RESTAURACION.md](RESTAURACION.md)**. Siempre en un entorno **limpio**, nunca encima del de producción. Ya se ensayó en local (`pnpm ensayo:restauracion`); **falta ensayarlo con una copia real de la nube**, incluidas las fotos de medición [ADR-0046].

## 5. Rotar claves

Rotar es cambiar una llave por otra nueva, porque se filtró, porque alguien que la conocía ya no trabaja con ustedes o por rutina. **Siempre**: crear la nueva, actualizarla en todos los lugares, comprobar y **solo entonces** revocar la vieja. Los nombres exactos de los menús de Supabase y Vercel pueden cambiar: **verifícalos en el panel antes de tocar nada**.

| Llave | Dónde vive | Qué pasa al cambiarla | Cómo |
|---|---|---|---|
| **Contraseña de un administrador** | Supabase Auth | Solo esa persona vuelve a entrar | La aplicación no tiene pantalla para cambiarla: se restablece desde el panel de Supabase y la persona escribe la nueva en persona [ADR-0045]. Si se sospecha de la cuenta, revisar la bitácora |
| **PIN de una persona** | Base (con hash y sal) | Solo esa persona | **Usuarios → Restablecer PIN** |
| **Llave de servicio de Supabase** (`SUPABASE_SERVICE_ROLE_KEY`) | La entrega Supabase a las funciones; no está en GitHub ni en Vercel | Las funciones usan la nueva al volver a desplegarlas | Generar la nueva en el panel de Supabase; volver a correr *Desplegar a Supabase*; probar `salud` y que una tablet envíe; revocar la vieja |
| **Llave pública** (`VITE_SUPABASE_ANON_KEY`) | Variable de Vercel, solo en *Production* (visible en el navegador, protegida por RLS) | La aplicación deja de conectarse hasta volver a desplegar | Cambiarla en Vercel y volver a desplegar; las tablets la toman al actualizar la aplicación |
| **Secreto JWT del proyecto** | Supabase | **Cierra todas las sesiones y obliga a reconectar cada tablet** con un código nuevo | Solo ante una filtración grave; avisar antes al mostrador |
| **Token de la cuenta de Supabase** (`SUPABASE_ACCESS_TOKEN`) | Secreto del entorno de despliegue en GitHub | El despliegue falla hasta actualizarlo | Es un token de la **cuenta**: alcanza también el otro proyecto. Generar uno nuevo, actualizarlo en GitHub y revocar el viejo en Supabase |
| **Conexión de la base del respaldo** (`SUPABASE_DB_URL`) | Secreto del entorno del respaldo en GitHub | El respaldo falla hasta actualizarla | Cambia si cambia la contraseña de la base. Actualizarla y correr el respaldo a mano |
| **Clave del respaldo** (`CLAVE_DE_RESPALDO`) | Secreto del entorno del respaldo en GitHub y gestor de contraseñas | Las copias nuevas se cifran con la nueva; **las viejas solo abren con la vieja** | Guardar las dos en el gestor hasta que venzan las copias viejas (30 días) |
| **Llave S3 del almacenamiento** (`SUPABASE_S3_ACCESS_KEY_ID` y `SUPABASE_S3_SECRET_ACCESS_KEY`) | Secretos del entorno `respaldo` en GitHub | La copia de las fotos falla hasta actualizarla | Lee y escribe todo el almacenamiento del proyecto. Crear una nueva en Supabase → Storage → S3 Configuration, actualizar los dos secretos, correr el respaldo a mano y borrar la vieja |
| **Pimienta del portal** (`PORTAL_HASH_PEPPER`) | Secreto de las funciones | Se olvidan los intentos fallidos acumulados (no daña nada) | Cambiarla; no requiere más |
| *Al reactivar la facturación:* llaves del PAC, de Turnstile y el CSD | Secretos de las funciones y el PAC | No se puede facturar hasta actualizarlas | Ver el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §5 y [ADR-0039] |

**Después de cualquier rotación:** `salud` responde, una tablet cotiza y envía, un administrador entra a **Usuarios**, y se anota fecha y motivo en el registro de accesos (§7).

## 6. Atender una solicitud de datos de un cliente

Procedimiento paso a paso en el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §8: registrar la solicitud, comprobar quién es, ubicarlo en **Clientes**, corregir o dar una copia y responder por el mismo canal. Dos cosas que conviene tener claras:

- La **copia de los datos de un solo cliente** hoy se arma a mano desde su ficha **(pendiente: PP-34)**. **No** se entrega la exportación completa del negocio: trae datos de todos.
- Lo contable (ventas, órdenes y pagos) **no se borra** [RN-18]. Qué datos personales se pueden quitar de un documento contable lo decide el asesor de ZAMMIR **(pendiente)**; no se improvisa.

## 7. Accesos y cómo se entregan

Titularidad [ADR-0045]: las cuentas de la plataforma, el dominio y el código son de **HummingX BI**; los datos son de **ZAMMIR**.

| Acceso | Para qué | Titular | Quién entra |
|---|---|---|---|
| **GitHub** (repositorio y Actions) | Código, integración continua, despliegue de la base y respaldo | HummingX BI | Los socios de HummingX, cada uno con su cuenta |
| **Supabase** | Base de datos, cuentas, fotos y funciones | HummingX BI (organización "HummingX BI") | Los socios de HummingX |
| **Vercel** | Despliegue de la aplicación | HummingX BI | Los socios de HummingX |
| **Cloudflare** | Dominio `zammir-solutions.com` y DNS | HummingX BI | Los socios de HummingX |
| **Cuentas de administrador del sistema** | Administrar el negocio | ZAMMIR | Luis y Ricardo, cada uno la suya. Las crea HummingX en el panel con ellos presentes y **cada uno escribe su propia contraseña**; HummingX no la conoce [ADR-0045] |
| **Personas con PIN en la tablet** | Cotizar, cobrar y trabajar las órdenes | ZAMMIR | Luis y Ricardo (administradores) y la persona del mostrador (Cajero / vendedor). Cada quien escribe su PIN en persona |

**Reglas:**
1. Las contraseñas, llaves y PIN **nunca** se mandan por chat, por correo ni se guardan en el repositorio. Las llaves de la plataforma viven solo en los paneles y en el gestor de contraseñas de HummingX.
2. **Una cuenta por persona**; nada de contraseñas compartidas. Contraseñas largas y distintas; no se usa verificación en dos pasos [ADR-0041].
3. **Registro de accesos:** el anexo B del acta de entrega anota qué recibió ZAMMIR. Para las cuentas de la plataforma, una tabla interna con *quién, a qué, desde cuándo y quién lo concedió*. Al terminar la relación con alguien se revoca el mismo día y se anota.
4. Ningún agente de IA recibe accesos de producción [RNF-19].

## 8. Plan de soporte

Lo que ya está fijado [RNF-20, ADR-0045]: **no** se compromete disponibilidad de 24 horas, y las fallas de terceros (internet, nube, SAT) quedan fuera, aunque el sistema sigue capturando sin internet y reintenta.

| Punto | Estado |
|---|---|
| Canales | WhatsApp y correo de soporte de HummingX. Los datos de contacto van en el contrato y en la guía rápida, no en el repositorio |
| Horario | **Lunes a viernes, de 9:00 a 21:00** |
| Tiempo de primera respuesta y de solución | **(pendiente: lo que fije el contrato; esta guía no inventa plazos)** |
| Qué incluye el servicio después de la entrega | **(pendiente: según el contrato, criterio de S5-14)** |
| Qué se cobra aparte | **(pendiente: según el contrato)** |

Al reportar un problema se pide: **sección**, **hora aproximada**, **folio** (si hay) y **qué esperaba ver**. Nunca PIN, contraseñas ni llaves por mensaje.

## 9. Si pasa algo grave

| Qué pasó | Qué hacer |
|---|---|
| **El servicio no responde** (`salud` en 503 o sin respuesta) | Revisar el estado de Supabase y Vercel; el mostrador sigue capturando sin internet. Avisar a ZAMMIR. Si Supabase pausó el proyecto, reactivarlo desde el panel. Si es de la base, ver la restauración |
| **Se perdió o robaron una tablet** | **Usuarios → Tablets → Revocar**. Cambiar los PIN de quienes la usaban. Revisar la bitácora de esa tablet |
| **Se sospecha que alguien vio datos que no debía** | Cambiar las contraseñas y PIN involucrados, revisar la bitácora y `error_log`, rotar las llaves que correspondan (§5) y avisar a ZAMMIR. Si hay datos personales expuestos, **consultar al asesor de ZAMMIR sobre la obligación de avisar** **(pendiente)** |
| **Se borró o dañó información** | Comprobar la copia en Supabase local y restaurar con [RESTAURACION.md](RESTAURACION.md); no tocar producción hasta comprobarla |
| *Con la facturación activa:* una factura mal emitida o un proveedor de timbrado que no contesta | Ver el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §5 |

## 10. Lo que falta para cerrar esta guía

| Falta | Depende de |
|---|---|
| Aviso automático de caídas | Cuenta del monitoreo (PP-32) |
| Purga de errores programada | Mantenimiento programado (S4-26) |
| Comprobar la copia de las fotos con una foto real | PD-57 |
| Ensayo de restauración con una copia de la nube | S5-06 |
| Repositorio privado y vigilancia de minutos de Actions | PD-59 |
| Tiempos de respuesta y alcance del soporte | El contrato |
| Criterio legal para cancelar datos personales y para avisar de una exposición | Asesor de ZAMMIR |
