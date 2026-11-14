# Respuestas de Luis al cuestionario (8 de noviembre de 2026)

> Luis contestó las 35 preguntas del cuestionario HTML (`CUESTIONARIO_PARA_LUIS.html`) y las mandó por WhatsApp; Juanito las compartió el 14 de noviembre. Este documento guarda **qué contestó, qué cierra y qué falta**. Cada respuesta se aplicó en el documento que corresponde (`PENDIENTES.md`, `CATEGORIAS_CATALOGO.md`, el plan de aceptación y las decisiones).
>
> **Dato personal:** los nombres completos de Luis y de Ricardo (para el contrato) llegaron en la pregunta 1. **No se escriben en el repositorio** [ADR-0010]; viven en el contrato y en el WhatsApp del proyecto.

## Cómo se ve ZAMMIR y cómo habla

| # | Pregunta | Respuesta | Qué se hace |
|---|---|---|---|
| 2 | Nombre del negocio | **ZAMMIR** (con doble M) | Se queda así en todo el sistema. La tarjeta impresa dice "ZAMIR" con una sola M; Luis confirmó la doble M, así que al reimprimir tarjetas conviene corregirla |
| 3 | Tono con los clientes | **De usted**, formal y respetuoso | Todo texto que lee el cliente (cotización, ticket, mensaje de WhatsApp, portal de facturas, aviso de privacidad) va de usted [ADR-0037] |
| 4 | Qué deben sentir los clientes | Confianza (saben lo que hacen) y seguridad (su inversión está bien cuidada) | Guía el estilo: sobrio, claro, sin adornos de más |
| 5 | Momento del día | Una **mañana clara y fresca** | Fondos luminosos, cristal y aire |
| 6 | Paleta | **Verde vidrio** (verde botella y menta) | Identidad v2 [ADR-0037] |
| 7 | Letra | **Elegante y cálida** (Playfair Display) | Títulos en Playfair Display [ADR-0037] |

## Lo que hacen y venden

| # | Pregunta | Respuesta | Qué se hace |
|---|---|---|---|
| 13 | Trabajos a medida | Los 15 de la lista (vidrio cortado, templado, laminado, espejos, ventanas y puertas de aluminio, puertas de cristal, canceles de baño, mamparas, barandales, acrílico, policarbonato, domos y tragaluces, decorado o esmerilado, cubiertas para mesa) y además **canceles comerciales y vitrales** | `CATEGORIAS_CATALOGO.md` suma las dos |
| 18 | Mostrador (sin medida) | Los 12 de la lista: chapas, bisagras, jaladeras, felpa y vinil, silicones, rieles y rodajas, perfil suelto, tornillería, ventosas, vidrios y espejos chicos cortados, puertas y ventanas hechas, discos y consumibles | Se confirma el catálogo de mostrador |
| 22 | Qué más hacen | **Reparaciones de ventanas y puertas a domicilio, instalación y mantenimiento** | Categoría "Servicios" del catálogo (no hay que construir nada nuevo) |
| 14 | Canceles, mamparas y barandales | Depende del trabajo (precio armado o por separado) | Se cargan los dos modos; falta saber cuándo se usa cada uno (PD-49) |
| 15 | Cantos, perforaciones y biselados | Depende del trabajo; **por metro cuadrado** | Cargo adicional por m² en la regla de precio; falta la lista de cargos y su precio (PD-02) |
| 16 | Instalación | **Va incluida** en el precio | No se cobra aparte; no hay renglón de instalación |
| 17 | Medición y flete | **No se cobran** | PD-42 resuelto |
| 19 | Metro lineal | Se cobra por el **largo que se captura** | PD-25 resuelto |
| 20 | Cobro mínimo | **No**: se cobra la medida exacta | Sin mínimos ni redondeo en la regla básica |
| 21 | Existencias | **No**: solo cotizar y cobrar | P2 (existencias) sigue apagado; PD-14 y PD-47 resueltos |

## Cómo cobran y entregan

| # | Pregunta | Respuesta | Qué se hace |
|---|---|---|---|
| 23 | Descuentos | Solo Luis y Ricardo | Es lo que ya hace el sistema (PIN de administrador) |
| 24 | Anticipo | **Depende del trabajo** | Se queda el **50 % propuesto, editable** en cada orden; falta saber de qué depende |
| 25 | Fabricar sin anticipo | Con autorización de Luis o Ricardo | Es lo que ya hace el sistema |
| 26 | Cancelar con anticipo | **Depende** | Sigue abierto (PD-07): falta saber de qué depende |
| 27 | Medida distinta al medir | Se ajusta y lo autoriza Luis o Ricardo | Lo hace un administrador con motivo |
| 28 | Entregas por partes | **A veces** | Abierto (PD-46): el modelo es una entrega por orden; falta definir cómo se manejan las parciales |
| 29 | Tiempo de entrega | Depende del trabajo | Sin valor fijo (PD-41) |
| 30 | Garantía | Depende del producto; cubre piezas defectuosas o maltratadas de fábrica en perfiles, vidrio dañado, chapas, bisagras y herrajes | Se configura por producto; falta la duración de cada una (PD-06) |

## Caja, facturación y entrega

| # | Pregunta | Respuesta | Qué se hace |
|---|---|---|---|
| 31 | Personas que cobran | **Dos** | Cada persona abre y cierra su turno de caja |
| 32 | Efectivo cobrado en obra | Se entrega **el mismo día** | Entra al corte del día en que se entrega |
| 33 | Sacan dinero del cajón | **Sí** | Confirma que hacen falta retiros y gastos de caja (PP-09); se construye cuando Juanito lo apruebe |
| 34 | Internet en el mostrador | Wi-Fi estable | Sin cambios; sigue funcionando sin conexión |
| 9 | e.firma vigente | **No sé** | Hay que verificarla con el contador (PD-04): sin ella no hay certificado de sello digital |
| 10 | IVA 0 % o exento | **Sí, algunas cosas** | PD-53: falta saber cuáles y si son 0 % o exentas (el catálogo ya marca exento por producto) |
| 11 | Anticipos y factura | Lo que diga el contador | Sigue abierto (PD-27) |
| 12 | Quién factura | **Solo Luis y Ricardo** | PP-31 (cajero factura con PIN) **descartada**: no hace falta construirla |
| 8 | Qué mandan por WhatsApp | Sin contestar | Siguen faltando la constancia de situación fiscal, el logo en su archivo original y la lista de productos y precios (PD-03, PD-04, PD-11) |
| 35 | Días de capacitación y pruebas | **Sáb 28, dom 29 y lun 30 de noviembre** | Se agendan las tres sesiones; falta la hora (el plan de aceptación las usa) |

## Lo que sigue pendiente de Luis

1. La **constancia de situación fiscal**, el **logo en archivo original** y la **lista de productos y precios** (la más importante: sin ella no hay catálogo real).
2. Si tienen **e.firma vigente** (con su contador).
3. Qué productos llevan **IVA 0 % o exento**.
4. **De qué depende** el anticipo, qué pasa con él al cancelar y cuánto dura la garantía de cada producto.
5. Cómo manejan las **entregas por partes**.
6. La **hora** de las tres sesiones del 28, 29 y 30 de noviembre.
