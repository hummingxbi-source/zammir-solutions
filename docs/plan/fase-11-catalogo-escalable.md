# Fase 11 — Catálogo escalable

- **Tipo:** código
- **Estado:** **aprobada** por Juanito el 27 nov 2026, con las decisiones D1 a D3 [ADR-0048]. Se construye en ramas; no se fusiona antes de la entrega salvo que Juanito lo diga.
- **Fechas:** desde el 27 nov 2026
- **Origen:** investigación del mercado de vidrio y aluminio y auditoría del módulo de catálogo (27 nov 2026). El reporte está en la carpeta local `privado/investigacion/`, fuera del repositorio.
- **Lee antes:** [00 §1, §4, §5 y §6](00-principios-de-ingenieria.md), `docs/arquitectura/SINCRONIZACION.md`, `docs/arquitectura/MODELO_DE_DATOS.md`, [ADR-0006], [ADR-0020], [ADR-0022] y [ADR-0044]

## Objetivo

Que Luis pueda dar de alta **cualquier producto o servicio que venda**, cobrarlo **en la unidad y la cantidad en que lo vende**, darle el detalle que necesita y mantener sus precios, **sin pedirle nada a HummingX**. Todo debe seguir funcionando sin internet en la tablet.

**Fuera de esta fase:**
- las fotos de producto, por decisión de Juanito del 27 nov;
- la distinción entre IVA 0 % y exento, que va con la reactivación de la facturación (PD-53, [ADR-0039]);
- las existencias (P2), las subcategorías y la importación desde Excel `.xlsx`.

## Qué significa "100 % escalable": la prueba que debe pasar

La fase termina cuando estos 15 casos, sacados de la investigación, se dan de alta **desde la pantalla o el archivo de importación**, sin tocar código. Cada uno se debe poder cotizar, vender, imprimir y enviar desde la tablet sin internet, y el servidor lo debe recibir igual.

| # | Caso real | Hoy | Historia que lo resuelve |
|---|---|---|---|
| 1 | Cristal templado 10 mm por m², con área mínima de 0.5 m² si Luis la quiere | El cálculo existe, pero no hay dónde capturar el mínimo | CE-05 |
| 2 | Espejo a medida que no pase de 1.80 × 2.60 m | No hay medida máxima | CE-05 |
| 3 | Felpa por metro, cortada del rollo | ✅ Metro lineal por largo | — |
| 4 | Vinil por kilo: 1.5 kg | No: sin kilo ni cantidades con decimales | CE-02 y CE-03 |
| 5 | Silicón por cartucho, tela mosquitera por rollo y carretillas por par | Solo dice "pieza" | CE-02 |
| 6 | Hora de trabajo: 1.5 h | No: sin decimales | CE-03 |
| 7 | Reparación "que depende del trabajo", con precio que se fija al cotizar | No: el precio del catálogo es tope | CE-01 |
| 8 | Canto pulido por metro lineal del perímetro, y barreno por pieza | ✅ Cargo extra configurable | — |
| 9 | Vidrio con canto vendido en el mostrador | No: el mostrador oculta los cargos extra | CE-08 |
| 10 | Kit de cancel de baño: vidrio + kit + tubo en un solo toque | No hay paquetes | CE-09 |
| 11 | Hoja completa de policarbonato | ✅ Pieza estándar | — |
| 12 | Cinco espesores del mismo vidrio sin capturar cinco veces todo | Se captura uno por uno | CE-07 |
| 13 | Descripción del producto (qué incluye, para qué sirve) | No existe (PP-04) | CE-04 |
| 14 | Subir 8 % los precios de toda la categoría Herrajes | Uno por uno; la importación solo da de alta | CE-06 |
| 15 | Clave SAT de un producto distinta a la de su categoría | Se hereda y no se puede cambiar | CE-02 |

## Lo que ya se verificó en el código (27 nov)

