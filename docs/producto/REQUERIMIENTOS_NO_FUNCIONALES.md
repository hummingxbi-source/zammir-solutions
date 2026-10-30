# Requerimientos no funcionales

> Fuente: [DC §9 y §10]. Cada requerimiento tiene un identificador `RNF-XX` para citarlo en historias, pruebas y revisiones.
> Las cifras (tiempos, tamaños, retención) son las del documento fuente; si alguna cambia, se registra con ADR.

## Funcionamiento sin internet [DC §9]

El internet del local es de Telmex, único proveedor, y la tablet de campo trabaja en casas de clientes.

**RNF-01 Qué funciona sin internet y qué no.**

| Funciona sin internet | Requiere internet |
|---|---|
| Cotizador completo, incluido el PDF | Primer inicio de sesión y registro de la tablet |
| Consulta del catálogo | Reportes |
| Ventas de mostrador | Facturación y portal de autofacturación |
| Cobros y anticipos | Sincronización |
| Avanzar el estatus de órdenes | Importaciones |
| Imprimir tickets por Bluetooth | Administración de usuarios |

**RNF-02 Implementación base.** PWA con service worker que guarda la aplicación en el dispositivo, y almacén local (IndexedDB) con copia del catálogo y una cola de operaciones pendientes. Detalle en `docs/arquitectura/SINCRONIZACION.md`.

**RNF-03 Sin duplicados.** Toda operación nace en el dispositivo con un UUID, para que reenviarla no produzca duplicados.

**RNF-04 Reintentos e indicador.** La sincronización reintenta con espera creciente. La pantalla muestra siempre: en línea, sin conexión, o N operaciones pendientes [RF-UX-06].

**RNF-05 Conflictos.**
- Ventas y pagos solo se agregan; nunca se pisan.
- El catálogo lo manda el servidor.
- Si dos personas editan la misma orden a la vez, **gana el último cambio por campo** y queda en bitácora.

**RNF-06 Datos locales mínimos.** Los datos locales pertenecen a dispositivos registrados. Se limita lo que se guarda en la tablet (**no se guardan datos fiscales de todos los clientes**) y se depura lo antiguo ya sincronizado.

**RNF-07 Prueba obligatoria.** Tablet en modo avión, 3 cotizaciones y 10 ventas; al reconectar: cero duplicados, folios correctos y totales exactos. Es la prueba de aceptación E3 (`docs/calidad/PRUEBAS_DE_ACEPTACION.md`).

## Seguridad [DC §10.1]

**RNF-08** HTTPS siempre.

**RNF-09** Contraseñas con hash mediante el servicio de autenticación. PIN con hash y sal, con límite de intentos [ADR-0013], PD-22.

**RNF-10** Seguridad a nivel de fila (RLS) en **todas** las tablas, con políticas por rol. Las claves de servicio solo viven en el servidor.

**RNF-11** Todas las reglas que importan (precios, totales, permisos, plazos) **se validan en el servidor**, no solo en la pantalla.

**RNF-12** Endpoints públicos (autofacturación) con límite de solicitudes y verificación contra automatización [RF-M10-11].

**RNF-13** Prácticas de desarrollo seguro (OWASP Top 10), dependencias actualizadas y entornos separados: desarrollo, pruebas (con el entorno de pruebas del PAC) y producción.

## Protección de datos personales [DC §10.2]

**RNF-14** ZAMMIR es el responsable del tratamiento; HummingX es el encargado, bajo confidencialidad. Aplica la Ley Federal de Protección de Datos Personales en Posesión de los Particulares vigente desde marzo de 2025; la autoridad pasó a ser la Secretaría Anticorrupción y Buen Gobierno. *(Dato del documento fuente; el texto legal final lo valida ZAMMIR con su asesor, PD-12.)*

