# Cuestionario para Luis (una sola ronda)

> **Documento vivo.** Cada duda de negocio que surja mientras se construye se agrega aquí, con su referencia a `PENDIENTES.md`. Cuando Juanito decida que ya está completo, se manda **una sola vez** y se resuelve todo de golpe, para quitarle el mínimo de tiempo a Luis.
> **Estado:** en construcción (29 oct 2026). Última actualización: ver historial de git.
> Para enviarlo se genera una versión limpia (sin la sección "Interno") por WhatsApp, correo o documento compartido.

## Cómo está organizado

- Cada pregunta trae **opciones rápidas** y **qué haremos si no se sabe o no se contesta**: así Luis puede dejar en blanco lo que no tenga a la mano y nada se detiene.
- Las preguntas están **ordenadas por urgencia** dentro de cada tema. Las marcadas con ⭐ conviene contestarlas primero.
- Las respuestas no se guardan en el chat: se anotan en `PENDIENTES.md` y en el documento que corresponda.

---

## Texto de presentación para Luis

> Luis, estamos construyendo el sistema y necesitamos que nos confirmes cómo trabajan para no inventar nada. Son preguntas de opción rápida; si alguna no la sabes o prefieres pensarla, déjala en blanco y seguimos con la opción que dice "si no sabes". Con 20 o 30 minutos queda todo cubierto. Gracias.

---

## 1. Productos y catálogo

1. ⭐ **¿Venden vidrio laminado?** ☐ Sí ☐ No. *Si no sabes: lo dejamos como categoría apagada.* (PD-49)
2. ⭐ **¿Venden acrílico o policarbonato?** ☐ Acrílico ☐ Policarbonato ☐ Ambos ☐ Ninguno. (PD-49)
3. ⭐ **Canceles de baño, mamparas, barandales y puertas de cristal:** ¿se cotizan con un solo precio ya armado, o se cobra el vidrio y los herrajes por separado? ☐ Un solo precio ☐ Por separado ☐ Depende. (PD-49)
4. ⭐ **Cantos pulidos, perforaciones, biselados y otros trabajos de taller:** ¿se cobran aparte o van incluidos en el precio del vidrio? ☐ Aparte ☐ Incluidos ☐ Depende del trabajo. Si es aparte, ¿cómo los cobran (por pieza, por metro, un monto fijo)? (PD-02)
5. **Aluminio:** ¿venden también **perfil suelto** (por tramo) o solo cancelería ya armada? ☐ Solo armada ☐ También perfil suelto.
6. **Herrajes y accesorios** (bisagras, chapas, felpa, vinil…): ¿los quieren en una sola categoría o separados? ☐ Juntos ☐ Separados. (PD-49)
7. **¿Falta alguna categoría** de la propuesta (ver `CATEGORIAS_CATALOGO.md`)? Escribe cuáles.
8. **Productos que se cobran por metro lineal** (por ejemplo, un perfil, un zoclo, una moldura): ¿se cobra por el **largo que se captura** o por el **perímetro** (alrededor de la pieza)? ☐ Largo ☐ Perímetro ☐ Depende del producto. (PD-25)
9. **Cobro mínimo:** ¿hay un área mínima que siempre se cobra aunque la pieza sea más chica, o un monto mínimo por trabajo? Si sí, ¿cuánto? *Si no sabes: se cobra exacto, sin mínimos.* (PD-02)
10. **Medidas:** ¿se redondean hacia arriba (por ejemplo, a múltiplos de 5 cm) antes de cobrar? *Si no sabes: se cobra la medida exacta.* (PD-02)
11. **¿Cuándo nos puedes pasar la lista real de productos y precios** (entre 50 y 150)? Una hoja de Excel o fotos de la lista sirven. (PD-03)
12. **Código del producto:** ¿prefieres que el sistema lo genere solo (iniciales del nombre + número) o capturarlo tú? ☐ Automático ☐ Lo capturo yo. (PP-05)
13. **¿Quieren un campo de descripción** en cada producto? ☐ Sí ☐ No. (PP-04)
14. **Piezas estándar** (puertas, ventanas ya hechas): ¿quieren llevar **cuántas hay en existencia**? ☐ Sí ☐ No. ¿Y hojas de vidrio o material en bodega? ☐ Sí ☐ No. (PD-14, PD-47)

