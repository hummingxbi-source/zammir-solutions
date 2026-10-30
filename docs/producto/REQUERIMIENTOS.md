# Requerimientos funcionales

> Fuente: [DC §4, §6, §7 y §12]. Los requerimientos no funcionales están en `REQUERIMIENTOS_NO_FUNCIONALES.md`. Los cambios respecto al documento fuente se marcan con **[Cambio]** y su ADR.
> Cada requerimiento conserva su identificador `RF-Mx-yy` para citarlo en historias de usuario, código y pruebas. El documento fuente no numera los de M10 ni los de experiencia de usuario: los identificadores `RF-M10-yy` y `RF-UX-yy` se asignaron aquí y cada uno cita su sección de origen.
> Los criterios de aceptación detallados se escriben en el backlog (Fase 3), historia por historia.

## Roles y permisos

**Roles** [DC §4]:
- **Administrador:** Luis (dueño) y Ricardo (socio), con los mismos permisos. Supuesto de HummingX, ajustable por configuración.
- **Cajero / vendedor:** los empleados que cobran, cotizan y avanzan trabajos. Hoy son 3; cobran en el mostrador y ellos mismos instalan.
- **Cliente final:** sin cuenta ni contraseña. Solo enlaces públicos con código: autofacturación y, si se activa P1, seguimiento.

**Matriz de permisos** [DC §4]:

| Acción | Administrador | Cajero |
|---|---|---|
| Generar cotizaciones | Sí | Sí |
| Descuentos o cambio de precio de una línea | Sí | Solo con PIN de un administrador |
| Editar catálogo y precios | Sí | No |
| Registrar ventas, anticipos y saldos | Sí | Sí |
| Avanzar estatus de una orden | Sí | Sí |
| Entregar una orden con saldo pendiente | Sí, con motivo | No |
| Cancelar ventas u órdenes | Sí, con motivo | No |
| Ver y cerrar su propio corte de caja | Sí | Sí |
| Ver cortes de otros y el consolidado | Sí | No |
| Reportes y cuentas por cobrar | Sí | No |
| Generar una factura desde el sistema | Sí | Solo con autorización de un administrador |
| Usuarios y dispositivos | Sí | No |
| Editar aviso de privacidad y términos | Sí | No |

**Autenticación** [DC §4]:
- Administradores: correo y contraseña, con cierre de sesión por inactividad prolongada.
- Empleados: la tablet se registra como "dispositivo del mostrador". Sobre esa sesión, cada empleado entra con su PIN personal de 4 a 6 dígitos, guardado con hash, y cambia de usuario en un toque.
- El PIN solo funciona en dispositivos registrados. Bloqueo automático tras 5 minutos de inactividad, ajustable.
- Nunca se comparte un usuario entre personas: el reporte "quién cobró qué" depende de eso.

---

## M1. Catálogo

**Propósito:** reemplazar el catálogo desordenado por uno limpio que alimente cotizador, mostrador y facturación.

- **RF-M1-01** Cada producto tiene: código (opcional, autogenerable), nombre, categoría, tipo, unidad de cobro, precio de lista **con IVA incluido** [RN-06], activo/inactivo, garantía sugerida (meses y texto, opcional) y datos fiscales para CFDI (clave de producto o servicio, clave de unidad, objeto de impuesto) con valores predeterminados por categoría. **[Cambio]** Se agrega la regla de precio asignada [RN-02], [ADR-0006].
  *Nota [Juanito, 2026-10-27]: en la demo el código lo capturaba Luis; Juanito prefiere que lo genere el sistema (iniciales del nombre + número). Regla por definir: PP-05. La demo también capturaba una descripción del producto: PP-04.*
