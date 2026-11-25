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
- Las listas del administrador (productos, clientes y facturas) se leen por páginas y no se cortan a las 1000 filas (AJ-01).
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
- Fecha estimada de entrega obligatoria al crear la orden; las órdenes vencidas salen como **Atrasadas**, con su filtro y su conteo en el panel de inicio (AJ-03, RF-M3-09).
- Comprobante de trabajo en PDF con QR para pedir la factura.
- Cuentas por cobrar, de la más atrasada a la más reciente.
- Las cuentas por cobrar cuentan los días **desde la entrega** y salen atrasadas desde el día siguiente (umbral de 1 día por omisión, configurable); lo que no se ha entregado aparece como "Por entregar". La hora de la entrega es la de la tablet, aunque se haya entregado sin internet (AJ-04, ADR-0044).

**Mostrador y caja**
- Venta rápida con ticket; cobro en efectivo, transferencia o mixto, con cambio.
- Ticket térmico con QR e impresión por Bluetooth en tres capas.
- Turnos de caja y corte por cajero, con el consolidado del día para administradores.

**Reportes e inicio**
- Reportes de ventas por día, semana (de lunes a domingo) y mes, en hora de México y con comparativo; por medio de pago y por persona; lo más vendido; trabajos por estatus.
- Panel de inicio según quién entró, "Primeros pasos" y botón "¿Por dónde empiezo?"; el inicio del cajero muestra su turno abierto y lo que falta por enviar.
- Contenidos de las secciones, segunda pasada de la revisión en pruebas: opción de ocultar la barra de navegación para que la sección ocupe toda la pantalla (se recuerda en la tablet); bloques de Configuración y Usuarios en tarjetas con aire entre sus partes y los botones separados de los campos; importar el catálogo por pasos, con el selector de archivo con el aspecto de la aplicación; formularios en columnas; cifras de arriba de cada sección en su tarjeta; turnos y corte del día uno debajo del otro; filtros que ya no se montan; el botón "¿Por dónde empiezo?" se reduce al ícono fuera del inicio; las pantallas que piden el PIN o conectar la tablet llevan encabezado y botón principal.
- Entrada ordenada tras la revisión en pruebas: "Panel de inicio" en la navegación; el acceso del administrador (correo y contraseña) arriba a la derecha en todas las pantallas, una sola vez; pantalla del PIN con tarjetas por persona, texto de ayuda y teclado de 3×4; conexión de la tablet en tarjeta, sin el botón de conectar cuando ya está conectada; barra "Está usando la tablet" bien separada; "Primeros pasos" en filas alineadas; tras entrar con el PIN se vuelve a la sección donde se estaba; corregido el hueco arriba del contenido en tablet vertical.

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

### Agregado
- **Recorrido guiado** [RF-UX-04, ADR-0042]: un recorrido por todo el sistema que oscurece la pantalla menos la parte que explica, con un globo paso a paso (bienvenida, formas de entrar, inicio, las secciones del trabajo y de administración, conexión, cuenta y ayuda). Aparece la primera vez en cada equipo y se repite con el botón **Recorrido guiado** de la barra.
- **¿Cómo se entra?** en el inicio: las tres formas de entrar (tablet, persona con PIN y administrador) explicadas, con su botón, y el orden de la configuración inicial.
- **Configuración: días para marcar una cuenta por cobrar como atrasada** (PD-33). Solo el administrador lo cambia (de 1 a 365; 10 por omisión). Lo usan Cuentas por cobrar, Reportes y el panel de inicio, y la tablet recuerda el último valor para funcionar sin internet.

