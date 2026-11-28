<!--
  Plantilla del documento HMX-ZAM-03 del expediente de entrega [ADR-0047].
  Las cifras entre corchetes ([…]) se llenan con lo que se corra EL MISMO DÍA de la entrega, sobre el commit que
  queda en producción; nunca se copian de otro documento. Cómo sacar cada una: sección "Cómo se llenan las cifras",
  al final. La versión llenada va en la carpeta local `privado/` y de ahí se exporta a PDF.
  Es un informe de HummingX: no lleva sellos ni la palabra "certificado".
-->

# Informe técnico de entrega

| | |
|---|---|
| **Documento** | HMX-ZAM-03 · versión 1.0 |
| **Para** | ZAMMIR, Soluciones en Vidrio y Aluminio |
| **Elaboró** | HummingX BI |
| **Sistema** | Sistema de gestión de ZAMMIR, versión `1.0.0` (commit `[commit]`) |
| **Lugar y fecha** | Otumba, Estado de México, a ____ de noviembre de 2026 |

Este informe explica, en tres partes, qué se entrega (ficha técnica), cómo se comprobó que funciona y que está protegido (calidad y seguridad), y qué pasa si algo falla (continuidad). Todo lo que aquí se afirma se puede comprobar en el código, en las pruebas automáticas o en la plataforma.

---

## Parte 1 · Ficha técnica

### Qué hace el sistema

| Módulo | Para qué sirve |
|---|---|
| **Cotizador** | Presupuestos en la tablet, en el local o en la obra, aun sin internet. Vidrio a medida, piezas, paquetes y cargos extra (cantos, perforaciones, biselados); cantidades con decimales (1.5 kg) y precio abierto. Se envían en PDF por WhatsApp |
| **Órdenes de trabajo** | Cada trabajo aceptado, con fecha de entrega, anticipo, saldo, entregas por partes, avance y garantía |
| **Mostrador y caja** | Ventas inmediatas en efectivo, transferencia o mixtas; turno por persona y corte de caja con explicación de diferencias |
| **Clientes** | Ficha con su historial y la marca de cliente recurrente |
| **Cuentas por cobrar** | Lo que falta por cobrar, contado desde la entrega, y la confirmación de transferencias |
| **Reportes** | Ventas del día, la semana y el mes en hora de la Ciudad de México, comparadas con el periodo anterior |
| **Catálogo** | Productos, precios con IVA incluido y categorías. Descripción, unidad de venta, claves del SAT, mínimos y medida máxima por producto; paquetes; duplicar; importación desde archivo, y precios en bloque por porcentaje o desde un archivo, con vista previa |
| **Usuarios** | Personas con PIN, roles, tablets registradas y bitácora de quién hizo qué |
| **Legal** | Aviso de privacidad y términos, con historial de versiones, y exportación de todos los datos del negocio |

**En pausa, fuera de esta entrega:** facturación electrónica (CFDI). Está construida y probada, y se activa cuando ZAMMIR tenga en orden sus datos fiscales.

### Cómo está hecho

| Pieza | Qué es |
|---|---|
| **Aplicación** | Aplicación web instalable en las tablets Android (PWA). Guarda lo capturado en la propia tablet y lo envía cuando hay conexión |
| **Servidor y base de datos** | Supabase: base de datos PostgreSQL, cuentas, almacenamiento de fotos y funciones de servidor |
| **Publicación** | Vercel, en `https://sistema.zammir-solutions.com`, por conexión segura (HTTPS) |
| **Dominio** | `zammir-solutions.com`, en Cloudflare, con renovación automática |
| **Código y respaldo** | GitHub: código, pruebas automáticas en cada cambio y respaldo nocturno |
| **Impresión** | Hoja tamaño carta con la impresión de Android, o PDF por WhatsApp |

### Cómo funciona sin internet

1. Todo lo que se captura (cotizaciones, ventas, cobros, órdenes) se guarda primero **en la tablet**.
2. Cuando hay conexión, la tablet lo envía al servidor, que vuelve a validar precios, totales y permisos.
3. Mientras no se envía, el documento lleva un **folio provisional**. Al llegar, el servidor le asigna el **folio definitivo**, sin duplicar nada aunque se reintente el envío.

