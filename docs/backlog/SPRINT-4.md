# Sprint 4 — Cobranza, reportes, legal y facturación (23 – 29 nov)

> Plan: [`docs/plan/fase-08-sprint-4-cobranza-reportes-legal-facturacion.md`](../plan/fase-08-sprint-4-cobranza-reportes-legal-facturacion.md). Formato y tallas: [`README.md`](README.md).
> **Objetivo:** cobrar lo pendiente, ver cómo va el negocio, cumplir con la parte legal y facturar (desde el sistema y con el portal público), y adelantar la preparación de producción [ADR-0019].
> **Entra si:** Sprint 3 cerrado en verde. **El PAC debe estar elegido antes de empezar este sprint** (PD-05, R13).
> **Fuera de la entrega** [ADR-0019]: P1 (portal de seguimiento) y el recorrido guiado (RF-UX-04). Ver `DESPUES_DE_LA_ENTREGA.md`.

## Cuentas por cobrar

### S4-01 · Lista de cuentas por cobrar con antigüedad · M · 4 h
Como administrador
quiero ver las órdenes con saldo y cuántos días llevan
para saber a quién cobrar primero.
- **Requerimientos:** RF-M6-01, RF-M6-04 · **Reglas:** RN-09, RN-17 · **Pendientes:** PD-33 (umbral de 10 días por defecto, configurable)
- **Criterios de aceptación:**
  - Dadas órdenes con saldo mayor a cero, cuando se abre la lista, entonces muestra cliente, folio, saldo y días transcurridos calculados con fechas reales (reloj fijo).
  - Dado el umbral configurado, cuando una cuenta lo supera, entonces se resalta.
  - Dada una orden con saldo cero, cuando se revisa la lista, entonces no aparece.
  - Dada una fecha de orden futura o inválida, cuando se calcula, entonces no muestra días absurdos.

### S4-02 · Registrar el pago desde la lista · S · 2 h
Como cajero
quiero registrar el pago del saldo desde la lista
para cobrar sin buscar la orden.
- **Requerimientos:** RF-M6-02 · **Reglas:** RN-10, RN-11
- **Criterios de aceptación:**
  - Dado un saldo, cuando se registra un pago, entonces usa `RegisterPayment`, se atribuye al usuario activo y actualiza el saldo.

### S4-03 · Recordatorio por WhatsApp · S · 2 h
Como administrador
quiero enviar un recordatorio amable al cliente
para cobrar sin llamar por teléfono.
- **Requerimientos:** RF-M6-03
- **Criterios de aceptación:**
  - Dada una cuenta, cuando se toca el recordatorio, entonces se abre WhatsApp con un mensaje prellenado y amable con folio y saldo.

## Reportes

### S4-04 · Base de reportes: periodos y permisos · M · 4 h
Como administrador
quiero que todos los reportes usen los mismos periodos en hora de México y sean legibles en celular
para confiar en las cifras.
- **Requerimientos:** RF-M7-01 a RF-M7-06 (base), RNF-31 · **Reglas:** RN-17, RN-20 · **Pendientes:** PD-08 (base de "ventas": efectivo recibido, explicada en pantalla)
- **Criterios de aceptación:**
  - Dado un instante, cuando se calcula el día, la semana (lunes a domingo) y el mes, entonces coincide con la hora de México aunque la prueba corra en otra zona.
  - Dado un cajero, cuando intenta abrir Reportes, entonces no tiene acceso.
  - Dada la pantalla de ventas, cuando se muestra, entonces explica que "ventas" es efectivo recibido.
  - Dado un celular, cuando se abren los reportes, entonces se leen sin desplazamiento horizontal.

### S4-05 · Ventas del día, semana y mes con comparativo · M · 4 h
Como administrador
quiero ver mis ventas contra el periodo anterior
para saber si voy mejor o peor.
- **Requerimientos:** RF-M7-01 · **Reglas:** RN-17, RN-20
- **Criterios de aceptación:**
  - Dados datos armados a mano, cuando se calculan las ventas del día, la semana y el mes, entonces coinciden al centavo.
  - Dado el periodo anterior, cuando se compara, entonces muestra el porcentaje y una flecha.
  - Dado un periodo anterior en cero, cuando se compara, entonces muestra un texto claro y no un porcentaje infinito (se documenta aquí el texto).
  - Dada la aprobación de PP-13, cuando se decida, entonces se compara el mismo tramo del periodo anterior; sin ella, contra el periodo completo.