### Cambiado
- **Reportes: las ventas se comparan contra el mismo tramo del periodo anterior** (PP-13, aprobada): a mitad de mes se compara con los mismos días del mes pasado, no con el mes completo. El periodo completo sigue disponible en el dominio como opción.
- **Se retira la impresora térmica** [ADR-0040]: ya no existen el ticket de 80 mm, la conexión Bluetooth (ESC/POS), el panel de impresora ni sus pruebas; todo lo que se imprime sale en hoja carta con la impresión de Android. En Mostrador desaparece el panel "Impresora de tickets" y la descripción del panel de inicio habla de enviar o imprimir el comprobante. La palabra "ticket" se conserva solo para la venta en curso. Pendiente para cuando se reactive la facturación: el portal aún dice "Folio de su ticket" y debería decir "comprobante".
- **Explicación de la diferencia del corte** [RF-M4-09, ADR-0044]: si sobra o falta efectivo, aunque sea un centavo, el turno no se cierra sin una explicación escrita; queda en la hoja del corte, en la tabla de turnos y en la bitácora. Un cierre viejo sin explicación que llegue de una tablet queda por revisar (AJ-02).
- **Corte de caja en hoja carta** [ADR-0040]: el resumen del corte (fondo, ventas de mostrador, anticipos y saldos de órdenes, efectivo y transferencias, efectivo esperado, contado y diferencia como sobrante, faltante o exacto, y ventas canceladas aparte) sale en una hoja carta con el logo, y se envía por WhatsApp o se imprime con los mismos dos botones. Se puede sacar al cerrar el turno y después, con "Ver corte", desde la tabla de turnos cerrados. Sustituye al ticket térmico del corte. El consolidado del día no se imprime por ahora.
- **"Enviar por WhatsApp" e "Imprimir" juntos** [ADR-0040]: en la cotización, el detalle de la orden y el mostrador (al cobrar y en "Ventas de hoy") el envío por WhatsApp es el botón principal e "Imprimir" va a su lado. Imprimir usa el servicio de impresión de Android con una página tamaño carta con logo (no el PDF, que Android no imprime de forma confiable); si no se puede, dice qué hacer. Una venta que se imprime por segunda vez sale marcada COPIA. Una venta sin cliente se manda por WhatsApp eligiendo el contacto. Los botones del ticket térmico de una venta salen del mostrador; el resto del código térmico se retira en S4-38.
- **Comprobante en hoja carta con logo** [ADR-0040]: las cotizaciones y los comprobantes de trabajo llevan ahora el logo de ZAMMIR (un archivo de la aplicación que también se ve sin internet), con encabezado, tabla y totales en el verde de la marca. Una venta de mostrador tiene su propio comprobante en hoja carta con el detalle, los pagos, el cambio y quién atendió. El filete entre renglones ya no cruza el texto. Los botones para enviarlo e imprimirlo llegan en S4-37.
- **Facturación en pausa** [ADR-0039]: el interruptor `FACTURACION` (variable `VITE_FACTURACION` en el navegador y secreto `FACTURACION_ACTIVA` en el servidor) está apagado por omisión. Apagado, no hay sección Facturas, ni historial de facturas del cliente, ni portal `/factura`; las funciones públicas del portal contestan "no disponible"; y el comprobante de trabajo y el ticket no llevan QR, código ni leyenda de autofacturación. Encendido, todo vuelve a funcionar igual.
- Inicio y Reportes pasan de tarjetas con texto a tableros: franja de cifras clave con la variación contra el periodo anterior, tendencia de 31 días en área con eje de valores, dona de medios de pago y de producción, columnas de cobros por persona y barras de antigüedad de saldos. Las explicaciones largas pasan al icono de ayuda y los atajos a las secciones se pliegan cuando hay cifras. Todo en SVG y CSS, sin librerías, con la leyenda y una tabla equivalente en texto para los lectores de pantalla.
- Mostrador: la venta queda arriba, el turno de caja se vuelve una franja compacta con su cierre a la mano, el historial de turnos pasa al final, el ticket acompaña al desplazarse y las ventas de hoy traen su franja (vendido, tickets, canceladas); cancelar una venta es un botón de contorno rojo. Cotizador: franja con borradores, esperando respuesta y aceptadas, y el historial se filtra por estado.

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
