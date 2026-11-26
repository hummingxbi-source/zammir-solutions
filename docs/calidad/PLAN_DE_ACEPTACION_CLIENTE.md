# Plan de pruebas de aceptación con el cliente

> Historia S4-30. Es el guion que **Luis** (o quien él designe) ejecuta con la tablet de ZAMMIR y firma. Parte de los recorridos E1 a E10 de [`PRUEBAS_DE_ACEPTACION.md`](PRUEBAS_DE_ACEPTACION.md), pero escrito con las palabras del oficio: cada escenario es un día normal en el negocio, no una prueba técnica.
>
> **Fechas acordadas con Luis (8 nov 2026):** sábado 28, domingo 29 y lunes 30 de noviembre, con la tablet en el local; falta la hora de cada sesión. Este guion se ejecuta el **sábado 28**, antes de cargar los datos reales.
> Su hoja de resultados firmada es el anexo A del acta de entrega ([`ACTA_DE_ENTREGA.md`](../entrega/ACTA_DE_ENTREGA.md)). La aceptación firmada es la historia S5-10.

## Antes de empezar

| Qué | Detalle |
|---|---|
| Dónde se prueba | En `https://sistema.zammir-solutions.com`, **antes** de recrear el proyecto vacío para los datos reales [ADR-0043]. |
| Con qué datos | **Inventados** (clientes, productos, precios y folios de prueba). Ninguna prueba usa datos reales de clientes [ADR-0010]. |
| Con qué equipo | Las dos tablets y la impresora que ZAMMIR usará. Los escenarios marcados con 🖨️ necesitan la impresora; los marcados con 📵 se hacen **sin internet** (modo avión). |
| Quién acompaña | HummingX BI toma nota de lo que no salga bien; no hace los pasos por Luis. |
| Personas de prueba | Un **administrador** y dos **cajeros / vendedores**, cada uno con su PIN. Los da de alta HummingX antes de empezar. |
| Facturación | **En pausa** [ADR-0039]: no se prueba. Los escenarios 7 a 10 quedan para cuando se reactive. |

**Cómo se marca cada escenario:** ✅ Pasó · ❌ No pasó · ➖ No aplica. Si algo no pasa, se anota qué se vio y qué se esperaba. Ese escenario no se firma hasta que se corrija y se repita.

---

## Escenarios del día a día

### 1. Cotizar sin señal 📵 (E3)

*Un cliente llega a la obra y no hay internet.*

1. Pon la tablet en modo avión. Abre **Cotizador** y entra con tu PIN.
2. Toca **Nueva cotización**. Busca o captura al cliente (nombre y WhatsApp de 10 dígitos).
3. Agrega un cristal a medida: escribe **ancho**, **alto** y **cantidad**. Agrega también otro producto.
4. Revisa que el **subtotal, el IVA y el total** salgan y que el precio incluya IVA.
5. Toca **Emitir cotización**. Anota el **folio provisional** (algo como `T1-0001`), el **código** y la fecha de **vigente hasta**.
6. Repite hasta tener **3 cotizaciones**. Quita el modo avión.

**Debe pasar:** las tres cotizaciones quedan guardadas en la tablet. Al volver la conexión llegan al servidor **sin duplicarse**, con su folio definitivo y el mismo total.

**Firma de Luis:** ☐ Pasó · __________

### 2. Cobrar un anticipo y empezar el trabajo (E1)

1. En **Cotizador**, abre una cotización emitida y toca **Compartir por WhatsApp**. Comprueba que el PDF se ve bien en el teléfono.
2. Márcala como aceptada (**Marcar como aceptada**).
3. Ve a **Órdenes de trabajo**. En *Cotizaciones aceptadas por convertir* toca **Crear orden de trabajo**.
4. Elige la **fecha estimada de entrega** en el calendario (es obligatoria) y toca **Crear la orden**.
5. Abre la orden y toca **Cobrar**. El sistema sugiere el **anticipo** (por omisión, la mitad). Cobra en efectivo con un billete más grande que el anticipo.
6. Comprueba el **cambio**, que la orden muestre *Pagado* y *Saldo*, y que el pago aparezca en la lista de **Pagos**.
7. En *Datos del trabajo* asigna *quién mide*, *quién fabrica* y *quién instala*, y toca **Guardar datos**.
8. Avanza la orden: **En espera → En proceso → Listo**.

**Debe pasar:** una orden **sin anticipo** no se puede empezar si no se teclea el PIN de un administrador. Cada cambio queda con el nombre de quien lo hizo.

**Firma de Luis:** ☐ Pasó · __________

### 3. Entregar y cobrar el saldo (E1)