### S4-06 · Productos más vendidos · S · 2 h
Como administrador
quiero saber qué se vende más
para surtirme y ofrecer mejor.
- **Requerimientos:** RF-M7-02
- **Criterios de aceptación:**
  - Dados productos vendidos en la semana y el mes, cuando se pide el reporte, entonces los ordena por importe y por cantidad.

### S4-07 · Trabajos pendientes por estatus · S · 2 h
Como administrador
quiero ver cuántos trabajos hay en cada estatus y su valor
para saber qué hay en producción.
- **Requerimientos:** RF-M7-03
- **Criterios de aceptación:**
  - Dadas órdenes en cada estatus, cuando se pide el reporte, entonces da conteo y valor por estatus.

### S4-08 · Cuentas por cobrar con antigüedad (reporte) · S · 2 h
- **Requerimientos:** RF-M7-04 · **Pendientes:** PD-33
- **Criterios de aceptación:**
  - Dadas cuentas con distinta antigüedad, cuando se pide el reporte, entonces las agrupa y resalta según el umbral configurado.

### S4-09 · Cobros por cajero · S · 2 h
- **Requerimientos:** RF-M7-05 · **Reglas:** RN-11
- **Criterios de aceptación:**
  - Dados pagos de varios cajeros, cuando se pide hoy, la semana y el mes, entonces suma por cajero al centavo.

### S4-10 · Cobros por método de pago · S · 2 h
- **Requerimientos:** RF-M7-06 · **Reglas:** RN-10
- **Criterios de aceptación:**
  - Dados pagos en efectivo y transferencia, cuando se pide un periodo, entonces separa por método al centavo.

## Legal

### S4-11 · Términos del servicio y enlaces del aviso en los documentos · M · 4 h
Como cliente final
quiero ver el aviso de privacidad y los términos en mis documentos
para saber qué acepto.
- **Requerimientos:** RF-M9-01 (enlaces), RF-M9-02 · **Pendientes:** PD-12 (textos de prueba hasta recibir los finales)
- **Criterios de aceptación:**
  - Dado un administrador, cuando edita los términos, entonces se crea una versión con fecha.
  - Dados cotizaciones, comprobantes y portal de autofacturación, cuando se generan, entonces enlazan el aviso y muestran los términos vigentes.

### S4-12 · Derechos sobre datos y declaración del PAC · S · 2 h
- **Requerimientos:** RF-M9-04, RF-M9-05, RNF-17 · **Pendientes:** PD-12
- **Criterios de aceptación:**
  - Dado el aviso, cuando se muestra, entonces tiene un canal visible (correo o WhatsApp del negocio) para ejercer derechos.
  - Dado el aviso, cuando se factura, entonces declara la transferencia de datos fiscales al PAC y menciona los proveedores técnicos.

## Facturación

### S4-13 · Puerto de facturación y adaptador simulado · L · 8 h
Como Juanito (desarrollador)
quiero el contrato de facturación con un adaptador simulado
para construir todo el flujo sin depender del PAC.
- **Requerimientos:** RF-M10-01 · **Decisión:** ADR-0007
- **Criterios de aceptación:**
  - Dado `BillingProvider`, cuando se define, entonces tiene cuatro operaciones: timbrar, cancelar, consultar estatus y descargar XML y PDF.
  - Dado el adaptador simulado, cuando corre la batería de contrato, entonces la pasa.
  - Dada una llamada al PAC, cuando se hace, entonces solo ocurre en funciones del servidor.

### S4-14 · Elegir el PAC y custodiar el CSD · S · 2 h  · ⛔ PD-04 · PD-05
Como Juanito (desarrollador)
quiero elegir el PAC con los criterios del documento y definir cómo se sube el CSD
para que ZAMMIR pueda facturar en producción.
- **Requerimientos:** RF-M10-02, RF-M10-03 · **Pendientes:** PD-04 (datos fiscales), PD-05 (elección y quién contrata)
- **Criterios de aceptación:**
  - Dados los criterios de RF-M10-03, cuando se compara cada candidato, entonces queda la decisión en un ADR.
  - Dado el CSD, cuando se carga, entonces se sube directamente al PAC y nunca pasa por el código ni la base.