| Hallazgo | Evidencia |
|---|---|
| **Tipos y unidades fijos.** 4 tipos (`CUSTOM`, `STANDARD`, `SERVICE`, `EXTRA`) y 4 unidades (`SQUARE_METER`, `LINEAR_METER`, `PIECE`, `SERVICE`) | `packages/core/src/modules/catalog/domain/product.ts:10-13` y `:78-84` |
| **Las mismas unidades están fijas en 6 lugares**: la tabla de productos, las tres tablas de renglones y el esquema de envío de la tablet | `supabase/migrations/20261030100000_catalog.sql:43-44`, `20261125070000_cargos_extra.sql:22-29`, `20261030200000_quotes.sql:50`, `20261031100000_orders_payments.sql:127`, `20261031120000_counter_sales.sql:58`, `packages/core/src/modules/sync/domain/operation.ts:82` y `:94` |
| **Cantidades enteras en todo el sistema** | `pricing/rules.ts:26-27` (`Number.isInteger`); columnas `quantity integer` en `quotes.sql:56`, `orders_payments.sql:134` y `counter_sales.sql:65`; `operation.ts:86` |
| **Mínimos y redondeo ya existen en el cálculo, pero no se capturan** | `pricing/rules.ts:50-61`; el formulario solo guarda la base del metro lineal (`apps/web/src/modules/catalog/ui/FormularioDeProducto.tsx:131-133`) |
| **El precio del catálogo es tope solo en la tablet.** El servidor no rechaza un precio mayor: solo manda a revisión un descuento sin autorización | `packages/core/src/modules/quotes/domain/quote-line.ts:17` y `:289`; `packages/core/src/modules/sync/application/operation-receiver.ts:171-178` |
| **La importación solo da de alta**: rechaza un código que ya existe | `packages/core/src/modules/catalog/domain/import/analyze.ts:194-199` |
| **Clave SAT heredada de la categoría**, sin forma de cambiarla por producto | `FormularioDeProducto.tsx:134` |
| **El mostrador oculta los cargos extra**, aunque la venta ya los guarda | `apps/web/src/modules/counter/ui/Mostrador.tsx:169-173`; `packages/core/src/modules/counter/application/counter-use-cases.ts:180` |
| **Sin descripción ni atributos** en el producto | `product.ts:33-49` |

**Lo que ya escala bien, y no se toca:**
- el registro de reglas de precio [ADR-0006];
- las categorías que administra Luis (AJ-08);
- los cargos extra configurables (AJ-09);
- la importación todo o nada [ADR-0020];
- la réplica incremental a la tablet [ADR-0022].

## Alcance: nueve historias

Cada historia va en su rama y su PR, con pruebas primero y la compuerta completa: mutación del dominio, base de datos, integración y extremo a extremo.

| # | Historia | Casos | Esfuerzo | Riesgo |
|---|---|---|---|---|
| CE-01 | **Precio abierto** por producto: el precio del catálogo es de referencia y el precio se fija al cotizar o vender | 7 | 10 h | Medio |
| CE-02 | **Unidad de venta y clave SAT por producto**: "rollo", "kilo", "juego", "par", "cartucho", "hoja", "visita", "hora"…, con su clave de unidad | 4, 5, 15 | 10 h | Medio |
| CE-03 | **Cantidades con decimales** para lo que se vende por kilo, por metro sin medidas o por hora | 4, 6 | 18 h | **Alto** |
| CE-04 | **Descripción** del producto (PP-04) | 13 | 6 h | Bajo |
| CE-05 | **Mínimos, redondeo y medida máxima** desde la pantalla y la importación | 1, 2 | 7 h | Bajo |
| CE-06 | **Precios en bloque**: importar para actualizar por código y subir o bajar por porcentaje una categoría | 14 | 10 h | Medio |
| CE-07 | **Duplicar producto** para crear variantes de espesor, tono o acabado en segundos | 12 | 3 h | Bajo |
| CE-08 | **Cargos extra en el mostrador** | 9 | 6 h | Bajo |
| CE-09 | **Paquetes**: un producto que agrega varios renglones de una vez, cada uno con su precio | 10 | 12 h | Medio |
| | **Total** | | **≈ 82 h (2 semanas)** | |

## Diseño por historia

### CE-01 · Precio abierto

- **Producto:** campo nuevo `priceMode`, con dos valores: `FIXED` (hoy) y `OPEN` (abierto). Columna aditiva `price_mode text not null default 'FIXED'`. Se replica a la tablet y se captura en el formulario y en la importación (columna `precio_abierto: si/no`).
- **Cotizador, órdenes y mostrador:** en un producto abierto, el vendedor escribe el precio del renglón. El precio del catálogo se muestra como **referencia**. Hoy el mostrador no permite cambiar precios: hay que agregarlo para estos productos.
- **Regla de autorización:** **decisión D1** (abajo).
- **Servidor:** ya acepta un precio distinto. La bitácora debe distinguir "precio abierto fijado por X" de "descuento". Se agrega el motivo en el registro de la operación, sin rechazar operaciones viejas.
- **Pruebas:** dominio (`quote-line`, `ticket`), mutación, recepción de operaciones de una tablet con versión vieja, y extremo a extremo del flujo.

### CE-02 · Unidad de venta y clave SAT por producto