1. Con la orden en **Listo**, toca **Entregar**.
2. Cobra el **saldo**: una vez en efectivo y otra por transferencia, con su referencia.
3. Toca **Comprobante por WhatsApp**. Revisa el PDF en hoja carta: logo, folio, saldo en cero y garantía.
4. Prueba también entregar una orden **con saldo**: el sistema debe pedir el PIN de un administrador y un motivo.

**Debe pasar:** la orden queda *Entregado* y *Liquidada*, y el comprobante se lee bien en el teléfono.

**Firma de Luis:** ☐ Pasó · __________

### 4. Vender en el mostrador: efectivo, transferencia y mixta 🖨️ (E2)

1. Ve a **Mostrador**. Si no tienes turno, toca **Abrir turno** (puedes anotar un fondo inicial).
2. En *Venta rápida* busca un producto, escribe las medidas si es a medida y toca **Agregar al ticket**.
3. Toca **Cobrar** y haz tres ventas: una **en efectivo** (con cambio), una **por transferencia** y una **mixta** (parte y parte).
4. En cada venta, toca **Enviar por WhatsApp** y, en una de ellas, **Imprimir**.

**Debe pasar:** el total es exacto al centavo. El comprobante sale en **hoja carta** con el logo y el detalle de la compra, y llega en PDF por WhatsApp. Cada venta queda con su folio provisional y la leyenda *Guardada en la tablet*.

**Firma de Luis:** ☐ Pasó · __________

### 5. Hacer el corte de caja 🖨️ (E2)

1. En *Mi turno de caja* revisa lo **cobrado en efectivo**, lo **cobrado por transferencia** y el **efectivo que debe haber**.
2. Toca **Cerrar turno**, cuenta el efectivo y escribe el **efectivo contado** exacto. Toca **Cerrar y calcular el corte**.
3. Revisa que salga **Exacto** e imprime el resumen del corte.
4. Repite con el segundo cajero para ver el corte de cada uno y el total del día.

**Debe pasar:** las ventas canceladas no cuentan; la diferencia es la correcta; cada cajero ve **solo su** corte. *(La diferencia con explicación se prueba en el escenario 15.)*

**Firma de Luis:** ☐ Pasó · __________

### 6. Entrar con PIN, cambiar de persona y bloqueo (E4)

1. Entra con el PIN del cajero 1, haz una cotización y sal.
2. Entra con el PIN del cajero 2 y del administrador, y haz una acción con cada uno.
3. Deja la tablet sin tocar el tiempo configurado.
4. Como administrador (con tu correo y contraseña), entra a **Usuarios** y revisa la **Bitácora**: cada acción aparece con el nombre de quien la hizo y la tablet desde la que se hizo.

**Debe pasar:** la tablet se **bloquea sola** por inactividad y pide el PIN otra vez; nada se atribuye a la persona equivocada.

**Firma de Luis:** ☐ Pasó · __________

### 7 a 10. Facturación (E5 y E6) · en pausa

> **No se ejecutan en esta entrega.** La facturación está en pausa hasta que ZAMMIR tenga en orden sus datos fiscales [ADR-0039]. Mientras tanto, el contador de ZAMMIR sigue facturando. Al reactivarla se agregan aquí los escenarios de facturar desde el sistema (7), el portal del cliente (8), corregir una factura (9) y las facturas "en proceso" (10). Sus pasos quedan en el historial de este documento.

### 11. Cuentas por cobrar y clientes

1. Entra a **Cuentas por cobrar**: deben verse las órdenes con saldo, de la más atrasada a la más reciente, con las atrasadas resaltadas.
2. Toca **Registrar pago** en una de ellas.
3. En **Clientes**, abre la ficha de un cliente con varios trabajos: sus cotizaciones, órdenes, ventas, pagos y garantías, y la marca de **cliente recurrente** (dos o más trabajos entregados).

**Debe pasar:** los saldos coinciden con lo cobrado y lo pendiente de cada orden.

**Firma de Luis:** ☐ Pasó · __________

### 12. Reportes y permisos (E7 y E8)

1. Como **administrador**, abre **Reportes**. Compara el día, la semana (de lunes a domingo) y el mes con las ventas y pagos que tú hiciste al probar.
2. Entra como **cajero** e intenta ver **Reportes**, **Usuarios**, **Cuentas por cobrar**, cortes ajenos y precios que no le tocan.

**Debe pasar:** los reportes coinciden **al centavo** con lo registrado, con el día, la semana y el mes bien delimitados en hora de México. El cajero **no** ve nada de eso.

**Firma de Luis:** ☐ Pasó · __________

### 13. Imprimir y enviar en hoja carta 🖨️ (E10)

1. Imprime una **cotización**, un **comprobante de orden**, una **venta** y un **corte**. Revisa que salgan en hoja carta, con logo, sin cortes ni letras ilegibles.
2. Vuelve a imprimir uno de ellos: debe salir con la marca **COPIA**.
3. Apaga la impresora e intenta imprimir: el sistema debe decir qué hacer y ofrecer guardar el PDF o mandarlo por WhatsApp.
4. Imprime **30 comprobantes** seguidos.