**RNF-15** Datos que se tratan: nombre, teléfono, correo, domicilio de obra, datos fiscales (RFC, razón social, código postal y régimen), medidas y trabajos. No se prevén datos sensibles. **No se capturan datos que el negocio no necesite.**

**RNF-16** Finalidades: cotizar, ejecutar trabajos, garantía y facturación. Los datos no se venden, ceden ni usan para publicidad, perfilamiento ni para entrenar sistemas de inteligencia artificial.

**RNF-17** Proveedores técnicos que deben quedar declarados en el aviso: Vercel, Supabase y Cloudflare, el PAC cuando se factura, y Render solo si se llega a usar.

**RNF-18** Los incidentes que afecten datos se avisan a ZAMMIR a más tardar en **72 horas**.

**RNF-19** **Ningún agente de IA tiene acceso a datos reales de producción.**

## Disponibilidad, soporte y respaldos [DC §10.3]

**RNF-20** HummingX no compromete disponibilidad de 24 horas. Soporte por WhatsApp o correo en horario hábil. Las fallas de terceros (internet, nube, SAT, PAC) quedan fuera, pero el sistema **degrada con elegancia**: captura sin internet, mensajes claros y reintentos.

**RNF-21** Respaldos automáticos diarios con historial de **al menos 30 días**. Si la retención del plan de Supabase es menor, se programa una exportación nocturna a un almacenamiento externo con retención de 30 días (PD-32). Se prueba una restauración completa antes de la entrega.

**RNF-22** El cliente puede exportar sus datos en formatos estándar (CSV, JSON, PDF) al terminar la relación.

## Rendimiento [DC §10.4]

Volúmenes pequeños: cientos de operaciones por mes.

| RNF | Qué | Meta |
|---|---|---|
| RNF-23 | Carga inicial, en 4G y en la tablet objetivo | Menos de 3 segundos |
| RNF-24 | Interacciones | Sin retrasos perceptibles |
| RNF-25 | PDF de cotización | Menos de 3 segundos |
| RNF-26 | Ticket impreso tras cobrar | Menos de 5 segundos |
| RNF-27 | Reportes con 12 meses de datos | Menos de 3 segundos |

## Usabilidad y accesibilidad [DC §10.5]

**RNF-28** Botones y objetivos táctiles de **al menos 44 px**; texto de **al menos 16 px**; buen contraste.

**RNF-29** Navegación en el orden real del trabajo y ayuda contextual [RF-UX-01 a RF-UX-05].

**RNF-30** Operación con una mano en campo.

## Compatibilidad [DC §10.6]

**RNF-31** Chrome actual en Android 13 o superior (tablet objetivo) para toda la operación. Chrome en computadora y celular para consulta y reportes. iOS puede consultar reportes pero no imprime por Bluetooth.

## Mantenibilidad y observabilidad [DC §10.7]

**RNF-32** README con pasos de despliegue, variables de entorno documentadas y migraciones versionadas.

**RNF-33** Pruebas automáticas de las reglas críticas: precios y totales, redondeo, cortes de caja, folios, plazo de autofactura y permisos. Ver `docs/plan/00-principios-de-ingenieria.md` §4.

**RNF-34** Registro de errores de cliente y servidor **sin datos personales**, monitoreo simple de disponibilidad y aviso al responsable.

## Alcance técnico [DC §10.8, §11.2]

**RNF-35** Un negocio, un local, sin multi-sucursal. Sin sobreingeniería, pero tolerante a más usuarios y dispositivos sin rediseño.

**RNF-36** La configuración del negocio (nombre, logo, textos legales, folios, porcentajes) vive en una tabla de configuración, para facilitar reutilizar el sistema más adelante.

**RNF-37** Dominio de ZAMMIR en HTTPS, administrado por HummingX y transferible a ZAMMIR si lo pide. Como los QR impresos apuntan a ese dominio, **no puede cambiar después de empezar a imprimir**: las rutas públicas (como `/factura`) son estables (PD-10). DNS en Cloudflare [DC §11.1].
