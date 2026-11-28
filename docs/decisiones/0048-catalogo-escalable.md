# ADR-0048: Catálogo escalable: precio abierto, unidad de venta, decimales, paquetes y precios en bloque

- **Estado:** Aceptada
- **Fecha:** 2026-11-27
- **Decide:** Juanito (HummingX BI), sobre la propuesta de Claude
- **Plan:** [`docs/plan/fase-11-catalogo-escalable.md`](../plan/fase-11-catalogo-escalable.md)
- **Requerimientos:** RF-M1-10 a RF-M1-18
- **Cierra:** PP-04 (descripción del producto)
- **Se apoya en:** [ADR-0006] (reglas de precio en un registro), [ADR-0011] (redondeo), [ADR-0020] (importación todo o nada), [ADR-0022] (catálogo en la tablet) y [ADR-0044] (categorías y cargos extra)

## Contexto

Juanito quiere que Luis pueda dar de alta **cualquier producto o servicio** que venda sin ayuda técnica. La investigación del mercado y la auditoría del código del 27 de noviembre encontraron estos límites:

- Solo hay cuatro unidades de cobro, y están fijas en seis lugares.
- Las cantidades son enteras.
- El precio del catálogo es un tope en la tablet.
- No hay descripción, paquetes ni forma de cambiar precios en bloque.
- Los mínimos y el redondeo existen en el cálculo, pero no se pueden capturar.
- El mostrador oculta los cargos extra.

Hoy pasan 3 de los 15 casos reales del plan.

## Decisión

### Decisiones de negocio (Juanito, 27 nov)

1. **D1 · Precio abierto.** Un producto marcado "precio abierto" tiene un precio de **referencia**. Cualquier persona puede fijar el precio al cotizar o vender. Si queda **debajo** de la referencia, es un descuento y sigue pidiendo el PIN de un administrador, como hoy (PR-20). Todo queda en la bitácora.
2. **D2 · Decimales.** Las cantidades con decimales llevan **3 decimales**. El importe se calcula y redondea como ya dice [ADR-0011]: precio × medidas × cantidad, redondeado **una sola vez** al centavo, la mitad hacia arriba.
3. **D3 · Precios por porcentaje.** Al subir o bajar precios por porcentaje, el precio nuevo se redondea **al peso**. Por omisión se redondea hacia arriba; quien hace el cambio puede elegir otro redondeo en la vista previa.

### Decisiones técnicas

4. **Lo nuevo no rompe lo de antes.** Toda columna nueva es aditiva y trae valor por omisión, y ninguna migración vieja se edita. Todo campo nuevo es **opcional** en el envío desde la tablet: una tablet con la versión anterior sigue funcionando y el servidor acepta las dos formas.
5. **La unidad de venta es un nombre, no una regla nueva.** "rollo", "kilo", "juego", "par", "cartucho", "hora", etc. se guardan en el producto (`sale_unit_name`) y se copian al renglón. El cálculo sigue siendo cantidad × precio. Las unidades de cobro fijas (m², metro lineal, pieza y servicio) no cambian.
6. **La clave SAT se edita por producto.** Los datos fiscales ya viven en el producto. Se pueden editar en el formulario y en la importación, y si se dejan vacíos se heredan de la categoría.
7. **Los decimales van en milésimas enteras.** La cantidad se guarda como entero en milésimas (`quantity_milli`), así el dinero se sigue calculando sin números con punto flotante [RN-05]. Solo la aceptan los productos marcados para ello.
8. **Un paquete se convierte en renglones normales.** El tipo de producto nuevo es `BUNDLE`. Al agregarlo, se convierte en un renglón por componente, cada uno con su regla, precio e IVA. Las ventas, órdenes, documentos y el envío desde la tablet **no cambian**.
9. **Actualizar en bloque sigue siendo todo o nada** [ADR-0020]. Cada cambio de precio queda en el historial, que no se borra [RN-19].
10. **Medida máxima.** Es un parámetro nuevo de las reglas de área y de metro lineal, apagado por omisión.

## Consecuencias

- Nueve historias (CE-01 a CE-09), cada una en su PR con la compuerta completa, en el orden del plan.
- La fase no se fusiona antes de la entrega del 28 al 30 de noviembre salvo que Juanito lo diga. Mientras tanto, producción no cambia.
- La tabla de casos de oro de dinero (`docs/calidad/CASOS_DE_ORO_DINERO.md`) gana casos con decimales, y Juanito los valida [00 §4.3 regla 7].
- El manual de usuario y la guía rápida del administrador se actualizan al cerrar la fase.
- Fuera de esta decisión: fotos, IVA 0 % frente a exento (PD-53, con la facturación), existencias (P2), subcategorías e importación desde `.xlsx`.

## Alternativas consideradas

- **Unidades nuevas como reglas de precio** (kilo, rollo…): habría que cambiar las unidades fijas de seis lugares y del envío desde la tablet, sin ganar nada en el cálculo. Se descartó.
- **Cantidades con punto flotante:** se descartó porque el dinero no se calcula con flotantes [RN-05].
- **Paquetes como renglón compuesto:** se descartó porque cambiaría ventas, órdenes, documentos, reportes y el envío desde la tablet.
- **Precio abierto solo para administradores:** Juanito eligió que lo fije cualquiera y que solo el descuento pida PIN.