- **RF-M1-02** Categorías iniciales: vidrio claro/flotado, vidrio templado, esmerilado/satinado, decorado/emplomado, espejo, cristal doble/termopanel, acrílico, aluminio y cancelería, herrajes, selladores y silicón, servicios.
- **RF-M1-03** Búsqueda rápida tolerante a acentos y mayúsculas, con filtros por categoría y tipo.
- **RF-M1-04** Alta, edición y desactivación por un administrador, sin intervención técnica. Nada se borra.
- **RF-M1-05** Importación masiva desde CSV o Excel, con plantilla descargable y vista previa de errores antes de confirmar. El catálogo real (50 a 150 productos) llega del cliente en la etapa final.
- **RF-M1-06** Historial de cambios de precio con usuario y fecha.
- **RF-M1-07** *[Solo si P2 se activa]* Para piezas estándar: existencias, mínimo configurable y alerta de existencia baja. Descuento automático al vender o al entregar una orden. Sin compras, mermas ni costos.

## M2. Cotizador

**Propósito:** dar presupuestos más rápido, en forma y profesionales, incluso en casa del cliente.

- **RF-M2-01** Capturar o buscar al cliente: nombre y WhatsApp como mínimo; domicilio de la obra opcional.
- **RF-M2-02** Agregar líneas desde el catálogo. En productos a medida, capturar ancho, alto y cantidad (cm o m, con unidad clara). El sistema calcula el importe según la regla de precio y muestra el cálculo [RN-04].
- **RF-M2-03** Cargos adicionales (instalación, medición, cantos) como líneas de servicio. Descuentos o ajustes de precio requieren permiso de administrador y quedan registrados.
- **RF-M2-04** Vista previa del documento en vivo. En pantallas grandes, dos paneles (datos a la izquierda, documento a la derecha); en pantallas chicas, una pestaña de vista previa.
- **RF-M2-05** PDF tamaño carta: logo y datos de ZAMMIR, folio, fecha, vigencia, datos del cliente, conceptos con medidas, cantidades e importes, total, condiciones, espacio de firma y aviso de privacidad abreviado. **Se genera en el dispositivo** para funcionar sin internet.
- **RF-M2-06** Enviar: compartir el PDF con el menú de compartir del dispositivo (opción WhatsApp) y, como respaldo, abrir un enlace de WhatsApp con mensaje prellenado y descargar el PDF. **[Cambio]** Se elimina la impresión en impresora tamaño carta [ADR-0005].
- **RF-M2-07** Estados: borrador, enviada, aceptada, rechazada, vencida. Historial por cliente.
- **RF-M2-08** Convertir una cotización aceptada en orden de trabajo en un solo paso, sin recapturar.
- **RF-M2-09** Duplicar cotizaciones. Guardado automático de borradores.
- **RF-M2-10** Uso en campo: tablet en vertical y horizontal, botones grandes, teclado numérico para medidas y operación sin conexión.
- **RF-M2-11** *[Solo si P1 se activa]* Enlace público para que el cliente vea y acepte la cotización en línea.

## M3. Órdenes de trabajo

**Propósito:** seguir trabajos que tardan días o semanas, con saldo y garantía documentados.

- **RF-M3-01** Crear una orden desde una cotización aceptada o manualmente. Campos: folio, cliente, descripción, líneas copiadas, total, anticipo, saldo, responsables (quién mide, fabrica e instala), fecha estimada de entrega, notas y fotos opcionales de la medición.
- **RF-M3-02** Estatus: en espera → en proceso → listo para entrega o instalación → entregado; y cancelado (con motivo). Botón "Avanzar" al siguiente estatus. Cada cambio guarda usuario y hora.
  *Nota [Juanito, 2026-10-27]: "hay que ir definiendo los estatus". Propuesta de definiciones y requisitos de cada estatus en `docs/producto/REVISION_DE_NEGOCIO.md` §2; no es requerimiento hasta que Juanito la apruebe.*
