# Plan de UI y UX

> **Estado:** **aprobado por Juanito el 2026-11-03** (decisiones D1 a D7 de la sección 9, con la recomendación del desarrollador en cada una). Se construye en las historias U0 a U9.
> **Origen:** Juanito pidió que la interfaz se parezca más a la demo (`HummingX-BI/formularios`, carpeta `demos/zammir-demo`), cuya UI y UX le gustan más que las del sistema actual.
> **Complementa** a [`DEMO_REFERENCIA.md`](DEMO_REFERENCIA.md), que cubre *qué funciones* mostró la demo; este documento cubre *cómo se ve y se siente*.
> **Reglas que se respetan:** [ADR-0002] (la demo es referencia, **no se copia código**; la identidad visual sí se puede adoptar redefiniéndola dentro del sistema de diseño propio), [RNF-28] (táctil de 44 px, texto de 16 px, buen contraste), [RF-UX-01 a RF-UX-10], [RN-23] (sin datos de relleno) y el modo sin internet.

## 1. Qué se revisó y con qué límite

Se leyó el código de la demo (~7,400 líneas): `index.css` y `tokens/design.js`, el marco (`Dueno.jsx` y `dueno.css`), `Dashboard`, `Cotizador`, `POS` (Mostrador), `Ordenes`, `Reportes`, `Catalogo`, `PrimerosPasos`, `TourOverlay`, `ContextBanner`, el portal de factura y las hojas de estilo de cada pantalla.

**Límite:** la revisión es del código, **no se ejecutó la demo**; lo visual se infiere de los estilos. Antes de cerrar la identidad conviene verla juntos en pantalla (sección 9, decisión D1).

## 2. Lo que hace bien la demo (y por qué le gusta)

1. **Sensación de papel y oficio.** Fondo crema, tinta casi negra, tarjetas blancas con borde finísimo y sombra suave; títulos en serifa (Fraunces), texto en serifa de lectura (Source Serif 4) y rótulos en monoespaciada (IBM Plex Mono). Se siente a taller y a documento, no a "panel genérico".
2. **Jerarquía muy clara en cada tarjeta:** rótulo pequeño en mayúsculas y monoespaciada, cifra grande en la serifa de títulos, y detalle abajo separado por una línea.
3. **Barra lateral con íconos de línea fina** y la sección activa teñida de acento; los títulos de sección dicen "Flujo de trabajo", como el oficio.
4. **Cotizador de dos paneles:** el formulario a la izquierda y **el documento a la derecha formándose en vivo**; el cliente ve cómo se arma el precio. Es lo más fuerte de la demo.
5. **Mostrador con mosaicos grandes** de producto, ticket a la derecha, botones de método de pago, total enorme y un solo botón "Cobrar". Corte del turno y consolidado como dos tarjetas.
6. **Estatus con punto de color + texto** (no solo color) y **flechas de comparación** (↑ 12 % vs ayer).
7. **Guía para quien empieza:** "Primeros pasos" con cinco tarjetas numeradas que se marcan al avanzar, botón fijo "¿Por dónde empiezo?", avisos cerrables ("revisa primero tu catálogo") y ayudas "?" en cada tarjeta.
8. **Movimiento sobrio:** entradas de 0.25–0.4 s que suben ligeramente.

## 3. Lo que la demo hace mal y no se toma

| Problema | Por qué no | Qué se hace |
|---|---|---|
| Texto de **10–13 px** en rótulos, botones pequeños y `0.65rem` por todos lados | Rompe [RNF-28] (texto de 16 px, táctil de 44 px); en una tablet en el taller no se lee | Escala tipográfica propia (sección 5) |
| Color de texto "apagado" `#8C8880` sobre el papel: **contraste 3.1:1** | No pasa AA (4.5:1) | Texto secundario con `#57534A` (6.8:1); el apagado solo para decoración |
| Ayudas "?" que aparecen **solo al pasar el cursor** | La tablet no tiene cursor | Ayuda que se abre al tocar y con teclado |
| Verde `#27AE60` y advertencia `#B07D2A` como texto | Contrastes de 2.9:1 y 3.3:1 | Verdes y ámbares más oscuros para texto |
| **Tres azules distintos** (`#0F4C81`, `#1B365D`, `#1a365d`) y un "latón" que en el CSS real es azul; `tokens/design.js` (latón dorado) no se usa | La identidad no está definida; ver D1 | Se define una sola paleta |
| GSAP, Lenis (scroll suave), Framer Motion, Recharts, jsPDF | Peso y fluidez en una tablet de gama media; el scroll suave estorba al tocar; ya tenemos PDF propio | Solo CSS para movimiento; gráficas SVG propias y livianas |
| Fuentes cargadas desde Google Fonts | **No funcionan sin internet** | Fuentes empaquetadas con la aplicación |
| Animación de "ticket saliendo con borde dentado", frase motivacional, tour con máscara | Adorno; el recorrido guiado quedó fuera de la entrega [ADR-0019] | No se toma |
| Estilos escritos en línea en cada componente y datos de muestra | No se pueden probar ni mantener | Componentes con clases y tokens |
| Sin `prefers-reduced-motion` | [RF-UX-09] lo exige | Se respeta |
| Colores como único indicador (rojo de "vencida") | Excluye a quien no distingue colores | Siempre color **más** texto o ícono |

