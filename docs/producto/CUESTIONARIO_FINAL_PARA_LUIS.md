# Cuestionario para Luis

> Versión para enviar (8 de noviembre de 2026). 91 preguntas en tres partes. Las respuestas se anotan en `PENDIENTES.md` y en el documento que corresponda; **no** se guardan en el chat.

Luis: ya casi terminamos de construir el sistema. Para cerrarlo y entregarlo necesitamos que nos confirmes cómo trabajan, para no inventar nada.

Son preguntas de opción rápida. Casi todas dicen qué haremos si no sabes o no contestas, así que lo que dejes en blanco no detiene nada.

Está dividido en tres partes para que lo contestes en tres ratos. Puedes marcar con una X, escribir, mandarnos un audio o contestarlo por llamada: nosotros lo anotamos. Las preguntas con ⭐ conviene contestarlas primero.

Las que dicen "tu contador" las puede contestar él directamente.

---

## Parte A — Para poder entregar

*Lo que más urgente necesitamos. Sin esto no se puede abrir producción ni facturar de verdad. Unos 15 minutos.* (16 preguntas)

### Facturación y datos fiscales

**50.** ⭐ **Trámite del certificado de sello digital (CSD):** ¿ya tienen e.firma vigente? ¿Pueden iniciar el trámite del CSD ahora? Puede tardar. Necesitamos RFC, régimen fiscal, y los archivos `.cer`, `.key` y su contraseña **que ZAMMIR sube directo al proveedor de timbrado, no a nosotros**.

> Tu respuesta:

**69.** ⭐ **Datos del emisor de las facturas:** necesitamos, tal como aparecen en su constancia de situación fiscal, la **razón social**, el **RFC**, el **régimen fiscal** y el **código postal del domicilio fiscal** (en la factura sale como "lugar de expedición"). Una foto de la constancia sirve. *Si no los tienes: no se puede emitir ninguna factura real.*

> Tu respuesta:

**72.** **Primera factura real:** antes de facturar con valor fiscal hay que hacer una verificación con su **contador** (una factura de prueba que se cancela). ¿Puede su contador acompañarla, por teléfono o en persona? ☐ Sí ☐ No, otra persona: ___.

> Tu respuesta:

**63.** **Correo del negocio:** ¿ZAMMIR tiene un correo para el negocio? Sirve para que el cliente reciba su factura y como segundo canal para ejercer sus derechos sobre sus datos. Hoy solo se usa el WhatsApp.

> Tu respuesta:

### Equipo, local, cuentas y entrega

**55.** **Impresora:** la candidata es **Epson TM-m30III-052**. La ficha de la tienda se contradice en Wi-Fi y Bluetooth: ¿pueden preguntarle al vendedor qué conexiones trae esa variante **antes de comprar**? ¿Cuántas impresoras se necesitan?

> Tu respuesta:

**56.** **Tablets:** la candidata es **Samsung Galaxy Tab A9+ 5G**. ¿Cuántas se necesitan? ¿La de obra necesita datos móviles?

> Tu respuesta:

**57.** **Internet en el local:** ¿hay Wi-Fi estable donde está el mostrador? ¿Quién lo administra?

> Tu respuesta:

**58.** **Dirección web propia** (dominio): ¿ZAMMIR ya tiene una, o prefieren que se compre una nueva? **No se puede cambiar después de imprimir los primeros tickets**, porque los códigos QR apuntan a ella.

> Tu respuesta:

**59.** **Aviso de privacidad y términos:** ¿tienen un asesor legal que revise el texto final?

> Tu respuesta:

**60.** **¿Pueden dedicar a una persona 30 minutos para probar el sistema** con datos reales cuando esté listo para pruebas?

> Tu respuesta:

**70.** ⭐ **¿A nombre de quién quedan las cuentas de producción** (dominio, base de datos, aplicación y proveedor de timbrado)? ☐ A nombre de ZAMMIR, con Juanito como colaborador ☐ A nombre de HummingX BI ☐ Otra forma: ___. *Recomendación: el dominio y el certificado siempre a nombre de ZAMMIR.*

> Tu respuesta:

**71.** ⭐ **Fechas de la entrega** (entre el 23 de noviembre y el 1 de diciembre): ¿qué días y a qué hora están **Luis**, **Ricardo** y **el equipo de mostrador** para las tres sesiones de capacitación y para ejecutar el plan de pruebas de aceptación (de 2 a 3 horas, con la tablet y la impresora en el local)? ¿Se puede aprovechar un día para **cortar el internet a propósito** y comprobar que todo sigue funcionando?

> Tu respuesta:

**75.** **¿Para qué fecha tendrán en el local las tablets y la impresora?** Sin ellas no se puede ensayar la impresión ni registrar las tablets reales.

> Tu respuesta:

### Personas, permisos y datos del negocio

**46.** ⭐ **Datos del negocio para tickets y documentos:** nombre completo, domicilio, teléfono, correo, logo y colores.

> Tu respuesta:

### Productos y catálogo

**11.** **¿Cuándo nos puedes pasar la lista real de productos y precios** (entre 50 y 150)? Una hoja de Excel o fotos de la lista sirven.

> Tu respuesta:

### Mostrador y caja

**37.3.** **Ancho del papel del ticket:** ¿la impresora usa papel de **58 mm** o de **80 mm**? *Si no sabes: 58 mm.*

> Tu respuesta:

---

## Parte B — Cómo trabajan (reglas del negocio)

*Lo que cambia cómo se cobra, se entrega y se factura. Cada pregunta dice qué haremos si no la sabes. Unos 40 minutos.* (42 preguntas)

### Facturación y datos fiscales

**51.** **Anticipos:** ¿se factura **una sola vez al liquidar**, o se emite una factura por el anticipo y otra al final?

> Tu respuesta:

**52.** **Pago mixto** (parte efectivo, parte transferencia): ¿qué forma de pago debe llevar la factura? Mientras no se responda, el portal **no factura** las compras con pago mixto y manda a pedir la factura en el negocio.

> Tu respuesta:

**53.** **Autofacturación:** el cliente puede pedir su factura hasta el **último día del mes** de su compra. ¿Está bien?

> Tu respuesta:

**54.** **Claves del SAT** de cada categoría de producto (producto o servicio, unidad, objeto de impuesto): ¿las revisa su contador cuando tengamos las categorías cerradas?

> Tu respuesta:

**61.** **IVA de los productos:** ¿vende ZAMMIR algo con **IVA 0 %** o **exento**? Hoy todo se calcula con 16 % y el catálogo puede marcar un producto como exento.

> Tu respuesta:

**62.** **Qué piden sus clientes al facturar:** ¿cuáles son el **régimen fiscal** y el **uso de CFDI** que más piden (por ejemplo "Gastos en general" o "Adquisición de mercancías")? Con eso el portal los muestra primero y se les hace más fácil a los clientes.

> Tu respuesta:

**64.** **Factura global del público en general** (ventas de mostrador que nadie pidió facturar): sigue a cargo de **su contador**, no del sistema. ¿Confirman que así lo quieren?

> Tu respuesta:

**65.** **Cancelar una factura mal emitida** (RFC o nombre mal escrito): solo un **administrador** puede, con el motivo del SAT. ¿Quién de ZAMMIR haría esto y qué hacen hoy cuando pasa?

> Tu respuesta:

**66.** **¿Quién factura?** Hoy el sistema deja facturar solo al **administrador desde su computadora o tablet con su cuenta**. ¿Necesitan que un **cajero** pueda facturar desde la tablet con el PIN de un administrador, o con que el cajero le pida al administrador está bien?

> Tu respuesta:

**67.** **Timbres del paquete:** ¿cuántos timbres **incluye la anualidad** del proveedor y cuándo se renueva? Con ese número el sistema avisa al llegar al 80 % y al agotarse; hoy no hay límite y no avisa.

> Tu respuesta:

**68.** **Facturas "en proceso":** si el proveedor no contesta, el sistema reintenta solo (hasta 8 veces) y el administrador puede reintentar a mano. ¿Les basta con eso o quieren que se les avise de alguna forma (por ejemplo por WhatsApp)?

> Tu respuesta:

### Equipo, local, cuentas y entrega

**73.** **Solicitudes de datos de sus clientes** (ver, corregir o quitar sus datos): ¿quién en ZAMMIR las recibe y por qué canal (WhatsApp del negocio, correo)? Del lado técnico, HummingX las atiende.

> Tu respuesta:

**74.** **Si el servidor se cae:** las tablets siguen cotizando y cobrando sin internet, pero facturar o entrar a administración necesita el servidor. ¿Cuánto tiempo sin esas funciones pueden aguantar sin problema? ☐ Hasta 1 hora ☐ Hasta medio día ☐ Un día completo. Con eso se fija el compromiso de recuperación. *Si no sabes: se atiende el mismo día hábil.*

> Tu respuesta:

### Personas, permisos y datos del negocio

**43.** **¿Luis y Ricardo tienen exactamente los mismos permisos?** ☐ Sí ☐ No (¿qué cambia?).

> Tu respuesta:

**48.** **Garantía:** ¿cuánto dura, qué cubre y qué excluye? ¿Cambia por producto?

> Tu respuesta:

### Productos y catálogo

**1.** ⭐ **¿Venden vidrio laminado?** ☐ Sí ☐ No. *Si no sabes: lo dejamos como categoría apagada.*

> Tu respuesta:

**2.** ⭐ **¿Venden acrílico o policarbonato?** ☐ Acrílico ☐ Policarbonato ☐ Ambos ☐ Ninguno.

> Tu respuesta:

**3.** ⭐ **Canceles de baño, mamparas, barandales y puertas de cristal:** ¿se cotizan con un solo precio ya armado, o se cobra el vidrio y los herrajes por separado? ☐ Un solo precio ☐ Por separado ☐ Depende.

> Tu respuesta:

**4.** ⭐ **Cantos pulidos, perforaciones, biselados y otros trabajos de taller:** ¿se cobran aparte o van incluidos en el precio del vidrio? ☐ Aparte ☐ Incluidos ☐ Depende del trabajo. Si es aparte, ¿cómo los cobran (por pieza, por metro, un monto fijo)?

> Tu respuesta:

**8.** **Productos que se cobran por metro lineal** (por ejemplo, un perfil, un zoclo, una moldura): ¿se cobra por el **largo que se captura** o por el **perímetro** (alrededor de la pieza)? ☐ Largo ☐ Perímetro ☐ Depende del producto.

> Tu respuesta:

**9.** **Cobro mínimo:** ¿hay un área mínima que siempre se cobra aunque la pieza sea más chica, o un monto mínimo por trabajo? Si sí, ¿cuánto? *Si no sabes: se cobra exacto, sin mínimos.*

> Tu respuesta:

**10.** **Medidas:** ¿se redondean hacia arriba (por ejemplo, a múltiplos de 5 cm) antes de cobrar? *Si no sabes: se cobra la medida exacta.*

> Tu respuesta:

### Cotizaciones y descuentos

**15.** ⭐ **Descuentos:** ¿hay un máximo? ¿Quién puede darlos? ☐ Solo Luis y Ricardo ☐ Cualquiera hasta cierto porcentaje (¿cuál?). *Si no sabes: todo descuento necesita la autorización de un administrador.*

> Tu respuesta:

**17.** **Anticipo:** el sistema propone **50 %** en trabajos a medida y puertas o ventanas. ☐ Está bien ☐ Cambiar a ___ %. ¿Hay trabajos sin anticipo? ¿Cuáles?

> Tu respuesta:

**19.1.** **Cotización vencida:** si un cliente quiere aceptar una cotización cuya vigencia ya pasó, ¿se puede? ☐ Sí, avisando que los precios pueden haber cambiado ☐ No, hay que hacer una nueva. *Si no sabes: se puede aceptar con aviso.*

> Tu respuesta:

**19.5.** **Cotizaciones de otra tablet:** si Ricardo hace una cotización en su tablet, ¿Luis debe poder verla desde otra tablet o desde la computadora? ☐ Sí, siempre ☐ Solo la que cada quien hizo. *Si no sabes: cada tablet ve las suyas; el administrador ve todas desde la computadora.*

> Tu respuesta:

### Órdenes de trabajo

**20.** ⭐ **Entregas por partes:** ¿se entregan trabajos a medias (unas piezas hoy, otras después)? ☐ Nunca ☐ A veces. *Si no sabes: una orden se entrega completa.*

> Tu respuesta:

**21.** ⭐ **¿Se puede empezar a fabricar sin anticipo?** ☐ Nunca ☐ Con autorización de Luis o Ricardo ☐ Sí, libre.

> Tu respuesta:

**22.** **Medición final distinta de la cotizada:** si al medir en obra cambia el tamaño, ¿cómo se ajusta el precio y quién lo autoriza? ¿A partir de qué diferencia?