- **RF-M3-03** Registrar el anticipo (50% sugerido, editable) con método de pago y quién cobró. El saldo se calcula y queda visible hasta liquidarse.
- **RF-M3-04** No se puede marcar "entregado" con saldo mayor a cero sin autorización de un administrador y un motivo; en ese caso el saldo pasa a cuentas por cobrar.
- **RF-M3-05** Al entregar se crea el registro de garantía: fecha de inicio, duración, cobertura y exclusiones.
- **RF-M3-06** Comprobante de trabajo en PDF tamaño carta: folio, cliente, descripción y medidas, total, anticipo pagado, saldo, condiciones, garantía y QR con código de verificación para autofacturación. Se genera al cobrar el anticipo y se vuelve a generar con el saldo liquidado al entregar. **[Cambio]** Se comparte por WhatsApp; no se imprime [ADR-0005].
- **RF-M3-07** Vistas: tablero por estatus y lista con filtros (estatus, cliente, responsable, fechas). Resumen con valor en producción y saldo por cobrar de lo que ya está listo.
- **RF-M3-08** Cancelación solo por administradores, con motivo. El tratamiento del anticipo se registra según el contrato **[POR DEFINIR]**.

## M4. Mostrador (venta y caja)

**Propósito:** controlar la caja compartida por tres personas.

- **RF-M4-01** Venta rápida: elegir productos (piezas estándar, servicios y vidrio a medida con captura de medida), ajustar cantidades y ver el ticket actual.
- **RF-M4-02** Cobro en efectivo (monto recibido y cambio), transferencia (referencia opcional) o mixto.
- **RF-M4-03** Cada venta y cada pago guardan usuario activo, dispositivo y hora.
- **RF-M4-04** Ticket térmico de 80 mm: nombre del negocio, folio, fecha, cajero, conceptos, total, forma de pago, y QR más código para autofacturación con la leyenda del plazo.
- **RF-M4-05** Los anticipos y saldos de órdenes se cobran también desde Mostrador y cuentan en la caja de quien los recibió.
- **RF-M4-06** Corte de caja en dos niveles.
  - *Nivel 1, por cajero o turno:* apertura con fondo inicial opcional, ventas y cobros por método de pago, efectivo esperado, efectivo contado, diferencia (sobrante o faltante) y resumen imprimible en ticket.
  - *Nivel 2, consolidado del día (administradores):* por método y por cajero.
  - Un corte cerrado no se edita; solo un administrador lo reabre, con rastro.
- **RF-M4-07** Cancelar una venta: solo administradores, con motivo y rastro.
- **RF-M4-08** Cambio de usuario por PIN en un toque, con bloqueo por inactividad.
  *Nota [Juanito, 2026-10-27]: en la demo el cajero se elegía de una lista sin autenticarse; Juanito quiere que cada cajero tenga su propia sesión. Ya está cubierto: nombre y PIN [ADR-0013]; el alta de cajeros la hace un administrador [RF-M8-01].*

## M5. Clientes e historial

- **RF-M5-01** Ficha: nombre, WhatsApp o teléfono, correo opcional, domicilios de obra, datos fiscales opcionales (RFC, razón social, código postal fiscal, régimen, uso de CFDI) y notas.
- **RF-M5-02** Historial: cotizaciones, órdenes, ventas, pagos, garantías y facturas.
- **RF-M5-03** Marca de "cliente recurrente" con dos o más trabajos entregados.
- **RF-M5-04** Búsqueda rápida y aviso de posibles duplicados por teléfono.
- **RF-M5-05** Solicitudes de datos personales (acceso, rectificación, cancelación, oposición): un administrador corrige o anonimiza los datos del cliente, conservando los registros contables y fiscales que la ley exija.

## M6. Cuentas por cobrar

- **RF-M6-01** Lista de órdenes con saldo mayor a cero: cliente, folio, saldo y días transcurridos. Antigüedad resaltada por umbral configurable (la demo usó 10 días).
- **RF-M6-02** Registrar el pago del saldo desde la lista.
- **RF-M6-03** Botón de recordatorio por WhatsApp con mensaje prellenado y amable.
- **RF-M6-04** Días calculados con fechas reales. La demo mostró "hace 741 días" por un error de datos: no debe repetirse.

## M7. Reportes

**Propósito:** las cinco vistas que pidió Luis, nada más. Solo administradores. Legibles en celular.