## 4. Dónde está hoy el sistema

La base ya tiene los ingredientes (fondo crema `#f6f1e9`, tarjetas blancas, acento azul marino `#1f3a5f`, títulos en Georgia y rótulos en monoespaciada), pero se declaró **provisional** [PD-35]:

- Marco de **barra superior** con enlaces numerados; en pantalla ancha desperdicia el costado y en teléfono se desborda.
- Pantallas como **formularios y tablas planas**: sin tarjetas con jerarquía, sin cifras grandes, sin mosaicos en el Mostrador, sin vista previa en vivo en el Cotizador.
- Sin íconos, sin etiquetas de estatus con forma, sin estados vacíos ilustrados, sin panel de inicio con contenido, sin "Primeros pasos" ni botón "¿Por dónde empiezo?" [RF-UX-02, 03].
- Fuentes del sistema (sin identidad tipográfica).
- Lo que sí está bien y se conserva: objetivos de 44 px, texto de 16 px, contraste, foco visible, textos humanos y "qué hacer" en cada error.

## 5. Sistema de diseño propuesto (v1)

Se **redefine** dentro del sistema propio; no se copia código [ADR-0002]. Los valores salen de la demo, ajustados para cumplir [RNF-28].

### 5.1 Color

| Rol | Valor | Nota |
|---|---|---|
| Papel (fondo) | `#F4F1EC` | de la demo |
| Panel | `#ECE8E0` / `#E0DBD1` | tarjetas secundarias y separadores |
| Superficie | `#FFFFFF` | tarjetas |
| Tinta | `#26241F` | 13.8:1 sobre papel |
| Tinta suave | `#57534A` | 6.8:1; texto secundario |
| Tinta apagada | `#8C8880` | **solo decoración** (3.1:1) |
| **Acento principal** | **`#0F4C81`** (azul de la demo) | 7.9:1 sobre papel; blanco sobre acento 8.9:1. **D1** |
| Acento secundario | latón oscuro `#7A5F2D` | 5.3:1; filetes, íconos, énfasis. El latón claro `#9C7A3C` solo decorativo |
| Vidrio / aluminio / oliva | `#B9C6CC` / `#7C8592` / `#5C6B4F` | tintes, separadores, estatus "en proceso" |
| Éxito / peligro / aviso / info | `#2E6B45` · `#8B3A3A` · `#8A5A12` · `#2F5F82` (más oscuros que los de la demo para pasar 4.5:1) | con fondos suaves `#EBF4EE`, `#F9EBEB`, `#FDF4E3`, `#EBF2F9` |

Estatus de órdenes (siempre **punto + texto**): En espera (latón oscuro), En proceso (azul), Listo (verde), Entregado (gris), Cancelado (rojo).

### 5.2 Tipografía

- **Fraunces** (títulos y cifras grandes), **Source Serif 4** (lectura) e **IBM Plex Mono** (rótulos, folios, importes en tablas).
- **Empaquetadas con la aplicación** (formato `woff2`, solo caracteres latinos, 400 y 700), con `font-display: swap` y guardadas en el caché sin internet. Presupuesto: **≤ 250 KB** en total. Las tres son de licencia libre (OFL).
- Escala: texto base **16 px**; títulos de página 28–32 px; cifras de tarjeta 32–40 px; rótulos de tarjeta en mayúsculas y monoespaciada **14 px como mínimo** (ver D2). Nada de texto de 10–13 px.

### 5.3 Forma y movimiento

- Radios 8 / 12 / 16 px; sombras suaves de 3 niveles; separadores de 1 px.
- Transiciones de 150–250 ms con `transform` y `opacity` solamente; **sin librerías de animación**; todo se apaga con `prefers-reduced-motion`.
- Íconos de línea de 1.5 px, un solo juego propio en SVG (catálogo, cotizador, órdenes, mostrador, reportes, cobrar, imprimir…).