- **Producto:** campo nuevo `saleUnitName` (texto corto, opcional), solo para productos que se cobran por pieza o por servicio. Por ejemplo: "rollo", "kilo", "juego", "par", "cartucho", "hoja", "tramo", "visita" u "hora".
  - **No** cambia cómo se calcula: sigue siendo cantidad por precio. Por eso **no** hace falta tocar las unidades fijas de las 6 tablas ni del esquema de envío.
  - Lista de sugerencias editable en Configuración, para que todos escriban igual.
- **Renglones:** cada renglón guarda una copia de la unidad de venta. Columna nueva opcional en las tres tablas y campo opcional en el esquema de envío; una tablet vieja que no lo mande sigue siendo válida. Se muestra en el cotizador, en el comprobante y en el PDF: "2 rollos de felpa".
- **Clave SAT por producto:** el producto ya guarda sus datos fiscales (`product.ts:46`). Solo falta poder editarlos en el formulario y en la importación (columnas opcionales `clave_sat`, `clave_unidad_sat`). Si quedan vacíos, se heredan de la categoría.

### CE-03 · Cantidades con decimales (la más delicada)

- **Producto:** marca nueva `allowsDecimalQuantity`, solo para pieza o servicio con unidad de venta. Ejemplos: 1.5 kg o 2.5 h.
- **Cantidad:** se guarda como **entero en milésimas** (`quantity_milli`), así el dinero se sigue calculando con enteros [RN-05, ADR-0011].
  - Las columnas `quantity` actuales se conservan.
  - Se agrega `quantity_milli` con un valor calculado para lo viejo; ninguna migración vieja se edita.
- **Cálculo:** importe = precio × milésimas ÷ 1000, redondeado una sola vez al centavo, la mitad hacia arriba, **en el módulo único de dinero** [RN-05, ADR-0011]. Cuántos decimales es la **decisión D2**.
- **Envío desde la tablet:** acepta `quantityMilli` opcional; si no viene, sigue usando `quantity`. Las tablets con versión vieja no se rompen.
- **Reportes** de lo más vendido, **documentos** y **exportación** muestran los decimales.
- **Pruebas:** casos de oro de dinero con decimales en `CASOS_DE_ORO_DINERO.md`, mutación crítica, pgTAP de las columnas nuevas, integración con operaciones viejas y nuevas mezcladas, y extremo a extremo.
- **Riesgo alto:** toca dinero, base, envío, reportes y documentos. Va al final, con su propio PR y sin prisa.

### CE-04 · Descripción

- Campo `description` (texto, opcional, hasta 500 caracteres), en el formulario, la importación (`descripcion`) y la réplica a la tablet.
- Se ve en el buscador del cotizador y del mostrador. En el documento para el cliente, solo si el producto lo marca.
- Cierra PP-04.

### CE-05 · Mínimos, redondeo y medida máxima

- El cálculo ya admite `measureStepMm`, `minAreaMm2` y `minAmountCents` (`rules.ts:50-61`). Se agregan al formulario, en una sección "Ajustes del cobro", y a la importación como columnas opcionales.
- Parámetros nuevos `maxWidthMm` y `maxHeightMm`. Si la medida los pasa, el sistema dice qué hacer.
- Por omisión, todo **apagado**, como lo pidió Luis: sin mínimo y con la medida exacta. Solo cambia si él lo captura.

### CE-06 · Precios en bloque

- **Importar para actualizar:** modo nuevo de la importación. Actualiza **por código** el precio, el nombre y la descripción. Sigue siendo todo o nada, y cada cambio de precio queda en el historial, que no se borra [RN-19].
- **Subir o bajar por porcentaje** una categoría completa:
  - primero muestra una vista previa con antes y después;
  - se confirma con la sesión de administrador;
  - queda en la bitácora.
- Cómo se redondea el precio nuevo es la **decisión D3**.

### CE-07 · Duplicar producto

- Botón **Duplicar** en el catálogo: abre el formulario lleno con "(copia)" en el nombre, para cambiar espesor, tono o precio y guardar.
- Solo es pantalla; no toca la base.

### CE-08 · Cargos extra en el mostrador

- La venta de mostrador ya guarda cargos extra (`counter-use-cases.ts:180`). Falta la pantalla: agregarlos a un renglón de vidrio en el ticket, igual que en el cotizador.

### CE-09 · Paquetes

- Tipo de producto nuevo `BUNDLE` (paquete): una lista de productos con su cantidad. Por ejemplo, "Cancel de baño corredizo" = templado 8 mm + kit + tubo.
- **Al agregarlo, se convierte en renglones normales**, cada uno con su regla, precio e IVA. Las ventas, órdenes y el envío desde la tablet **no cambian**.
- Si un componente es a medida, pide las medidas una sola vez y las aplica a todos los componentes que las usan.
- Requiere agregar el tipo nuevo a la tabla de productos con una migración nueva.