## 2. Cotizaciones y descuentos

15. ⭐ **Descuentos:** ¿hay un máximo? ¿Quién puede darlos? ☐ Solo Luis y Ricardo ☐ Cualquiera hasta cierto porcentaje (¿cuál?). *Si no sabes: todo descuento necesita la autorización de un administrador.* (PD-45)
16. **Vigencia de una cotización:** el sistema propone **15 días**. ☐ Está bien ☐ Cambiar a ___ días.
17. **Anticipo:** el sistema propone **50 %** en trabajos a medida y puertas o ventanas. ☐ Está bien ☐ Cambiar a ___ %. ¿Hay trabajos sin anticipo? ¿Cuáles?
18. **¿Se puede convertir en orden solo una parte de una cotización?** ☐ Sí ☐ No. (PP-15)
19. **¿Quieren ver las cotizaciones por vencer** y cuántas se aceptan? ☐ Sí ☐ No. (PP-19)
    - **19.1 Cotización vencida:** si un cliente quiere aceptar una cotización cuya vigencia ya pasó, ¿se puede? ☐ Sí, avisando que los precios pueden haber cambiado ☐ No, hay que hacer una nueva. *Si no sabes: se puede aceptar con aviso.* (Sprint 2, estados de la cotización)
    - **19.2 Cotización cancelada:** ¿hace falta "cancelar" una cotización ya enviada además de marcarla "rechazada"? ☐ Basta con rechazada ☐ Necesitamos cancelada con motivo. *Si no sabes: basta con rechazada; el folio se conserva.*
    - **19.3 Historial en la tablet:** ¿cuántos días de cotizaciones, órdenes y ventas debe tener a la mano cada tablet sin internet? ☐ 30 ☐ 90 ☐ 180 ☐ Todo. *Si no sabes: 90 días.* (ventana de retención local)
    - **19.4 Aviso de documentos sin enviar:** ¿después de cuántas horas sin internet avisamos que hay documentos sin enviar? *Si no sabes: 6 horas.*
    - **19.5 Cotizaciones de otra tablet:** si Ricardo hace una cotización en su tablet, ¿Luis debe poder verla desde otra tablet o desde la computadora? ☐ Sí, siempre ☐ Solo la que cada quien hizo. *Si no sabes: cada tablet ve las suyas; el administrador ve todas desde la computadora.* (PP-20)
    - **19.6 Dos personas corrigen al mismo cliente:** si dos tablets cambian los datos de un mismo cliente al mismo tiempo, ¿queda bien que gane el último cambio que llegue (el anterior se guarda en la bitácora)? ☐ Sí ☐ No, avisar para decidir. *Si no sabes: gana el último.*
    - **19.7 Condiciones de la cotización:** ¿las tres condiciones iniciales (anticipo, vigencia, precios sujetos a cambio) son las correctas o prefieren otras? Se pueden cambiar en Configuración cuando quieran, pero conviene que el primer texto lo revise Luis. (RN-13, S2-18)

## 3. Órdenes de trabajo y producción