### 5.4 Componentes base (a construir una sola vez y reutilizar)

Tarjeta · Indicador (rótulo + cifra + detalle) · Etiqueta de estatus · Pestañas · Ventana modal accesible · Ayuda táctil ("?") · Aviso cerrable · Estado vacío que enseña qué hacer · Tabla que se apila en el celular · Flecha de comparación (▲ ▼ con texto) · Barras y línea en SVG con tabla equivalente para lectores de pantalla · Encabezado de página (fecha en monoespaciada + título + acciones) · Barra lateral.

## 6. Qué se toma de la demo, y cómo se reinterpreta

| De la demo | En el sistema | Historia |
|---|---|---|
| Barra lateral con íconos y "Flujo de trabajo" | Barra lateral fija en tablet horizontal y escritorio; barra superior desplazable en teléfono y tablet vertical. Conserva numeración y marca de visitadas [RF-UX-01] y el estado de conexión y pendientes [RF-UX-06] | U1 |
| Encabezado con fecha y "Hola, …" | Fecha en monoespaciada + saludo con el nombre de **quien entró con su PIN**. Sin frase motivacional | U1 |
| Tarjetas con rótulo, cifra grande y detalle | Componente Tarjeta/Indicador en todas las pantallas | U2 |
| Cotizador de dos paneles con documento en vivo | Formulario + vista previa del mismo modelo del PDF (`buildQuoteDocument`), así pantalla y PDF dicen lo mismo al centavo. En tablet vertical, la vista previa pasa a una pestaña | U4 |
| Mostrador con mosaicos y ticket a la derecha | Mosaicos **solo si Luis aprueba la lista de venta rápida (PP-08)**; mientras tanto, búsqueda grande + ticket a la derecha, método de pago en botones grandes, total enorme y un solo botón "Cobrar". Turno y corte como tarjetas | U3 |
| Tabla de órdenes con estatus y botón de avanzar | Tarjetas de indicadores + volumen por etapa (barras SVG) + tabla con etiqueta de estatus y botón "Avanzar" | U5 |
| Cuentas por cobrar en rojo | Lista con franja y texto "Atrasada"; ya está la lógica | U6 |
| Reportes en tarjetas con flechas | Las cifras ya existen; se presentan con Indicador y flechas con texto; barras SVG | U6 |
| Catálogo por categorías con resumen y modal de alta | Grupos con conteo, resumen y ventana modal | U7 |
| Panel de inicio (ventas del día y medios de pago, por cobrar, tendencia, producción) | Mismo contenido, con datos reales y estado vacío que enseña qué hacer. **Contenido por rol: D5** | U8 |
| "Primeros pasos" (5 tarjetas), botón fijo "¿Por dónde empiezo?", avisos cerrables, ayudas "?" | [RF-UX-02, 03, 05]; ayudas al tocar. El recorrido con máscara (RF-UX-04) sigue **fuera** [ADR-0019] | U8 |
| Portal de factura formal (azul, encabezado fijo, insignia de seguridad) | Pantalla pública sobria [RF-UX-10], hecha junto con la facturación | U9 |
| Estilos de impresión del comprobante | Ya existe el PDF propio; solo se unifica el aspecto | — |

## 7. Plan de implementación

Estimaciones en horas de Juanito con apoyo del asistente; cada historia termina con pruebas, compuerta en verde y revisión en el navegador.

### Fase UX-A · Base (antes de seguir con facturación y legal)

**U0 · Identidad y tokens (6 h).** Aprobar D1 y D2; definir los tokens (color, tipografía, radios, sombras, movimiento) en un solo archivo; empaquetar las tres fuentes; precargarlas y guardarlas en el caché sin internet.
- Dado el sistema sin internet, cuando se abre por primera vez la aplicación ya instalada, entonces las fuentes se ven (no caen a la del sistema).
- Dado un texto o control cualquiera, cuando se mide el contraste, entonces es de al menos 4.5:1 (3:1 en texto grande).
- Dada la lista de fuentes, entonces pesan menos de 250 KB.

**U1 · Marco y navegación (8 h).** Barra lateral responsive, encabezado de página, indicador de conexión y pendientes, saludo con el nombre de quien entró.
- Dada una tablet horizontal o una computadora, entonces hay barra lateral fija; en teléfono, barra superior desplazable; **sin desplazamiento horizontal de la página**.
- Dada la numeración y marca de visitadas [RF-UX-01], entonces se conservan y se leen por lector de pantalla.