### Quién puede hacer qué

| Rol | Qué hace |
|---|---|
| **Cajero / vendedor** | Cotiza, vende, cobra, avanza órdenes y hace su corte. Ve solo su propio corte |
| **Administrador** | Lo anterior y además da descuentos, autoriza excepciones con su PIN, ve reportes y cuentas por cobrar, y administra personas, tablets, catálogo y configuración |

---

## Parte 2 · Calidad y seguridad

### Pruebas automáticas

Cada cambio al sistema pasa por una **compuerta de calidad** con estas pruebas; la de mutación corre cuando el cambio toca las reglas del negocio. Si una falla, el cambio no entra. Cifras del ____ de noviembre de 2026, sobre el commit `[commit]`:

| Tipo de prueba | Qué comprueba | Resultado |
|---|---|---|
| Unidad y componentes | Reglas de dinero, IVA, folios, permisos y cada pantalla | [n] pruebas en [n] archivos · [aprobadas] |
| Base de datos | Seguridad de cada tabla, permisos, funciones del servidor y reglas que no se pueden romper | [n] pruebas en [n] archivos · [aprobadas] |
| Integración | La tablet y el servidor juntos, con y sin conexión: envío, folios, cobros y caja | [n] pruebas · [aprobadas] |
| Extremo a extremo | El sistema completo en un navegador, como lo usa una persona, incluida la accesibilidad | [n] pruebas · [aprobadas] |
| Mutación | Que las pruebas sí detecten errores en lo más delicado: se introducen errores a propósito en el cálculo de dinero, impuestos, precios, folios, caja y cobranza, y se mide cuántos atrapan | [n] % de errores detectados (mínimo exigido: 90 %) |
| Revisión estática | Formato, reglas de estilo, tipos y dependencias entre módulos | Sin hallazgos |

### Seguridad

| Qué se revisó | Resultado |
|---|---|
| **Seguridad por fila en todas las tablas** (cada persona solo ve lo que le toca) | [n] de [n] tablas protegidas. Lo comprueba una prueba automática que revisa **todas** las tablas, también las que se agreguen después |
| **Nada contable se borra** | Ventas, órdenes, pagos y bitácora no se pueden borrar desde la aplicación: solo se cancelan con motivo y queda el rastro |
| **Llaves y contraseñas** | Ninguna llave secreta viaja al navegador (revisión automática del paquete publicado: [resultado]) y un escaneo revisa cada cambio para que ninguna se suba al código |
| **PIN** | Nunca se guarda el PIN: solo una huella (*hash* con sal), con límite de intentos y bloqueo temporal |
| **Contraseñas de administrador** | De 12 caracteres o más, en cuentas personales; registro abierto apagado |
| **Dependencias** | Revisión de vulnerabilidades conocidas en las librerías que se publican: [resultado] |
| **Cabeceras del navegador** | Política de contenido (CSP), política de permisos y protección contra marcos, servidas por `https://sistema.zammir-solutions.com`: [resultado de la revisión del día] |
| **Datos personales** | Las pruebas usan solo datos inventados, y el registro de errores limpia correos, teléfonos y RFC antes de guardarlos |

### Lo que no se probó o tiene límites

Se dice aquí para que no haya sorpresas:

- **Volumen de varios años:** las pruebas usan cientos de documentos, no miles. El sistema está pensado para un solo local y se vigila su crecimiento.
- **Las tablets guardan las huellas de los PIN** para poder entrar sin internet. Si alguien roba una tablet, un administrador la **revoca** y se cambian los PIN de quienes la usaban.
- **Las cuentas de administrador no usan verificación en dos pasos.** Se compensa con contraseñas largas y personales.
- **Facturación:** no forma parte de esta entrega.
- **Restauración:** se ensayó con una copia de pocos datos y comparando el número de renglones de cada tabla. No se ha probado reconectar las tablets a un proyecto restaurado.
- [Agregar aquí lo que haya salido en las pruebas en el local y se haya aceptado como pendiente en el acta.]

