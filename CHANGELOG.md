# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen [SemVer](https://semver.org/lang/es/).

## [1.0.0] — pendiente de etiquetar

> Todavía **no** está etiquetada. La versión `1.0.0` se etiqueta al entregar, cuando estén firmadas la aceptación de Luis y el acta de entrega (S5-15); mientras tanto los `package.json` siguen en `0.0.0`. Cómo se etiqueta: [`docs/entrega/ACTA_DE_ENTREGA.md`](docs/entrega/ACTA_DE_ENTREGA.md), sección "Publicar la versión". Al etiquetar, lo anotado abajo en "Sin publicar" (la documentación y las decisiones de las primeras fases) pasa a esta versión.
> Las facturas son **de prueba y sin validez fiscal** hasta conectar el proveedor de timbrado real y el certificado de ZAMMIR (PD-04, PD-05).

### Agregado

**Catálogo y precios**
- Catálogo de productos con categorías e historial de precios; los productos se desactivan, nunca se borran.
- Reglas de precio por área (m²), longitud, pieza y servicio, con medidas en centímetros o metros que se suben al múltiplo que se cobra.
- Importación del catálogo desde un archivo.
- Dinero en centavos enteros y precios con IVA incluido, con casos de oro de redondeo.

**Clientes**
- Fichas de cliente con datos de contacto y fiscales, su historial (cotizaciones, órdenes, ventas, pagos, garantías y facturas) y la marca de cliente recurrente.
- Anonimización de un cliente sin tocar lo contable.

**Personas, tablets y bitácora**
- Altas de personas con rol y PIN (con hash y sal, límite de intentos y bloqueo por inactividad).
- Registro de tablets con un código de un solo uso; revocar una tablet.
- Bitácora de lo que hace cada persona, desde qué tablet y cuándo.

**Cotizador (funciona sin internet)**
- Cotizaciones con cliente, conceptos, descuentos con el PIN de un administrador, vista previa del documento, PDF y envío por WhatsApp.
- Folios provisionales en la tablet y definitivos en el servidor, sin duplicados al reconectar.

**Órdenes de trabajo y cuentas por cobrar**
- Conversión de una cotización aceptada, anticipo, saldo, garantía y estatus, con autorizaciones de administrador para lo excepcional.
- Comprobante de trabajo en PDF con QR para pedir la factura.
- Cuentas por cobrar, de la más atrasada a la más reciente.

**Mostrador y caja**
- Venta rápida con ticket; cobro en efectivo, transferencia o mixto, con cambio.
- Ticket térmico con QR e impresión por Bluetooth en tres capas.
- Turnos de caja y corte por cajero, con el consolidado del día para administradores.

**Reportes e inicio**
- Reportes de ventas por día, semana (de lunes a domingo) y mes, en hora de México y con comparativo; por medio de pago y por persona; lo más vendido; trabajos por estatus.
- Panel de inicio según quién entró, "Primeros pasos" y botón "¿Por dónde empiezo?"; el inicio del cajero muestra su turno abierto y lo que falta por enviar.

**Legal y facturación**
- Aviso de privacidad y términos del servicio versionados, y canal para ejercer derechos.
- Facturar desde el sistema (administradores); portal público de autofacturación con respuesta uniforme y límites contra abuso; cancelación con motivo del SAT; reintentos sin duplicar el timbre; anticipos y control de timbres del año. Proveedor de timbrado **simulado**.

**Operación y seguridad**
- Registro de errores sin datos personales y comprobación de salud para el monitoreo.
- Exportación de los datos del negocio en CSV, JSON y PDF, sin PIN ni credenciales.
- Revisión de seguridad automatizada (RLS en todas las tablas, permisos, secretos y dependencias) y ensayo de restauración de un respaldo.

**Documentación**
- Manual de usuario con capturas, manual de soporte, guía de operación, guía de restauración y plan de pruebas de aceptación con el cliente.

### Pendiente para la entrega