**U2 · Componentes base (14 h).** Los de la sección 5.4, con pruebas de componentes y de accesibilidad.
- Dado cada componente, entonces cumple 44 px táctil, foco visible, teclado y `prefers-reduced-motion`.
- Dada una gráfica, entonces trae una tabla equivalente para lectores de pantalla.

### Fase UX-B · Pantallas (en este orden: lo que más se usa primero)

| Historia | Horas | Notas |
|---|---|---|
| **U3** Mostrador (turno, venta, corte) | 10 | La pantalla más usada en el día |
| **U4** Cotizador con vista previa en vivo | 12 | Lo más valioso de la demo |
| **U5** Órdenes (indicadores, volumen, tabla, detalle) | 8 | |
| **U6** Cuentas por cobrar y Reportes | 8 | La lógica ya existe |
| **U7** Catálogo y Clientes | 6 | |
| **U8** Panel de inicio, Primeros pasos, "¿Por dónde empiezo?", avisos | 12 | Depende de D5 (PD-31) |
| **U9** Pantalla pública de autofactura | 8 | Junto con la facturación del Sprint 4 |

Criterio común de cada pantalla: mismos datos y mismas reglas que hoy (no cambia ninguna regla de negocio), estados vacíos que enseñan qué hacer [RF-UX-07], confirmación en lo destructivo [RF-UX-08], recorridos de aceptación E1 a E10 siguen en verde.

### Fase UX-C · Calidad (transversal, 10 h)

- **Pruebas visuales** con capturas de Playwright en tres tamaños (tablet 1024×768 y 1280×800, teléfono 375×812) para detectar cambios no deseados.
- **Accesibilidad automática** (axe) sin violaciones graves en cada pantalla.
- **Rendimiento:** presupuesto de peso de la aplicación y carga inicial < 3 s en 4G [RNF-23]; reportes con 12 meses < 3 s [RNF-27].
- **Sin internet:** todas las pantallas nuevas funcionan con la tablet desconectada.
- **Revisión con la tablet real** al final del proyecto (junto con la impresora).

**Total estimado: ≈ 102 h** (14–16 días de trabajo).

## 8. Orden recomendado frente al resto del Sprint 4

1. **Ahora: U0 + U1 + U2 (≈ 28 h, 3–4 días).** Así legal y facturación (y sus pantallas públicas) nacen con los componentes nuevos y no hay que rehacerlas.
2. Facturación y legal del Sprint 4, ya con el nuevo marco; U9 junto con ellas.
3. U3 a U8 entre sprint y sprint, **en el orden de la tabla**, de modo que cada semana quede algo visible y probado.
4. U-C en cada pantalla (no al final), más la revisión con la tablet.

Si el calendario aprieta, se recorta en este orden: U8 (guía de inicio), U7 (catálogo/clientes), mosaicos del Mostrador. **No se recorta** accesibilidad ni funcionamiento sin internet.

## 9. Decisiones que necesito de Juanito

| # | Decisión | Mi recomendación |
|---|---|---|
| **D1** | **Color de acento.** La paleta "oficial" (ADR-0002) habla de latón, pero en el CSS real de la demo el acento es **azul `#0F4C81`** (y es lo que Luis vio). | Azul `#0F4C81` como principal; latón oscuro `#7A5F2D` como secundario decorativo. Verlo juntos en pantalla antes de cerrar |
| **D2** | **Tamaño del texto.** [RNF-28] pide 16 px; la demo usa rótulos de 10–13 px. | 16 px para todo lo que se lee o se toca; rótulos de tarjeta en mayúsculas a **14 px** como única excepción (requiere ajustar [RNF-28] por escrito) |
| **D3** | **Navegación.** Barra lateral (como la demo) vs. barra superior (hoy). | Barra lateral en tablet horizontal/escritorio; superior en teléfono |
| **D4** | **Gráficas.** Librería (Recharts) vs. SVG propio. | SVG propio: menos peso, accesible y sin animaciones pesadas |
| **D5** | **Contenido del panel de inicio por rol** [PD-31]. | Administrador: ventas del día y medios de pago, por cobrar, tendencia (Juanito prefiere ~31 días y no 10, PP-02) y producción. Cajero: su turno, sus cobros y sus pendientes de enviar |
| **D6** | **Venta rápida con mosaicos** [PP-08, pregunta 37 a Luis]. | Dejarla fuera hasta que Luis la apruebe; mientras tanto, búsqueda grande |
| **D7** | **Aprobar [ADR-0028]** (identidad visual v1 tomada de la demo, sin copiar código) y el orden de la sección 8. | Aprobar |

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| **El repositorio de la demo es público y tiene datos del cliente [PD-19].** | Sigue **urgente** pasarlo a privado. No se copia ningún dato de ahí; la copia de lectura que se usó para este análisis es temporal y no entra al proyecto |
| Rehacer pantallas rompe lo que ya funciona | Cambian solo la vista y las clases; la lógica, las pruebas y los recorridos E1 a E10 no se tocan |
| Las fuentes pesan y retrasan la carga | Presupuesto de 250 KB, solo latín, `swap`, precarga y caché |
| "Se ve bonito" pero no se lee en el taller | Contraste y tamaños de [RNF-28]; revisión con la tablet real |
| Dos identidades a la vez durante la transición | Los tokens nuevos reemplazan a los provisionales en U0, así todo cambia de golpe y las pantallas heredan |