- **RF-M7-01** Ventas del día, semana y mes, cada una contra el periodo anterior, con porcentaje y flecha. Base de cálculo según [RN-20].
- **RF-M7-02** Producto o tipo de vidrio más vendido, por importe y por cantidad, en la semana y el mes.
- **RF-M7-03** Trabajos pendientes por estatus, con conteo y valor.
- **RF-M7-04** Cuentas por cobrar con antigüedad.
- **RF-M7-05** Cobros por cajero: hoy, semana, mes.
- **RF-M7-06** Cobros por método de pago en el periodo.

La sección se llama "Reportes": sin predicciones ni periodos de calibración.

## M8. Usuarios y roles

- **RF-M8-01** Crear, editar y desactivar usuarios (nunca borrar). Asignar rol y PIN. Restablecer PIN.
- **RF-M8-02** Registrar, listar y revocar dispositivos.
- **RF-M8-03** Bitácora consultable de acciones sensibles [RN-19].
- **RF-M8-04** Capacidad prevista: 2 administradores y 3 a 5 empleados, sin límite técnico.

## M9. Legal y cumplimiento

- **RF-M9-01** Aviso de privacidad simplificado, enlazado desde el cotizador, los comprobantes y el portal de autofacturación. Editable por administradores, con versión y fecha. HummingX entrega un borrador; el texto final lo valida ZAMMIR con su asesor.
- **RF-M9-02** Términos del servicio de ZAMMIR (anticipo, garantía, cancelación, tiempos de entrega), visibles en cotizaciones y comprobantes.
- **RF-M9-03** Al capturar un cliente, registrar que se le informó el aviso de privacidad.
- **RF-M9-04** Canal visible para ejercer derechos sobre sus datos (correo o WhatsApp del negocio).
- **RF-M9-05** El aviso declara la transferencia de datos fiscales al PAC cuando se factura.


## M10. Facturación CFDI y autofacturación

**Propósito:** que ZAMMIR deje de depender de un contador que cobra cada vez que un cliente pide factura, por dos caminos: un administrador factura desde el sistema en segundos, o el propio cliente se factura en un portal público con los datos de su ticket [DC §7.1]. Reglas: [RN-24] a [RN-28].

### Proveedor de timbrado
- **RF-M10-01** Capa de abstracción `BillingProvider` ("ProveedorTimbrado") con cuatro operaciones: timbrar, cancelar, consultar estatus y descargar XML y PDF. Cambiar de PAC no debe tocar el resto del sistema [DC §7.3], [ADR-0007].
- **RF-M10-02** El archivo `.key` del CSD y su contraseña se suben **directamente al PAC**. Nunca se guardan en la base de datos ni en el código [DC §7.3].
- **RF-M10-03** El PAC se elige con estos criterios: API REST documentada, entorno de pruebas, CFDI 4.0, cancelación con motivos, entrega de PDF y XML, soporte de varios emisores, custodia del CSD dentro del PAC, y precio por timbre o paquete. Candidatos sin preferencia fija: Facturama, SW Sapien, Facturapi [DC §7.3] (PD-05).

### Camino A: facturar desde el sistema
- **RF-M10-04** Elegir una venta de mostrador o una orden de trabajo liquidada [RN-25], [DC §7.5].
- **RF-M10-05** Elegir al receptor desde la ficha del cliente o capturarlo: RFC, nombre o razón social tal como aparece en su constancia de situación fiscal, código postal fiscal, régimen fiscal y uso de CFDI [DC §7.5].
- **RF-M10-06** Forma y método de pago según [RN-28] [DC §7.5].
- **RF-M10-07** Timbrar; guardar UUID, XML y PDF; poder reenviarlos por correo o WhatsApp [DC §7.5].
- **RF-M10-08** Permisos: administradores; un cajero solo con autorización de un administrador por PIN [DC §4, §7.5].