- Conectar el proveedor de timbrado real y el certificado de ZAMMIR (PD-04, PD-05).
- Producción, dominio y variables (PD-10); respaldos con 30 días y su ensayo en producción (PD-32).
- Catálogo, parámetros y ajustes reales, y las pruebas con el equipo real (tablets e impresora).
- Capacitación y aceptación firmada.

## [Sin publicar]

### Cambiado
- Inicio y Reportes pasan de tarjetas con texto a tableros: franja de cifras clave con la variación contra el periodo anterior, tendencia de 31 días en área con eje de valores, dona de medios de pago y de producción, columnas de cobros por persona y barras de antigüedad de saldos. Las explicaciones largas pasan al icono de ayuda y los atajos a las secciones se pliegan cuando hay cifras. Todo en SVG y CSS, sin librerías, con la leyenda y una tabla equivalente en texto para los lectores de pantalla.

### Agregado
- Documentación base de la Fase 1: alcance, reglas de negocio, requerimientos, glosario, pendientes, hoja de ruta y guías del repositorio.
- Decisiones ADR-0001 a ADR-0010.
- Plan de construcción en `docs/plan/`: principios de ingeniería, estrategia de pruebas, compuertas de calidad y una guía por cada fase (0 a 9).
- Pendiente PD-25 (medición del metro lineal).
- Fase 2: ADR-0011 (redondeo) y ADR-0012 (sincronización) aceptadas; ADR-0013 (autenticación, aceptada) y ADR-0014 (estructura y herramientas) como propuestas; casos de oro de dinero; borradores de `AUTENTICACION.md` y `ARCHITECTURE.md`.
- Borradores de `MODELO_DE_DATOS.md` (con trazabilidad requerimiento → entidad) y `SINCRONIZACION.md`; ADR-0015 y ADR-0016 como propuestas.
- PD-21 a PD-24 (valores de sesión de administrador y de intentos de PIN).

- Documento de construcción completo (§0 a §17) en `docs/contexto/`; resuelve PD-01.
- M10 completo (RF-M10-01 a RF-M10-21), experiencia de usuario (RF-UX-01 a RF-UX-10) y reglas RN-21 a RN-28.
- `REQUERIMIENTOS_NO_FUNCIONALES.md` (RNF-01 a RNF-37), `RIESGOS.md` (R1 a R15) y `docs/calidad/PRUEBAS_DE_ACEPTACION.md` (E1 a E10).
- ADR-0017 (reconciliación con el documento completo) y ADR-0018 (impresión de tickets en tres capas).
- Pendientes PD-26 a PD-35, incluido el calendario (PD-34).
- Referencia de la demo (`docs/producto/DEMO_REFERENCIA.md`) y revisión de negocio con reglas propuestas (`docs/producto/REVISION_DE_NEGOCIO.md`), con lo que Juanito contó el 27 de octubre. Preguntas para Luis PD-36 a PD-47 y propuestas PP-01 a PP-19 en `PENDIENTES.md`. Riesgos R16 y R17.

- Backlog de la Fase 3 en `docs/backlog/` (143 historias en los sprints S0 a S5, trazabilidad y análisis de capacidad). Borrador a la espera de la aprobación de Juanito.

- Borradores de `docs/arquitectura/ENTORNOS.md` y `docs/calidad/TESTING.md` (Fase 2), necesarios para el Sprint 0.

### Cambiado
- ADR-0014 (estructura y herramientas) aceptada.
- Calendario decidido (PD-34): se mantiene el plan actual de sprints con recortes desde ahora [ADR-0019]. ADR-0014 actualizada: la impresión de tickets ya no está "sin elegir" [ADR-0018].
- ADR-0009 (idioma del código) aceptada; PD-18 resuelto.
- Plan de fases actualizado con el documento completo: prueba de concepto de impresión, M10 en el Sprint 4, entrega en el Sprint 5, feriado del 16 de noviembre y lista de lo que la arquitectura debe absorber (Fase 2).
- `ALCANCE.md`, `GLOSARIO.md`, `PENDIENTES.md` y `SECURITY.md` al día con el documento completo.