**Debe pasar:** las 30 hojas salen sin error, y los mismos documentos llegan en PDF legible por WhatsApp.

**Firma de Luis:** ☐ Pasó · __________

### 14. Si se descompone: respaldo y restauración (E9)

*Lo hace HummingX; Luis solo lo presencia o revisa la evidencia.*

1. HummingX toma una copia real del respaldo nocturno y la restaura en un entorno limpio.
2. Se comparan cuántas ventas, órdenes, pagos y clientes hay en cada uno.

**Debe pasar:** los datos coinciden y el procedimiento queda escrito ([`RESTAURACION.md`](../operacion/RESTAURACION.md)).

**Firma de Luis:** ☐ Pasó · __________

---

## Escenarios de los ajustes para la entrega [ADR-0044]

### 15. Corte con diferencia: pedir la explicación (AJ-02)

1. Con un turno abierto y al menos una venta en efectivo, toca **Cerrar turno**.
2. Escribe un **efectivo contado** distinto del esperado por **$1** y toca **Cerrar y calcular el corte**.
3. El sistema muestra **Explicar la diferencia**. Intenta cerrar sin escribir nada.
4. Escribe por qué hay diferencia y toca **Cerrar el turno con esta explicación**.

**Debe pasar:** sin explicación no se cierra el turno. El corte muestra **Faltante** (o **Sobrante**) y la explicación escrita.

**Firma de Luis:** ☐ Pasó · __________

### 16. Fecha de entrega y órdenes atrasadas (AJ-03)

1. Al crear una orden, intenta tocar **Crear la orden** sin elegir la **fecha estimada de entrega**.
2. Crea una orden con fecha de **ayer** (HummingX la prepara si hace falta).
3. En **Órdenes de trabajo**, toca el filtro **Atrasadas**.
4. Abre una orden no entregada, cambia su fecha en *Datos del trabajo* y toca **Guardar datos**.

**Debe pasar:** sin fecha no se crea la orden. La orden vencida y sin entregar sale como **Atrasada** y aparece en su filtro. El cambio de fecha queda con el nombre de quien lo hizo.

**Firma de Luis:** ☐ Pasó · __________

### 17. Cuentas por cobrar contadas desde la entrega (AJ-04)

1. Entra a **Cuentas por cobrar**.
2. Revisa una orden con saldo que **todavía no se entrega** y otra **ya entregada** con saldo.
3. En **Configuración**, revisa *Cuentas por cobrar atrasadas*: los días para marcar una cuenta como atrasada (por omisión, 1).

**Debe pasar:** la orden no entregada sale como **Por entregar**. La entregada cuenta sus **días desde la entrega** y se resalta como atrasada desde el día siguiente.

**Firma de Luis:** ☐ Pasó · __________

### 18. Confirmar que llegó una transferencia (AJ-05)

1. Cobra una orden **por transferencia**, con su referencia.
2. Como administrador, entra a **Cuentas por cobrar** → *Transferencias por confirmar*.
3. Revisa que la transferencia salga **Por confirmar** y toca **Ya llegó**.

**Debe pasar:** la transferencia queda **Confirmada**, con quién la confirmó y cuándo. Los totales no cambian.

**Firma de Luis:** ☐ Pasó · __________

### 19. Cancelar una venta y devolver el dinero (AJ-06)

1. En **Mostrador** → *Ventas de hoy*, toca **Cancelar venta** en una venta en efectivo.
2. Teclea el PIN de un administrador y escribe el motivo.
3. Lee el aviso: el sistema dice cuánto se le devuelve al cliente y que el efectivo sale del cajón de tu turno.
4. Cierra el turno y revisa el corte.

**Debe pasar:** la venta queda *Cancelada* y no suma al total. El corte muestra el **efectivo devuelto**. Un corte que ya estaba cerrado no cambia.

**Firma de Luis:** ☐ Pasó · __________

### 20. Entregar un trabajo por partes (AJ-07)

1. Acepta una cotización con varias líneas. En **Órdenes de trabajo**, toca **Crear orden de trabajo**.
2. Marca **¿Se entrega por partes?** y elige las *Líneas que van en esta parte*. Elige la fecha y toca **Crear la orden**.
3. Revisa que la orden diga **Parte 1** y cuántas líneas faltan. Crea la segunda parte con las líneas restantes.

**Debe pasar:** cada parte es una orden con su propio anticipo y saldo, ligada a las demás. Una línea no puede ir en dos partes.

**Firma de Luis:** ☐ Pasó · __________

### 21. Administrar las categorías (AJ-08)