### S4-15 · Adaptador del PAC elegido contra su entorno de pruebas · L · 8 h  · ⛔ PD-05
Como Juanito (desarrollador)
quiero el adaptador del PAC real pasando la misma batería que el simulado
para que el cambio final no rompa nada.
- **Requerimientos:** RF-M10-01 · **Decisión:** ADR-0007 · **Riesgo:** R12, R13
- **Criterios de aceptación:**
  - Dado el entorno de pruebas del PAC, cuando corre la batería de contrato, entonces la pasa igual que el simulado.
  - Dada la tolerancia de centavos del PAC, cuando se verifica con casos de oro, entonces se resuelve R12 y se actualiza ADR-0011 si hay que ajustar.

### S4-16 · Facturar desde el sistema (camino A) · L · 8 h  · ⛔ PD-28
Como administrador
quiero facturar una venta u orden liquidada en segundos
para no depender de un contador cada vez.
- **Requerimientos:** RF-M10-04, RF-M10-05, RF-M10-06, RF-M10-07 · **Reglas:** RN-24, RN-25, RN-28 · **Pendientes:** PD-28 (forma de pago en pago mixto: configurable, sin regla supuesta), PD-29 (claves SAT de prueba)
- **Criterios de aceptación:**
  - Dada una venta u orden liquidada, no facturada ni cancelada, cuando se factura, entonces se puede; si no cumple, se rechaza con mensaje claro.
  - Dado el receptor, cuando se elige de la ficha o se captura (RFC, nombre, código postal, régimen, uso de CFDI), entonces se valida el formato.
  - Dada la factura, cuando se timbra, entonces usa CFDI 4.0, forma `01` o `03`, método `PUE` y guarda UUID, XML y PDF.
  - Dados totales, cuando se calculan, entonces usan el mismo módulo de dinero e IVA que el ticket [RN-07].
  - Dada la factura, cuando se pide, entonces se puede reenviar por correo o WhatsApp.

### S4-17 · Permisos para facturar y folio de factura · S · 2 h
- **Requerimientos:** RF-M10-08 · **Reglas:** RN-15, RN-19
- **Criterios de aceptación:**
  - Dado un administrador, cuando factura, entonces procede; un cajero solo con autorización de un administrador por PIN.
  - Dada la factura, cuando se crea, entonces lleva folio `F-AAAA-0001`.

### S4-18 · Portal `/factura`: validaciones y protecciones · L · 8 h
Como cliente final
quiero entrar con el QR de mi ticket y ver solo lo mío
para facturarme sin ayuda.
- **Requerimientos:** RF-M10-09, RF-M10-10, RF-M10-11, RNF-12 · **Reglas:** RN-24, RN-25, RN-26
- **Criterios de aceptación:**
  - Dado el QR, cuando se abre, entonces llega a `/factura` con el folio y el código; también se pueden teclear a mano.
  - Dados folio, código, liquidada, no facturada y dentro de plazo, cuando se valida en el servidor, entonces solo así se muestran los datos.
  - Dado un código incorrecto, cuando se intenta, entonces la respuesta no revela si el folio existe.
  - Dados demasiados intentos por IP o por folio, cuando se superan, entonces se limitan.
  - Dado el portal, cuando recibe tráfico automatizado, entonces una verificación ligera lo frena.
  - Dado el portal, cuando se llama a la base, entonces solo pasa por funciones del servidor, nunca por tablas directas.

### S4-19 · Portal `/factura`: formulario, resultado y diseño para todos · L · 8 h  · `tablet`
Como cliente final
quiero capturar mis datos fiscales y descargar mi factura
para terminar en pocos pasos.
- **Requerimientos:** RF-M10-12, RF-M10-13, RF-M10-14, RF-M10-16, RF-UX-10, RNF-28 · **Reglas:** RN-23
- **Criterios de aceptación:**
  - Dado el portal, cuando se muestra, entonces enseña solo conceptos y total.
  - Dado el formulario, cuando se captura RFC (12 o 13), código postal (5 dígitos), régimen y uso de CFDI, entonces valida formatos y ofrece listas.
  - Dada la casilla del aviso de privacidad, cuando no se acepta, entonces no se puede enviar.
  - Dada la factura timbrada, cuando termina, entonces ofrece PDF y XML y envío por correo si se captura.
  - *(manual)* Probar con una persona mayor o poco familiarizada con la tecnología [R11].