## 11. Cómo se cita

`[PLAN-UX §n]` para este documento; las historias son `U0` a `U9`.

## 12. Estado de las historias

| Historia | Estado | Notas |
|---|---|---|
| U0 Identidad y tokens | **hecha** | Tokens en `tokens.css`; Fraunces, Source Serif 4 e IBM Plex Mono empaquetadas (≈107 KB, latín) y guardadas para uso sin internet; sin llamadas a Google Fonts (comprobado en navegador real) |
| U1 Marco y navegación | **hecha** | Barra lateral en tablet horizontal y computadora; barra superior desplazable en tablet vertical y teléfono; encabezado con fecha de México y saludo por nombre; sin desplazamiento horizontal (comprobado a 375, 800 y 1280 px) |
| U2 Componentes base | **hecha** | Tarjeta, Indicador, Etiqueta de estado, Pestañas, Ventana, Ayuda táctil, Aviso cerrable, Estado vacío, Tabla apilada, Flecha de comparación, Barras, Línea, Encabezado de página e Íconos, con 66 pruebas, axe estructural en jsdom y axe con contraste en navegador real |
| U3 Mostrador | **hecha** | Turno con indicadores, ventas con mosaicos de producto, ticket fijo a la derecha con total grande, cobro y autorización en ventana modal, ventas de hoy con etiquetas de estado, estado de la impresora; `/muestras` (solo en desarrollo) arma la pantalla con datos de ejemplo para verla sin registrar una tablet. Corrige un error: la lista de turnos mostraba el día en UTC y no el de México |
| U4 Cotizador | **hecha** | Lista con borradores y tabla de cotizaciones con etiquetas de estado; editor con tarjetas, mosaicos de producto, líneas estilo ticket y total grande; hoja de documento junto a los datos (fija al desplazarse), que se apila por contenedor cuando queda angosta; pestañas accesibles en tablet vertical y teléfono; `/muestras/cotizador` (solo desarrollo). Corrige la fecha del historial, que se mostraba en UTC y no en México |
| U5 Órdenes | **hecha** | Indicadores de valor en producción y por cobrar (administrador), cotizaciones por convertir en filas, filtros por estatus como pastillas con conteo, tabla con etiquetas de estado; detalle con conceptos, pagos, datos y fotos a la izquierda y tarjeta de cobro y saldo (total y saldo grandes, acciones a todo lo ancho) a la derecha, que en pantalla angosta sube al principio; `/muestras/ordenes` (solo desarrollo) |
| U6 Cuentas y Reportes | **hecha** | Cuentas por cobrar con tres indicadores, tabla con fila resaltada y etiqueta "Atrasada" en texto, acciones con ícono; Reportes con tres tarjetas de ventas (cifra, periodo anterior y flecha con porcentaje o el texto de "sin periodo anterior"), lo más vendido en barras con pestañas de periodo, trabajos por estatus con etiquetas, antigüedad de cuentas en barras (rojo desde el umbral), cobros por persona y por método; `/muestras/reportes` y `/muestras/cuentas` (solo desarrollo) |
| U7 Catálogo y Clientes | **hecha** | El Catálogo no existía como lista: se construyó (productos agrupados por categoría con resumen de activos, inactivos y categorías, búsqueda y filtros, alta y edición en ventana con historial de precios, activar y desactivar sin borrar, importación en ventana); Clientes con tarjetas, tabla con el nombre como encabezado de fila, estado vacío y datos fiscales plegables; ficha del cliente con indicadores y etiquetas; `/muestras/catalogo` (solo desarrollo) |
| U8 y U9 | pendientes | Siguen el orden de la sección 7 |

Ajuste respecto al plan: las barras se dibujan con la lista misma (texto + barra de CSS), no con SVG, porque así el valor siempre está en texto; la línea sí es SVG, con su tabla equivalente.