> Tu respuesta:

**23.** **Si se cancela una orden con anticipo:** ¿se devuelve, se queda o depende? ☐ Se devuelve ☐ Se queda ☐ Depende (¿de qué?).

> Tu respuesta:

**24.** **Tiempos de entrega:** ¿cuánto tarda normalmente cada tipo de trabajo (vidrio cortado, templado, cancelería, instalación)? ¿A partir de cuántos días se considera "atrasado"?

> Tu respuesta:

**25.** **Roturas y errores de medida:** ¿quién absorbe cada caso (el cliente, ZAMMIR, el instalador)? ¿Quieren anotar la causa?

> Tu respuesta:

**26.** **Medición a domicilio y flete:** ¿se cobran? ¿Se descuentan si el cliente contrata el trabajo? ¿Hay recargo fuera de Otumba?

> Tu respuesta:

**29.3.** **Pago de más:** si el cliente deja más dinero del saldo de su orden, el sistema solo cobra el saldo y el resto es cambio. ☐ Está bien ☐ Hace falta registrar un saldo a favor.

> Tu respuesta:

### Mostrador y caja

**30.** ⭐ **Caja compartida:** ¿cuántas personas cobran en un día? ¿Se relevan? ¿Cuentan el efectivo en cada relevo o solo al cierre? ¿A qué hora cierran?

> Tu respuesta:

**31.** ⭐ **Efectivo cobrado en obra o a domicilio:** ¿cómo se entrega ese dinero y cuándo entra al corte?

> Tu respuesta:

**32.** **Salidas del cajón** (gastos, depósitos, retiros): ¿existen y cómo se anotan hoy?

> Tu respuesta:

**33.** **Sobrante o faltante en el corte:** ¿qué diferencia se acepta y se pide explicación?

> Tu respuesta:

**34.** **Venta de mostrador cancelada:** ¿se devuelve el efectivo? ¿Quién autoriza?

> Tu respuesta:

**35.** **Transferencias:** ¿cómo comprueban que llegó el dinero? ¿Quieren marcarlas como "confirmadas"?

> Tu respuesta:

### Reportes e inicio

**39.** **"Ventas" en los reportes:** ¿se cuenta lo **cobrado** (efectivo recibido) o lo **contratado** (el valor de las órdenes)? *Si no sabes: lo cobrado.*

> Tu respuesta:

**40.** **Cuentas por cobrar viejas:** ¿a partir de cuántos días un saldo se considera "atrasado"? *Si no sabes: 10 días.*

> Tu respuesta:

---

## Parte C — Afinaciones

*Ya tienen una propuesta nuestra. Si está bien, déjala en blanco; solo corrígela si no te sirve. Unos 20 minutos.* (33 preguntas)

### Personas, permisos y datos del negocio

**44.** **Cierre de sesión del administrador en la computadora por inactividad:** proponemos **30 minutos**. ☐ Está bien ☐ Cambiar a ___.

> Tu respuesta:

**45.** **Bloqueo de la tablet por inactividad:** se propone **5 minutos**. ☐ Está bien ☐ Cambiar a ___.

> Tu respuesta:

**47.** **¿Quieren el texto "Powered by HummingX BI"** al pie de la aplicación? ☐ Sí ☐ No.

> Tu respuesta:

**49.** **¿Quieren un portal para que sus clientes vean el avance de su trabajo**? ☐ Sí ☐ No.

> Tu respuesta:

### Productos y catálogo

**5.** **Aluminio:** ¿venden también **perfil suelto** (por tramo) o solo cancelería ya armada? ☐ Solo armada ☐ También perfil suelto.

> Tu respuesta:

**6.** **Herrajes y accesorios** (bisagras, chapas, felpa, vinil…): ¿los quieren en una sola categoría o separados? ☐ Juntos ☐ Separados.

> Tu respuesta:

**7.** **¿Falta alguna categoría** de la propuesta (ver `CATEGORIAS_CATALOGO.md`)? Escribe cuáles.

> Tu respuesta:

**12.** **Código del producto:** ¿prefieres que el sistema lo genere solo (iniciales del nombre + número) o capturarlo tú? ☐ Automático ☐ Lo capturo yo.

> Tu respuesta:

**13.** **¿Quieren un campo de descripción** en cada producto? ☐ Sí ☐ No.