20. ⭐ **Entregas por partes:** ¿se entregan trabajos a medias (unas piezas hoy, otras después)? ☐ Nunca ☐ A veces. *Si no sabes: una orden se entrega completa.* (PD-46)
21. ⭐ **¿Se puede empezar a fabricar sin anticipo?** ☐ Nunca ☐ Con autorización de Luis o Ricardo ☐ Sí, libre. (PD-39)
22. **Medición final distinta de la cotizada:** si al medir en obra cambia el tamaño, ¿cómo se ajusta el precio y quién lo autoriza? ¿A partir de qué diferencia? (PD-38)
23. **Si se cancela una orden con anticipo:** ¿se devuelve, se queda o depende? ☐ Se devuelve ☐ Se queda ☐ Depende (¿de qué?). (PD-07)
24. **Tiempos de entrega:** ¿cuánto tarda normalmente cada tipo de trabajo (vidrio cortado, templado, cancelería, instalación)? ¿A partir de cuántos días se considera "atrasado"? (PD-41)
25. **Roturas y errores de medida:** ¿quién absorbe cada caso (el cliente, ZAMMIR, el instalador)? ¿Quieren anotar la causa? (PD-40)
26. **Medición a domicilio y flete:** ¿se cobran? ¿Se descuentan si el cliente contrata el trabajo? ¿Hay recargo fuera de Otumba? (PD-42)
27. **¿Quieren avisar al cliente por WhatsApp** cuando su trabajo esté listo? ☐ Sí ☐ No. (PP-11)
28. **¿Una orden puede quedar "detenida"** (esperando material o al cliente) con su motivo? ☐ Sí ☐ No. (PP-10)
29. **Reposiciones:** cuando se repone una pieza rota, ¿se registra ligada a la orden original, sin cobro? ☐ Sí ☐ No. (PP-12)

## 4. Mostrador y caja

30. ⭐ **Caja compartida:** ¿cuántas personas cobran en un día? ¿Se relevan? ¿Cuentan el efectivo en cada relevo o solo al cierre? ¿A qué hora cierran? (PD-36)
31. ⭐ **Efectivo cobrado en obra o a domicilio:** ¿cómo se entrega ese dinero y cuándo entra al corte? (PD-36)
32. **Salidas del cajón** (gastos, depósitos, retiros): ¿existen y cómo se anotan hoy? (PD-37)
33. **Sobrante o faltante en el corte:** ¿qué diferencia se acepta y se pide explicación? (PD-44)
34. **Venta de mostrador cancelada:** ¿se devuelve el efectivo? ¿Quién autoriza? (PD-24)
35. **Transferencias:** ¿cómo comprueban que llegó el dinero? ¿Quieren marcarlas como "confirmadas"? (PD-43)
36. **Si se reimprime un ticket,** ¿que salga marcado "COPIA"? ☐ Sí ☐ No. (PP-14)
37. **Productos de venta rápida:** ¿quieren una lista corta de los que más se venden en el mostrador? ☐ Sí ☐ No. (PP-08)

## 5. Reportes y panel de inicio

38. **¿Qué quieren ver al abrir el sistema?** Ventas del día y por medio de pago, cuentas por cobrar, tendencia del último mes, trabajos en producción. ¿Tachan alguno o agregan otro? ¿Lo mismo para todos o distinto por persona? (PD-31)
39. **"Ventas" en los reportes:** ¿se cuenta lo **cobrado** (efectivo recibido) o lo **contratado** (el valor de las órdenes)? *Si no sabes: lo cobrado.* (PD-08)
40. **Cuentas por cobrar viejas:** ¿a partir de cuántos días un saldo se considera "atrasado"? *Si no sabes: 10 días.* (PD-33)
41. **¿Una lista de "atención"** con órdenes atrasadas y saldos viejos? ☐ Sí ☐ No. (PP-07)
42. **Comparar contra el periodo anterior, metros cuadrados vendidos, productos más vendidos:** ¿les sirve? ☐ Sí ☐ No. (PP-13, PP-17, PP-18)

## 6. Personas, permisos y datos del negocio

43. **¿Luis y Ricardo tienen exactamente los mismos permisos?** ☐ Sí ☐ No (¿qué cambia?). (PD-17)
44. **Cierre de sesión del administrador en la computadora por inactividad:** proponemos **30 minutos**. ☐ Está bien ☐ Cambiar a ___. (PD-21)
45. **Bloqueo de la tablet por inactividad:** se propone **5 minutos**. ☐ Está bien ☐ Cambiar a ___. (ADR-0013)
46. ⭐ **Datos del negocio para tickets y documentos:** nombre completo, domicilio, teléfono, correo, logo y colores. (PD-11)
47. **¿Quieren el texto "Powered by HummingX BI"** al pie de la aplicación? ☐ Sí ☐ No. (PD-30)
48. **Garantía:** ¿cuánto dura, qué cubre y qué excluye? ¿Cambia por producto? (PD-06)
49. **¿Quieren un portal para que sus clientes vean el avance de su trabajo**? ☐ Sí ☐ No. (PD-13)