### S4-20 · Idempotencia, reintentos y plazos · M · 4 h  · ⛔ PD-09
Como administrador
quiero que un PAC lento no duplique timbres y que lo fuera de plazo se explique con amabilidad
para evitar problemas fiscales.
- **Requerimientos:** RF-M10-10 (plazo), RF-M10-15, RF-M10-17 · **Reglas:** RN-24, RN-26 · **Pendientes:** PD-09 (plazo de fin de mes, en un solo lugar de configuración)
- **Criterios de aceptación:**
  - Dado un fallo o tardanza del PAC, cuando se solicita la factura, entonces queda "en proceso", se reintenta y nunca se duplica el timbre (prueba de idempotencia).
  - Dada la solicitud en proceso, cuando se revisa, entonces aparece en el panel del administrador.
  - Dado un folio fuera del último día del mes, cuando se intenta, entonces el portal explica con amabilidad que se pida al negocio; un administrador sí puede facturar.
  - Dado un documento emitido sin conexión que aún no llega al servidor, cuando se intenta, entonces dice que aún no está disponible.

### S4-21 · Tratamiento de anticipos y cancelación de CFDI · M · 4 h  · ⛔ PD-27
Como administrador
quiero cancelar una factura con los motivos del SAT y que los anticipos se traten como indique el contador
para cumplir con lo fiscal.
- **Requerimientos:** RF-M10-18, RF-M10-19 · **Reglas:** RN-27, RN-28 · **Pendientes:** PD-27 (opción a por defecto)
- **Criterios de aceptación:**
  - Dado el ajuste de anticipos, cuando está en la opción (a), entonces se emite un solo CFDI por el total al liquidar; la opción (b) no se construye.
  - Dado un administrador, cuando cancela con un motivo del SAT, entonces queda en bitácora; un cajero no puede.

### S4-22 · Timbres y factura en el historial · S · 2 h  · ⛔ PD-26
- **Requerimientos:** RF-M10-20, RF-M10-21, RF-M5-02 · **Pendientes:** PD-26 (límite anual configurable)
- **Criterios de aceptación:**
  - Dado el límite configurable, cuando se usa el 80 %, entonces el panel avisa.
  - Dada una factura, cuando se emite, entonces aparece en el historial del cliente.

## Experiencia, preparación de producción y documentos

### S4-23 · Primeros pasos y "¿Por dónde empiezo?" · M · 4 h  · `tablet`
Como administrador
quiero una guía en el primer ingreso y un botón fijo de ayuda
para no perderme al empezar.
- **Requerimientos:** RF-UX-02, RF-UX-03, RF-UX-05 · **Notas:** el recorrido guiado (RF-UX-04) queda fuera de la entrega [ADR-0019]
- **Criterios de aceptación:**
  - Dado el primer ingreso de un usuario, cuando entra, entonces ve cinco tarjetas en el orden de la navegación; no vuelve a salir sola.
  - Dado el botón "¿Por dónde empiezo?", cuando se toca, entonces vuelve a abrir la guía.
  - Dada una sección que depende de otra, cuando se abre, entonces muestra un aviso cerrable.

### S4-24 · Panel de inicio con contenido por rol · M · 4 h  · ⛔ PD-31
Como administrador
quiero un panel de inicio con lo importante del día
para ver cómo va el negocio al entrar.
- **Requerimientos:** RF-UX-01 · **Pendientes:** PD-31 (contenido por rol: Juanito debe definirlo; la demo mostraba ventas del día y medios de pago, cuentas por cobrar, tendencia y pipeline)
- **Criterios de aceptación:**
  - Dado el contenido definido por Juanito, cuando se construye, entonces cada bloque usa los mismos cálculos que los reportes.
  - Dada la falta de definición, cuando llegue el sprint, entonces el panel se queda con accesos sin cifras (S0-12).

### S4-25 · Estados vacíos, errores y vocabulario en todo el sistema · S · 2 h
- **Requerimientos:** RF-UX-07, RF-UX-08 · **Reglas:** RN-23
- **Criterios de aceptación:**
  - Dada cada pantalla sin datos, cuando se abre, entonces dice qué hacer, sin datos de relleno.
  - Dada cada acción destructiva, cuando se intenta, entonces pide confirmación y los errores dicen qué hacer.
  - Dada la prueba de vocabulario, cuando corre sobre todo el sistema, entonces pasa.

