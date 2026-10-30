# La demo como referencia

> Descripción de la demo (`HummingX-BI/formularios`) **[Juanito, 2026-10-27]**, contada de viva voz, para revisar paso a paso que el sistema real cumpla con lo que ya se mostró al cliente.
> La demo es **solo referencia de lo que se vio**; no se reutiliza su código [ADR-0002]. Es una demo: hay datos de relleno y cosas sin resolver, que aquí se marcan.
> Lo que no esté en `REQUERIMIENTOS.md` **no se construye** hasta que Juanito lo apruebe: va a la tabla de propuestas de `PENDIENTES.md` [CLAUDE.md regla 2].
> **Estado:** completa (6 de 6 secciones). La retroalimentación sobre el negocio y las reglas propuestas están en [`docs/producto/REVISION_DE_NEGOCIO.md`](REVISION_DE_NEGOCIO.md).
> Por privacidad [ADR-0010] no se anotan nombres de empleados ni cifras reales de la demo.

## 1. Navegación de la demo

Barra con seis secciones: **Dashboard, Catálogo, Cotizador, Órdenes de trabajo, Mostrador, Reportes.**

| Observación | Relación con el sistema real |
|---|---|
| Clientes, cuentas por cobrar, usuarios y legal no aparecen como secciones propias de la barra (según lo contado) | Existen como módulos M5, M6, M8 y M9. Falta decidir dónde viven en la navegación (Fase 3) |
| El "Dashboard" de la demo es la pantalla de inicio | En el sistema real se llama **Panel de inicio** [GLOSARIO] y se accede desde el logo [RF-UX-01]; su contenido por rol es PD-31. Ver sección 3 |

## 2. Primeros pasos (onboarding)

La demo ofrece un recorrido guiado, "Ver primeros pasos", con el texto "para sacar el máximo provecho a la plataforma, te sugerimos seguir este camino":

1. Organiza tu catálogo.
2. Haz tu primera cotización.
3. Da seguimiento a un trabajo.
4. Registra una venta de mostrador.
5. Revisa cómo va tu negocio.

| Observación | Relación con el sistema real |
|---|---|
| El recorrido sigue el orden M1 → M2 → M3 → M4 → M7 | **Ya es requerimiento:** RF-UX-02 (pantalla de Primeros pasos con cinco tarjetas), RF-UX-03 a RF-UX-05. PP-01 queda incorporada |

## 3. Dashboard

| Elemento en la demo | Requerimiento relacionado | Observaciones |
|---|---|---|
| Ventas del día y medios de pago: total, cuánto en efectivo y cuánto en transferencia | RF-M7-01 (ventas del día contra el periodo anterior), RF-M7-06 (cobros por método) | La base de "ventas" es [RN-20] (efectivo recibido), pendiente PD-08 |
| Cuentas por cobrar: clientes con saldo pendiente | RF-M6-01, RF-M7-04 | En la demo los datos eran capturados a mano. En el sistema real **no se capturan**: son las órdenes con saldo mayor a cero (anticipos y saldos son pagos de la orden: RF-M3-03, RF-M6-02, RN-09) |
| Tendencia de ingresos de los últimos 10 días | RF-M7-01 compara día, semana y mes; **no define una gráfica de tendencia** | **Juanito prefiere el último mes (~31 días)** en lugar de 10. Hay que definir si es una gráfica nueva, el periodo exacto (¿30 días corridos o mes calendario?) y la base de cálculo. Propuesta PP-02 |
| Pipeline de producción: órdenes en espera, en proceso, etc. | RF-M3-07, RF-M7-03 (trabajos pendientes por estatus, con conteo y valor) | La pregunta de la demo ("¿cuándo avanza Luis el estado?") la contesta RF-M3-02: botón "Avanzar" en la orden, que guarda usuario y hora |

El panel de inicio existe como requerimiento (RF-UX-01), pero su **contenido por rol** está por definir en PD-31. Los datos de estos cuatro bloques sí están cubiertos por M6 y M7. La preferencia de Juanito de una tendencia de ~31 días (PP-02) y los cuatro bloques (PP-03) se incorporaron a PD-31.

## 4. Catálogo

| Elemento en la demo | Requerimiento relacionado | Observaciones |
|---|---|---|
| Catálogo centralizado, botón "Agregar producto" | RF-M1-04 | Solo administradores |
| Campos del alta: nombre, **descripción**, SKU, tipo de venta (a medida, pieza estándar o servicio), unidad de medida, precio base de lista, botón Guardar | RF-M1-01 | RF-M1-01 **no incluye "descripción"**. Propuesta PP-04 |
| **SKU capturado por Luis a mano** | RF-M1-01: código "opcional, autogenerable" | **Juanito duda que sea lo adecuado** y propone que el sistema lo genere: iniciales del nombre más un número consecutivo. Regla por definir (colisiones, edición del nombre después, ¿editable?). Propuesta PP-05 |
| Gráfica de pastel "Distribución de catálogo" (17 productos por categoría) | No existe | Categorías vistas: aluminio y cancelería (7), servicios (2), vidrio claro y flotado, vidrio templado, espejos y cristal doble (RF-M1-02). Propuesta PP-06 |
| Alerta de inventario: "2 productos estándar con stock menor a 5 unidades, considera reabastecer" | RF-M1-07, solo si **P2** está activo | Debe quedar apagada por defecto (PD-14). El texto "reabastecer" implica compras, que están fuera del alcance: revisar la redacción |
| Tabla de productos: código, descripción, tipo, cómo se vende, unidad y precio | RF-M1-03 (búsqueda y filtros) | La demo mostraba el precio "como está guardado". En el real el precio incluye IVA [RN-06] y se muestra así |