## 7. Facturación y datos fiscales (Luis y su contador)

> Estas las puede contestar el contador de ZAMMIR directamente.

50. ⭐ **Trámite del certificado de sello digital (CSD):** ¿ya tienen e.firma vigente? ¿Pueden iniciar el trámite del CSD ahora? Puede tardar. Necesitamos RFC, régimen fiscal, y los archivos `.cer`, `.key` y su contraseña **que ZAMMIR sube directo al proveedor de timbrado, no a nosotros**. (PD-04)
51. **Anticipos:** ¿se factura **una sola vez al liquidar**, o se emite una factura por el anticipo y otra al final? (PD-27)
52. **Pago mixto** (parte efectivo, parte transferencia): ¿qué forma de pago debe llevar la factura? (PD-28)
53. **Autofacturación:** el cliente puede pedir su factura hasta el **último día del mes** de su compra. ¿Está bien? (PD-09)
54. **Claves del SAT** de cada categoría de producto (producto o servicio, unidad, objeto de impuesto): ¿las revisa su contador cuando tengamos las categorías cerradas? (PD-29)

## 8. Equipo, local y avisos

55. **Impresora:** la candidata es **Epson TM-m30III-052**. La ficha de la tienda se contradice en Wi-Fi y Bluetooth: ¿pueden preguntarle al vendedor qué conexiones trae esa variante **antes de comprar**? ¿Cuántas impresoras se necesitan? (PD-15)
56. **Tablets:** la candidata es **Samsung Galaxy Tab A9+ 5G**. ¿Cuántas se necesitan? ¿La de obra necesita datos móviles? (PD-16)
57. **Internet en el local:** ¿hay Wi-Fi estable donde está el mostrador? ¿Quién lo administra?
58. **Dirección web propia** (dominio): ¿ZAMMIR ya tiene una, o prefieren que se compre una nueva? **No se puede cambiar después de imprimir los primeros tickets**, porque los códigos QR apuntan a ella. (PD-10)
59. **Aviso de privacidad y términos:** ¿tienen un asesor legal que revise el texto final? (PD-12)
60. **¿Pueden dedicar a una persona 30 minutos para probar el sistema** con datos reales cuando esté listo para pruebas?

---

## Interno: no se envía a Luis

Pendientes que no dependen de Luis, para no perderlos de vista:

| Pendiente | Responsable |
|---|---|
| PD-05 Elegir el proveedor de timbrado (PAC) y quién lo contrata | Juanito |
| PD-19 Pasar a privado el repositorio de la demo (**urgente**, tiene datos del cliente) | Juanito |
| PD-20 Costo mensual de hosting en producción, para el contrato | Juanito |
| PD-22 Intentos fallidos de PIN y duración del bloqueo | Juanito |
| PD-23 Año del folio si se crea sin internet el 31 de diciembre y se envía en enero | Juanito |
| PD-26 Límite anual de timbres del paquete incluido en la anualidad | Juanito |
| PD-32 Retención de respaldos (30 días) del plan de Supabase | Juanito |
| PD-35 Identidad visual definitiva | Juanito |
| Proyectos de pruebas de Supabase y Vercel (S0-06) | Juanito |
| Tablet y impresora para las pruebas manuales (S0-09, S0-18, S0-20) | Juanito |

## Historial de este documento

| Fecha | Cambio |
|---|---|
| 29 oct 2026 | Primera versión: 60 preguntas de `PENDIENTES.md`, `CATEGORIAS_CATALOGO.md` y las propuestas PP-04 a PP-19. |
| 31 oct 2026 | Sprint 2: preguntas 19.5 a 19.7 (cotizaciones entre tablets, cambios simultáneos a un cliente, condiciones). |