## Decisiones (tomadas por Juanito el 27 nov) [ADR-0048]

| # | Decisión | Propuesta |
|---|---|---|
| D1 | **Precio abierto (CE-01):** ¿quién puede fijar el precio? | **Cualquiera.** Si queda **debajo** de la referencia es un descuento y pide el PIN de un administrador, como hoy (PR-20). Todo queda en la bitácora |
| D2 | **Decimales (CE-03):** ¿cuántos decimales? | **3 decimales** (gramos, milímetros, minutos). El redondeo del importe **ya está decidido** en [ADR-0011]: precio × medidas × cantidad, redondeado una sola vez al centavo, la mitad hacia arriba. Con decimales se aplica igual |
| D3 | **Aumento por porcentaje (CE-06):** ¿el precio nuevo se redondea? | **Sí, al peso.** Por omisión, hacia arriba; quien hace el cambio puede elegir otro redondeo en la vista previa |
| D4 | **Cuándo y qué orden** | Ver la sección siguiente |

## Cuándo

- **La entrega es el 28 al 30 de noviembre.** Construir 82 horas con la compuerta completa antes del sábado no es posible sin bajar la calidad [CLAUDE.md regla 11].
- **Propuesta:** empezar el **martes 1 de diciembre**, como mejora posterior a la entrega, en este orden:
  - **Semana 1:** CE-01, CE-07, CE-04, CE-05, CE-02 y CE-08, que son de valor alto y riesgo bajo o medio.
  - **Semana 2:** CE-06, CE-09 y, al final, CE-03, la de mayor riesgo.
- **Mientras tanto, para la entrega**, sin cambiar código:
  - **"Depende del trabajo":** se cobra por unidad (por m², por ventana o por visita), con un precio de referencia razonable, y si hace falta se ajusta hacia abajo con el PIN de un administrador.
  - **Kilo o rollo:** el producto se vende por pieza con la presentación en el nombre, por ejemplo "Vinil cuña, bolsa de 1 kg".
  - **Variantes:** un producto por combinación, con el espesor y el tono en el nombre.
- Si Juanito prefiere adelantar **solo CE-01** (precio abierto) antes de la capacitación, es la única que se podría intentar. Es de unas 10 horas y necesita su PR con la compuerta completa y la migración desplegada. **Recomendación:** no adelantarla; usar la solución de arriba durante la entrega.

## Entregables

- 9 PR, uno por historia, cada uno con su prueba de aceptación a mano en la tablet.
- Requerimientos nuevos en `REQUERIMIENTOS.md` (RF-M1-10 a RF-M1-18) y un ADR con las decisiones D1 a D3, **antes** del código.
- Las propuestas de `PENDIENTES.md` se cierran o se crean según lo que se apruebe: PP-04 (descripción) y PP-38 a PP-45, una por historia.
- `MANUAL_DE_USUARIO.md` (sección Catálogo) y la guía rápida del administrador actualizadas, con capturas nuevas.

## Pruebas obligatorias (resumen)

- **Dominio:** cada regla y cada campo nuevo, más los 15 casos de la prueba "100 % escalable", como pruebas automáticas.
- **Mutación:** el umbral crítico (90 %) incluye lo que toque dinero (CE-01, CE-03 y CE-06).
- **Base de datos (pgTAP):** columnas nuevas, restricciones y que la prueba 22 siga en verde.
- **Integración:** operaciones de una tablet con la versión vieja **y** con la nueva, mezcladas, sin rechazos ni duplicados.
- **Extremo a extremo:** dar de alta un producto con cada novedad y cotizarlo, venderlo e imprimirlo.

## Compuerta de salida

- Los 15 casos de la tabla pasan desde la pantalla y desde la importación, sin tocar código.
- CI en verde en cada PR; mutación ≥ 90 % en lo crítico.
- Una tablet con la versión anterior sigue enviando sin errores mientras se actualiza.
- Manual y guía rápida al día.

## Riesgos

| Riesgo | Cómo se cubre |
|---|---|
| **CE-03 toca el dinero, la base y el envío** | Va al final, en milésimas enteras, con casos de oro y mutación. Si algo se complica, se queda fuera sin afectar lo demás |
| **Tablets con la versión vieja** mientras se actualizan | Todo campo nuevo es opcional en el envío, y el servidor acepta las dos formas |
| **El nombre del producto deja de alcanzar** con cientos de combinaciones | CE-07 y CE-04 lo alivian. Atributos estructurados (espesor, tono y acabado como campos) quedan como mejora futura, si el catálogo pasa de unos 300 productos |
| **Esta fase se cruza con la entrega** | No se empieza antes del 1 de diciembre salvo decisión de Juanito |