1. Como administrador, entra a **Catálogo** → *Categorías*.
2. Toca **Agregar categoría** (por ejemplo, *Vitrales*). Cámbiale el nombre y el orden.
3. Intenta desactivar una categoría que tiene productos activos.
4. Desactiva una categoría sin productos.

**Debe pasar:** la categoría nueva aparece para los productos. La que tiene productos activos no se desactiva y el sistema dice qué hacer. Ninguna categoría se borra.

**Firma de Luis:** ☐ Pasó · __________

### 22. Cobrar un cargo extra: cantos, perforaciones y biselados (AJ-09)

1. En **Catálogo**, revisa un producto de tipo *Cargo extra* (por ejemplo, canto pulido por m²).
2. En el **Cotizador**, agrega un vidrio a medida. En esa línea toca **Cargo extra**, elige el cargo y toca **Agregar a la línea**.
3. Revisa el importe de la línea y el total.

**Debe pasar:** el cargo se cobra con la medida de esa línea (m², metro lineal o pieza) y se suma a su importe. El total y el IVA salen exactos.

**Firma de Luis:** ☐ Pasó · __________

### 23. Cancelar una orden con anticipo [ADR-0045]

1. En una orden **En espera** con anticipo cobrado, toca **Cancelar la orden**.
2. Teclea el PIN de un administrador y escribe el motivo, con lo que se decidió del anticipo.
3. Abre la orden cancelada.

**Debe pasar:** la orden queda *Cancelado* y no desaparece. Queda el motivo, quién canceló y el anticipo pagado. El sistema no devuelve el anticipo solo: si se devuelve efectivo, se explica en el corte (acta de entrega, sección 4).

**Firma de Luis:** ☐ Pasó · __________

---

## Revisión general de pantallas

Al terminar los escenarios, Luis marca lo que vio durante todo el recorrido:

- [ ] Todo está en español, con las palabras que ustedes usan en el negocio, sin textos en inglés.
- [ ] No hubo datos de relleno ni números sin sentido.
- [ ] Los mensajes de error dijeron **qué hacer**.
- [ ] La tablet respondió con rapidez en los momentos de más trabajo (cotizar, cobrar, buscar).
- [ ] Los botones y textos se podían tocar y leer cómodamente.

## Resultados

| # | Escenario | Resultado | Lo que se vio / comentarios |
|---|---|---|---|
| 1 | Cotizar sin señal | | |
| 2 | Cobrar un anticipo y empezar el trabajo | | |
| 3 | Entregar y cobrar el saldo | | |
| 4 | Vender en el mostrador | | |
| 5 | Hacer el corte de caja | | |
| 6 | Entrar con PIN, cambiar de persona y bloqueo | | |
| 7 a 10 | Facturación | ➖ En pausa | [ADR-0039] |
| 11 | Cuentas por cobrar y clientes | | |
| 12 | Reportes y permisos | | |
| 13 | Imprimir y enviar en hoja carta | | |
| 14 | Respaldo y restauración | | |
| 15 | Corte con diferencia y explicación | | |
| 16 | Fecha de entrega y órdenes atrasadas | | |
| 17 | Cuentas por cobrar desde la entrega | | |
| 18 | Confirmar que llegó una transferencia | | |
| 19 | Cancelar una venta y devolver el dinero | | |
| 20 | Entregar un trabajo por partes | | |
| 21 | Administrar las categorías | | |
| 22 | Cobrar un cargo extra | | |
| 23 | Cancelar una orden con anticipo | | |

## Firmas

| | Nombre | Fecha | Firma |
|---|---|---|---|
| Por ZAMMIR | Luis | | |
| Por HummingX BI | | | |

> Firmar significa que los escenarios marcados ✅ funcionan como se espera, probados con datos inventados antes de cargar los datos reales. La facturación no forma parte de esta aceptación [ADR-0039].

## De dónde sale cada escenario

| Escenario | Recorrido | Historias |
|---|---|---|
| 1 | E3 | Sprint 2 (cotizador) |
| 2 y 3 | E1 | Sprint 2 y 3 (órdenes y pagos) |
| 4, 5 y 13 | E2, E10 | Sprint 3 (mostrador y caja), S4-37 (hoja carta) |
| 6 | E4 | Sprint 1 y 3 |
| 7 a 10 | E5, E6 | En pausa [ADR-0039] |
| 11 | — | Sprint 3 y 4 |
| 12 | E7, E8 | Sprint 4 |
| 14 | E9 | S5-06 |
| 15 a 22 | — | AJ-02 a AJ-09 [ADR-0044] |
| 23 | — | RF-M3-08 [ADR-0045] |

*(AJ-01, las listas sin tope de 1000 renglones, no se prueba a mano: la cubren las pruebas automáticas.)*