## 5. Cotizador

| Elemento en la demo | Requerimiento relacionado | Observaciones |
|---|---|---|
| Concepto a cotizar: búsqueda del producto en el catálogo | RF-M2-02 | |
| Nombre del prospecto o cliente y teléfono/WhatsApp, capturados en campos | RF-M2-01 (nombre y WhatsApp como mínimo) | |
| Vista previa en vivo en tamaño carta (A4) | RF-M2-04, RF-M2-05 | |
| Plantilla: nombre de ZAMMIR, folio, fecha, cliente, celular, concepto, detalle, importe, "total neto", condiciones generales, firma de autorización o anticipo, mensaje de agradecimiento | RF-M2-05 | La plantilla es provisional. El real agrega vigencia, medidas y aviso de privacidad. **"Total neto"**: con precios con IVA incluido [RN-06] el nombre es ambiguo; queda por decidir la etiqueta (revisar con el glosario) |
| Compartir por WhatsApp o exportar PDF | RF-M2-05, RF-M2-06 | El PDF se genera en el dispositivo; no se imprime en carta [ADR-0005] |

## 6. Órdenes de trabajo

| Elemento en la demo | Requerimiento relacionado | Observaciones |
|---|---|---|
| "Pipeline analítico": valor en producción, cuánto hay por cobrar y cuánto está listo | RF-M3-07 (resumen con valor en producción y saldo por cobrar de lo ya listo) | Cubierto. "Analítico" es un adjetivo de la demo; ver glosario |
| Volumen por etapa: en espera, en proceso, listo para entrega, entregadas (conteos) | RF-M3-02, RF-M3-07 | "Entregadas" crece sin fin si no tiene periodo (¿últimos 30 días?). Propuesta de reglas en la revisión de negocio |
| Tabla de gestión: folio, fecha, descripción, estatus, saldo pendiente, acción | RF-M3-07 | |
| Acciones por fila: **generar comprobante** y **avanzar estatus** | RF-M3-06, RF-M3-02 | Juanito pide **definir bien los estatus**: significado de cada uno y qué se exige para pasar al siguiente |

## 7. Mostrador

| Elemento en la demo | Requerimiento relacionado | Observaciones |
|---|---|---|
| "Cajero actual": se elige entre los usuarios sin autenticarse | RF-M4-08, RF-M8-01, [ADR-0013] | Juanito quiere un acceso por usuario ("login") para que cada cajero tenga su sesión. **Ya está previsto**: nombre + PIN sobre la tablet registrada. Los cajeros **no se registran solos**: los da de alta un administrador |
| Venta de mostrador con "catálogo rápido" (lo que se vende al momento, por ejemplo una puerta corrediza de aluminio natural); un clic agrega al ticket actual | RF-M4-01 | RF-M4-01 no define el "catálogo rápido": hace falta decidir cómo se arma. Propuesta PP-08 |
| Forma de pago: efectivo o transferencia | RF-M4-02, RN-10 | Falta el pago mixto y el cambio, que sí están en los requerimientos |
| Botones "Cobrar" e "Imprimir ticket"; la impresión sale por la impresora térmica | RF-M4-04, [ADR-0008] | Modelo pendiente (PD-15) |
| Corte de turno: efectivo en caja, transferencias reportadas, tickets cobrados | RF-M4-06 nivel 1 | Falta fondo inicial, efectivo contado y diferencia. Preguntas sobre la caja compartida en la revisión de negocio |
| Corte consolidado del día: total de efectivo, total de transferencias y trabajos listos o entregados | RF-M4-06 nivel 2 | Los "trabajos listos o entregados" son información de producción, no de dinero: conviene separarlos del corte |
| Los cortes se manejan por sesiones | RF-M4-06, RF-M4-08 | |

## 8. Reportes

| Elemento en la demo | Requerimiento relacionado | Observaciones |
|---|---|---|
| "Panel de inteligencia": análisis automatizado que detecta cuellos de botella y tendencias | ALCANCE excluye inteligencia de negocio predictiva; el glosario prohíbe "inteligencia de negocio" en la interfaz | La sección se llama **Reportes** [RF-M7]. La detección de cuellos de botella se resuelve con reglas simples y umbrales, sin predicciones: propuesta PP-07 |
| Resumen financiero: ventas de hoy, de la semana y del mes, con aumento o disminución contra ayer, la semana pasada y el mes pasado | RF-M7-01 | Comparar un periodo en curso contra uno completo engaña. Propuesta PP-13 |
| Gráfica de cobros por cajero. Juanito sugiere ver el mes | RF-M7-05 (hoy, semana y mes) | Ya cubierto |
| Productos más vendidos con "unidades que quedan" | RF-M7-02 (por importe y cantidad) | "Unidades que quedan" es **existencia**: solo aplica a piezas estándar con P2 activo (RF-M1-07). El vidrio a medida no tiene existencia en el alcance [ALCANCE §4] |
| Estado de producción: órdenes activas | RF-M7-03 | |
| "Riesgo de cobranza": cliente u orden, fecha del contrato, días transcurridos y saldo | RF-M6-01, RF-M7-04 | No hay crédito [RN-09]: la lista se llama **Cuentas por cobrar** y la fecha es la de la orden. Antigüedad por tramos configurables |

## 9. Propuestas y preguntas que salen de esta revisión

Primera parte: PP-01 a PP-06 (PP-01 a PP-03 incorporadas en RF-UX y PD-31). Segunda parte y revisión de negocio: PP-07 a PP-19 y PD-36 a PD-47. Todas están en `PENDIENTES.md`; ninguna se construye hasta que Juanito las apruebe y, en el caso de las preguntas, Luis las responda.