### S4-26 · Producción vacía, dominio y variables · M · 4 h  · ⛔ PD-10
- **Requerimientos:** RNF-13, RNF-37 · **Decisión:** ADR-0003, ADR-0019 · **Pendientes:** PD-10 (el dominio no puede cambiar tras imprimir tickets reales)
- **Criterios de aceptación:**
  - Dados los proyectos de producción en planes de pago, cuando se crean, entonces están separados de pruebas y con sus variables solo en los paneles.
  - Dadas las migraciones, cuando se aplican desde cero en producción, entonces terminan sin errores y sin datos de prueba.

### S4-27 · Respaldos con 30 días de historial · M · 4 h  · ⛔ PD-32
- **Requerimientos:** RNF-21 · **Pendientes:** PD-32 (retención del plan de Supabase)
- **Criterios de aceptación:**
  - Dada la retención del plan, cuando se verifica, entonces cubre 30 días o hay exportación nocturna a almacenamiento externo.

### S4-28 · Registro de errores y monitoreo sin datos personales · M · 4 h
- **Requerimientos:** RNF-34
- **Criterios de aceptación:**
  - Dado un error de cliente o servidor, cuando se registra, entonces no contiene datos personales.
  - Dada una caída del servicio, cuando ocurre, entonces el monitoreo avisa a Juanito.

### S4-29 · Manual de usuario y manual de soporte (borrador) · L · 8 h
- **Requerimientos:** RNF-29 · **Reglas:** DC §13
- **Criterios de aceptación:**
  - Dado el manual de usuario, cuando se lee, entonces tiene capturas con datos inventados y lenguaje del oficio.
  - Dado el manual de soporte, cuando se lee, entonces cubre despliegue, restauración y atención a solicitudes de datos.

### S4-30 · Plan de pruebas de aceptación con el cliente · S · 2 h
- **Criterios de aceptación:**
  - Dado el plan, cuando se escribe, entonces enlista escenarios del día a día (cotizar sin señal, cobrar un anticipo, entregar, hacer el corte, facturar) que Luis ejecuta y firma.

## Aceptación y cierre

### S4-31 · Aceptación E5 y E6 (facturación) · M · 4 h
- **Reglas:** E5, E6 · **Pendientes:** PD-05 (contra el entorno de pruebas del PAC)
- **Criterios de aceptación:**
  - Dado un folio liquidado, cuando se autofactura, entonces se genera la factura de prueba; uno ya facturado, uno fuera de plazo y uno con código incorrecto se rechazan con mensajes claros y sin duplicar timbres.
  - Dado un cajero sin permiso, cuando intenta facturar, entonces no puede; con autorización, sí.

### S4-32 · Aceptación E7 y E8 (reportes y permisos) · M · 4 h
- **Reglas:** E7, E8
- **Criterios de aceptación:**
  - Dados datos armados a mano, cuando se piden los reportes, entonces coinciden al centavo, con día, semana y mes bien delimitados.
  - Dado un cajero, cuando intenta ver reportes, precios o cortes ajenos, entonces no puede; un administrador sí.

### S4-33 · Medición de tiempos y accesibilidad · S · 2 h  · `tablet`
- **Requerimientos:** RNF-23 a RNF-28
- **Criterios de aceptación:**
  - Dada la tablet objetivo, cuando se miden la carga inicial, la cotización en PDF, el ticket y un reporte con 12 meses de datos, entonces cumplen RNF-23 a RNF-27.
  - Dadas todas las pantallas, cuando corre la revisión de accesibilidad, entonces no hay violaciones graves.

### S4-34 · Cierre del Sprint 4 · S · 2 h  · `tablet`
- **Reglas:** `00-principios` §5.2 · **Plan:** compuerta de salida de la fase 8
- **Criterios de aceptación:**
  - Dada la compuerta común, cuando se corre, entonces está en verde.
  - Dados el adaptador simulado y el del PAC, cuando corren, entonces pasan la misma batería de contrato.
  - Dados los reportes, cuando se revisan con datos armados a mano, entonces coinciden al centavo.
  - *(manual)* Lista de tablet firmada: E5 y E6 con equipo real.
  - Dada la revisión, cuando termina, entonces la retrospectiva y la recalibración quedan registradas.