---

## Parte 3 · Plan de continuidad

### Si se va el internet

**El trabajo no se detiene.** Las tablets siguen cotizando, vendiendo, cobrando y avanzando órdenes. Todo se guarda en la tablet con la leyenda *"Guardada en la tablet"* y se envía solo al volver la conexión. Lo único que necesita internet es entrar a las secciones de administración desde la computadora y registrar una tablet nueva.

### Si se pierde o se descompone una tablet

1. Si la tablet todavía enciende, se conecta a internet un momento para que envíe lo que tenga pendiente.
2. Un administrador entra a **Usuarios → Tablets** y la **revoca**: deja de poder trabajar.
3. Se cambian los PIN de quienes la usaban.
4. Se conecta otra tablet con un código nuevo, en minutos.

Lo que la tablet ya había enviado está a salvo en el servidor. Lo que no alcanzó a enviar solo existe en esa tablet.

### Si falla el servidor

- Las tablets siguen trabajando sin conexión (ver arriba).
- HummingX revisa el estado del servicio y lo restablece; si la plataforma pausa el proyecto por inactividad, se reactiva sin perder datos.
- El tiempo de atención es el que fija el contrato.

### Si se pierde o se daña información

| | |
|---|---|
| **Respaldo** | Una copia **cifrada** de toda la información cada noche, guardada **30 días**, más una copia aparte de las fotos de medición |
| **Cuánto se puede perder** | Lo capturado en el servidor desde el último respaldo: alrededor de un día, o algo más si esa noche la copia sale tarde. Lo que una tablet no haya enviado sigue en la tablet |
| **Restauración ensayada** | El [fecha] se restauró una copia real del respaldo en un entorno limpio de HummingX: [n] tablas con el mismo número de renglones que la copia, en [n] segundos |
| **Nunca encima de lo que hay** | Una copia siempre se comprueba primero en un entorno separado, y solo entonces se usa |

### Sus datos son suyos

ZAMMIR puede llevarse **toda** su información cuando quiera, desde **Configuración → Exportar los datos**, en archivos que abre cualquier programa (CSV, JSON y PDF).

### A quién avisar

| | |
|---|---|
| **Soporte de HummingX BI** | WhatsApp: [número] · Correo: [correo] |
| **Horario** | Lunes a viernes, de 9:00 a 21:00 |
| **Qué decir** | Qué pantalla, a qué hora y el folio, si lo hay. **Nunca** se manda un PIN ni una contraseña por mensaje |

---

<!--
## Cómo se llenan las cifras (el mismo día, sobre el commit de producción)

| Cifra | Comando o fuente |
|---|---|
| commit | `git rev-parse --short HEAD` en `main`, el mismo que sirve Vercel |
| Unidad y componentes | `pnpm test` (líneas "Test Files" y "Tests") |
| Base de datos | `pnpm db:reset && pnpm test:db` (total de pruebas y archivos de supabase/tests) |
| Integración | `pnpm test:integracion`, con las funciones servidas (`pnpm funciones:empaquetar` y `supabase functions serve --no-verify-jwt --env-file supabase/functions/pruebas.env`) |
| Extremo a extremo | `pnpm test:e2e` |
| Mutación | `pnpm test:mutacion:critico` (porcentaje y umbral que reporta) |
| Tablas protegidas | prueba 22 de pgTAP en verde (revisa `public` y `private`) y `select count(*), count(*) filter (where rowsecurity) from pg_tables where schemaname in ('public', 'private')` |
| Contraseñas de 12 o más | En el panel del proyecto recreado: *Authentication* → contraseñas de 12 caracteres o más y registro abierto apagado |
| Paquete publicado | `pnpm build && pnpm check:bundle` |
| Dependencias | `pnpm audit --prod --audit-level high` |
| Cabeceras | `curl -sI https://sistema.zammir-solutions.com` (Content-Security-Policy y Permissions-Policy) |
| Restauración | Último renglón del registro de `docs/operacion/RESTAURACION.md` §6 |
| Soporte | Datos del contrato (HMX-ZAM-01) |
-->