### Camino B: portal público de autofacturación
- **RF-M10-09** Entrada: el QR del ticket y del comprobante abre la ruta `/factura` con el folio y un código de verificación aleatorio (por ejemplo, de 6 caracteres). También se puede teclear el folio y el código a mano [DC §7.6].
- **RF-M10-10** Antes de mostrar cualquier dato se valida, en el servidor: el folio existe, el código coincide, la operación está liquidada, no está ya facturada y está dentro del plazo [RN-25], [RN-26], [DC §7.6].
- **RF-M10-11** Protección: límite de intentos por IP y por folio, y una verificación ligera contra automatización. **Nunca revelar si un folio existe cuando falla el código** [DC §7.6, §10.1].
- **RF-M10-12** La pantalla muestra solo lo necesario: conceptos y total [DC §7.6].
- **RF-M10-13** Formulario del receptor con validación de formato del RFC (12 o 13 caracteres) y del código postal (5 dígitos), listas de régimen fiscal y uso de CFDI, y casilla de aceptación del aviso de privacidad que menciona la transferencia de datos al PAC [DC §7.6], [RF-M9-05].
- **RF-M10-14** Resultado: factura timbrada con descarga de PDF y XML, y envío por correo si el cliente lo captura [DC §7.6].
- **RF-M10-15** Idempotencia: si el PAC falla o tarda, la solicitud queda "en proceso" con reintentos automáticos y aparece en el panel de un administrador [RN-24], [DC §7.6].
- **RF-M10-16** Diseño para personas mayores y poco familiarizadas con la tecnología: pocos pasos, botones grandes, instrucciones simples [DC §7.6].
- **RF-M10-17** Si el documento se emitió sin conexión y todavía no llega al servidor, el portal explica que aún no está disponible y que intente más tarde. *Derivado de [DC §5.5] en `docs/arquitectura/SINCRONIZACION.md`; el texto exacto lo aprueba Juanito.*

### Anticipos, cancelaciones y timbres
- **RF-M10-18** Ajuste "tratamiento de anticipos", con la opción (a) por defecto [RN-27], [DC §7.7].
- **RF-M10-19** Cancelación de CFDI solo por administradores, con los motivos del SAT y bitácora [RN-28], [DC §7.8].
- **RF-M10-20** El panel de un administrador muestra los timbres usados contra el límite del paquete y avisa al llegar al 80%. El límite es configurable (PD-26) [DC §7.9].
- **RF-M10-21** La factura aparece en el historial del cliente [RF-M5-02].

---

## Experiencia de usuario

> Lecciones obligatorias que dejó la demo [DC §12.2]. Aplican a todos los módulos.

- **RF-UX-01** Navegación en el orden real del trabajo: Catálogo, Cotizador, Órdenes de trabajo, Mostrador y Reportes, con numeración discreta y marca de las secciones ya visitadas. El panel de inicio va aparte, accesible desde el logo. Su contenido por rol está por definir (PD-31) [DC §12.2 punto 1].
- **RF-UX-02** Pantalla de "Primeros pasos" en el primer ingreso, con cinco tarjetas en el orden de la navegación [DC §12.2 punto 2].
- **RF-UX-03** Botón fijo "¿Por dónde empiezo?" [DC §12.2 punto 2].
- **RF-UX-04** Recorrido guiado opcional con globos de ayuda [DC §12.2 punto 2]. *Fuera de la entrega salvo decisión en contrario de Juanito [ADR-0019].*
- **RF-UX-05** Avisos contextuales que se pueden cerrar cuando una sección depende de otra (por ejemplo, "revisa primero tu catálogo") [DC §12.2 punto 2].
- **RF-UX-06** Estados siempre visibles: conexión a internet, operaciones pendientes de enviar ("N pendientes") e impresora conectada o desconectada [DC §9, §12.2 punto 7, §8.3].
- **RF-UX-07** Estados vacíos que enseñan qué hacer; nunca datos de relleno [RN-23].
- **RF-UX-08** Confirmación en toda acción destructiva y mensajes de error humanos que digan qué hacer [DC §10.5].
- **RF-UX-09** Animaciones sobrias que respetan la preferencia de reducir movimiento [DC §12.2 punto 8].
- **RF-UX-10** Pantallas para el cliente final (autofacturación y, con P1, seguimiento): diseño sobrio y editorial, iconografía del oficio, botones grandes y pocos pasos; nada de tarjetas genéricas de panel [DC §12.2 punto 4].