> Tu respuesta:

**14.** **Piezas estándar** (puertas, ventanas ya hechas): ¿quieren llevar **cuántas hay en existencia**? ☐ Sí ☐ No. ¿Y hojas de vidrio o material en bodega? ☐ Sí ☐ No.

> Tu respuesta:

### Cotizaciones y descuentos

**16.** **Vigencia de una cotización:** el sistema propone **15 días**. ☐ Está bien ☐ Cambiar a ___ días.

> Tu respuesta:

**18.** **¿Se puede convertir en orden solo una parte de una cotización?** ☐ Sí ☐ No.

> Tu respuesta:

**19.** **¿Quieren ver las cotizaciones por vencer** y cuántas se aceptan? ☐ Sí ☐ No.

> Tu respuesta:

**19.2.** **Cotización cancelada:** ¿hace falta "cancelar" una cotización ya enviada además de marcarla "rechazada"? ☐ Basta con rechazada ☐ Necesitamos cancelada con motivo. *Si no sabes: basta con rechazada; el folio se conserva.*

> Tu respuesta:

**19.3.** **Historial en la tablet:** ¿cuántos días de cotizaciones, órdenes y ventas debe tener a la mano cada tablet sin internet? ☐ 30 ☐ 90 ☐ 180 ☐ Todo. *Si no sabes: 90 días.*

> Tu respuesta:

**19.4.** **Aviso de documentos sin enviar:** ¿después de cuántas horas sin internet avisamos que hay documentos sin enviar? *Si no sabes: 6 horas.*

> Tu respuesta:

**19.6.** **Dos personas corrigen al mismo cliente:** si dos tablets cambian los datos de un mismo cliente al mismo tiempo, ¿queda bien que gane el último cambio que llegue (el anterior se guarda en la bitácora)? ☐ Sí ☐ No, avisar para decidir. *Si no sabes: gana el último.*

> Tu respuesta:

**19.7.** **Condiciones de la cotización:** ¿las tres condiciones iniciales (anticipo, vigencia, precios sujetos a cambio) son las correctas o prefieren otras? Se pueden cambiar en Configuración cuando quieran, pero conviene que el primer texto lo revise Luis.

> Tu respuesta:

### Órdenes de trabajo

**27.** **¿Quieren avisar al cliente por WhatsApp** cuando su trabajo esté listo? ☐ Sí ☐ No.

> Tu respuesta:

**28.** **¿Una orden puede quedar "detenida"** (esperando material o al cliente) con su motivo? ☐ Sí ☐ No.

> Tu respuesta:

**29.** **Reposiciones:** cuando se repone una pieza rota, ¿se registra ligada a la orden original, sin cobro? ☐ Sí ☐ No.

> Tu respuesta:

**29.1.** **Fotos de la medición:** ¿cuántas fotos suelen hacer falta por trabajo y quién debe poder verlas? *Si no sabes: hasta 10 por orden; las ven las tablets y los administradores.*

> Tu respuesta:

**29.2.** **Comprobante de trabajo:** ¿las condiciones del comprobante son las mismas de la cotización (anticipo, saldo contra entrega, tiempos)? ☐ Sí ☐ No, otras: ___. *Si no sabes: las mismas.*

> Tu respuesta:

### Mostrador y caja

**36.** **Si se reimprime un ticket,** ¿que salga marcado "COPIA"? ☐ Sí ☐ No.

> Tu respuesta:

**37.** **Productos de venta rápida:** ¿quieren una lista corta de los que más se venden en el mostrador? ☐ Sí ☐ No.

> Tu respuesta:

**37.1.** **Una caja o una por persona:** cuando dos personas cobran el mismo día, ¿cada quien abre y cierra **su propia caja** (y cuenta su efectivo), o hay **una sola caja** del local que se va relevando? *Si no sabes: cada persona tiene su caja.*

> Tu respuesta:

**37.2.** **Turno que cruza la medianoche:** si una caja se abre un día y se cierra al siguiente, ¿a qué día pertenece su corte? *Si no sabes: al día en que se abrió.*

> Tu respuesta:

**37.4.** **Cliente recurrente:** ¿a partir de cuántos trabajos **entregados** un cliente es "recurrente"? *Si no sabes: 2.*

> Tu respuesta:

**37.5.** **Leyenda del ticket:** ¿qué texto quieren abajo del ticket sobre cómo y hasta cuándo pedir su factura?

> Tu respuesta:

**37.6.** **Retiros de efectivo:** durante el día, ¿sacan dinero del cajón (por ejemplo, para pagar a un proveedor)? ¿Se debe anotar en el corte? *Si no sabes: no se anotan.*

> Tu respuesta:

### Reportes e inicio

**38.** **¿Qué quieren ver al abrir el sistema?** Ventas del día y por medio de pago, cuentas por cobrar, tendencia del último mes, trabajos en producción. ¿Tachan alguno o agregan otro? ¿Lo mismo para todos o distinto por persona?

> Tu respuesta:

**41.** **¿Una lista de "atención"** con órdenes atrasadas y saldos viejos? ☐ Sí ☐ No.

> Tu respuesta:

**42.** **Comparar contra el periodo anterior, metros cuadrados vendidos, productos más vendidos:** ¿les sirve? ☐ Sí ☐ No.

> Tu respuesta:

---

Gracias. Con tus respuestas ajustamos el sistema, cargamos lo real y agendamos la capacitación y la prueba en el local.

---

## Referencias internas (no se envía)

Para que Juanito anote cada respuesta donde corresponde: número de la pregunta → pendiente o requerimiento.

| Pregunta | Referencia |
|---|---|
| 1 | PD-49 |
| 2 | PD-49 |
| 3 | PD-49 |
| 4 | PD-02 |
| 5 | — |
| 6 | PD-49 |
| 7 | — |
| 8 | PD-25 |
| 9 | PD-02 |
| 10 | PD-02 |
| 11 | PD-03 |
| 12 | PP-05 |
| 13 | PP-04 |
| 14 | PD-14, PD-47 |
| 15 | PD-45 |
| 16 | — |
| 17 | — |
| 18 | PP-15 |
| 19 | PP-19 |
| 19.1 | Sprint 2, estados de la cotización |
| 19.2 | — |
| 19.3 | ventana de retención local |
| 19.4 | — |
| 19.5 | PP-20 |
| 19.6 | — |
| 19.7 | RN-13, S2-18 |
| 20 | PD-46 |
| 21 | PD-39 |
| 22 | PD-38 |
| 23 | PD-07 |
| 24 | PD-41 |
| 25 | PD-40 |
| 26 | PD-42 |
| 27 | PP-11 |
| 28 | PP-10 |
| 29 | PP-12 |
| 29.1 | S3-03 |
| 29.2 | S3-09 |
| 29.3 | S3-05 |
| 30 | PD-36 |
| 31 | PD-36 |
| 32 | PD-37 |
| 33 | PD-44 |
| 34 | PD-24 |
| 35 | PD-43 |
| 36 | PP-14 |
| 37 | PP-08 |
| 37.1 | PD-36, Sprint 3 |
| 37.2 | — |
| 37.3 | PD-15, Sprint 3 |
| 37.4 | Sprint 3 |
| 37.5 | PD-09, PD-10, Sprint 3 |
| 37.6 | PD-37, Sprint 3 |
| 38 | PD-31 |
| 39 | PD-08 |
| 40 | PD-33 |
| 41 | PP-07 |
| 42 | PP-13, PP-17, PP-18 |
| 43 | PD-17 |
| 44 | PD-21 |
| 45 | ADR-0013 |
| 46 | PD-11 |
| 47 | PD-30 |
| 48 | PD-06 |
| 49 | PD-13 |
| 50 | PD-04 |
| 51 | PD-27 |
| 52 | PD-28 |
| 53 | PD-09 |
| 54 | PD-29 |
| 55 | PD-15 |
| 56 | PD-16 |
| 57 | — |
| 58 | PD-10 |
| 59 | PD-12 |
| 60 | — |
| 61 | PD-29 |
| 62 | PD-52 |
| 63 | PD-11, PD-50 |
| 64 | ALCANCE §3 |
| 65 | RN-28 |
| 66 | PP-31 |
| 67 | PD-26 |
| 68 | RF-M10-15 |
| 69 | PD-04, PD-11 |
| 70 | PD-05, PD-10, PD-20 |
| 71 | Fase 9 |
| 72 | Fase 9.2 |
| 73 | RF-M9-04 |
| 74 | RNF-20, RNF-21 |
| 75 | PD-15, PD-16 |
