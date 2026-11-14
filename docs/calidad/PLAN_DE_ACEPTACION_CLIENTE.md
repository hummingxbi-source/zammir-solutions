# Plan de pruebas de aceptación con el cliente

> Historia S4-30. Es el guion que **Luis** (o quien él designe) ejecuta con la tablet de ZAMMIR y firma. Parte de los recorridos E1 a E10 de [`PRUEBAS_DE_ACEPTACION.md`](PRUEBAS_DE_ACEPTACION.md), pero escrito con las palabras del oficio: cada escenario es un día normal en el negocio, no una prueba técnica.
>
> **Fechas acordadas con Luis (8 nov 2026):** sábado 28, domingo 29 y lunes 30 de noviembre, con la tablet en el local; falta la hora de cada sesión. Se usan para la capacitación y para ejecutar este guion.
> Borrador hasta que Juanito lo apruebe. La aceptación firmada es la historia S5-10.

## Antes de empezar

| Qué | Detalle |
|---|---|
| Dónde se prueba | En el entorno de **pruebas**, nunca con la base real de ZAMMIR. |
| Con qué datos | **Inventados** (clientes, productos, precios y folios de prueba). Ninguna prueba usa datos reales de clientes [ADR-0010]. |
| Con qué equipo | La tablet y la impresora que ZAMMIR usará. Los escenarios marcados con 🖨️ necesitan la impresora; los marcados con 📵 se hacen **sin internet** (modo avión). |
| Quién acompaña | Juanito (HummingX BI) toma nota de lo que no salga bien; no hace los pasos por Luis. |
| Personas de prueba | Un **administrador** y dos **cajeros / vendedores**, cada uno con su PIN (los da de alta Juanito antes de empezar). |
| Facturas | Mientras no se conecte el proveedor de timbrado real (PD-05), las facturas son **de prueba y no tienen validez fiscal**. Se prueba que el sistema funcione, no que el SAT las acepte. |

**Cómo se marca cada escenario:** ✅ Pasó · ❌ No pasó · ➖ No aplica. Si algo no pasa, se anota qué se vio y qué se esperaba; no se firma ese escenario hasta que se corrija y se repita.

---

## Escenarios del día a día

### 1. Cotizar sin señal 📵 (E3)

*Un cliente llega a la obra y no hay internet.*

1. Pon la tablet en modo avión. Abre **Cotizador**; entra con tu PIN.
2. Toca **Nueva cotización**. Busca o captura al cliente (nombre y WhatsApp de 10 dígitos).
3. Agrega un cristal a medida: escribe **ancho**, **alto** y **cantidad**. Agrega también un servicio (por ejemplo, instalación).
4. Revisa que el **subtotal, el IVA y el total** salgan y que el precio incluya IVA.
5. Toca **Emitir cotización**. Anota el **folio provisional** (algo como `T1-0001`), el **código** y la fecha de **vigente hasta**.
6. Repite para tener **3 cotizaciones** en total. Quita el modo avión.

**Debe pasar:** las tres cotizaciones quedan guardadas en la tablet; al volver la conexión llegan al servidor **sin duplicarse**, con su folio definitivo y el mismo total.

### 2. Cobrar un anticipo y empezar el trabajo (E1)

1. En **Cotizador**, abre una cotización emitida y toca **Compartir por WhatsApp**. Comprueba que el PDF se ve bien en el teléfono.
2. Márcala como aceptada (**Marcar como aceptada**).
3. Ve a **Órdenes de trabajo**. En *Cotizaciones aceptadas por convertir* toca **Crear orden de trabajo**.
4. Abre la orden y toca **Cobrar**. El sistema sugiere el **anticipo** (por defecto la mitad). Cobra en efectivo con un billete más grande que el anticipo.
5. Comprueba el **cambio**, que la orden muestre *Pagado* y *Saldo*, y que el pago aparezca en la lista de **Pagos**.
6. Asigna *quién mide*, *quién fabrica* y *quién instala*, y una *fecha estimada de entrega*. Toca **Guardar datos**.
7. Avanza la orden: **En espera → En proceso → Listo**.

**Debe pasar:** una orden **sin anticipo** no se puede empezar si no se teclea el PIN de un administrador. Cada cambio queda con el nombre de quien lo hizo.

### 3. Entregar y cobrar el saldo (E1)

1. Con la orden en **Listo**, toca **Entregar**.
2. Cobra el **saldo** (prueba una vez en efectivo y otra por transferencia, con su referencia).
3. Toca **Comprobante por WhatsApp**. Comprueba el PDF: folio, saldo en cero, garantía y el **QR de autofacturación**.
4. Prueba también entregar una orden **con saldo**: el sistema debe pedir el PIN de un administrador y un motivo.

**Debe pasar:** la orden queda *Entregado* y *Liquidada*, y el comprobante se ve legible en el teléfono.

### 4. Vender en el mostrador: efectivo, transferencia y mixta 🖨️ (E2)

1. Ve a **Mostrador**. Si no tienes turno, toca **Abrir turno** (puedes anotar un fondo inicial).
2. En *Venta rápida* busca un producto, escribe las medidas si es a medida y toca **Agregar al ticket**.
3. Toca **Cobrar** y haz tres ventas: una **en efectivo** (con cambio), una **por transferencia** y una **mixta** (parte y parte).
4. Toca **Imprimir ticket** en cada una.

**Debe pasar:** el total es exacto al centavo, el ticket sale con su **QR** y un **código de verificación**, y cada venta queda con su folio provisional y la leyenda *Guardada en la tablet*.

### 5. Hacer el corte de caja 🖨️ (E2)

1. En *Mi turno de caja* revisa lo **cobrado en efectivo**, lo **cobrado por transferencia** y el **efectivo que debe haber**.
2. Toca **Cerrar turno**, cuenta el efectivo y escribe el **efectivo contado**. Toca **Cerrar y calcular el corte**.
3. Revisa si sale **Exacto**, **Sobrante** o **Faltante**, y toca **Imprimir resumen**.
4. Repite con un segundo cajero para ver el corte de cada uno y el total.

**Debe pasar:** las ventas canceladas no cuentan; la diferencia es la correcta; cada cajero ve **solo su** corte.

### 6. Entrar con PIN, cambiar de persona y bloqueo (E4)

1. Entra con el PIN del cajero 1, haz una cotización y sal.
2. Entra con el PIN del cajero 2 y del administrador, y haz una acción cada uno.
3. Deja la tablet sin tocar el tiempo configurado.
4. Como administrador (con tu correo y contraseña), entra a **Usuarios** y revisa la **Bitácora**: cada acción aparece con el nombre de quien la hizo y la tablet desde la que se hizo.

**Debe pasar:** la tablet se **bloquea sola** por inactividad y pide el PIN otra vez; nada se atribuye a la persona equivocada.

### 7. Facturar a un cliente desde el sistema (E6)

1. Como **administrador**, entra a **Facturas** (con tu correo y contraseña). En la pestaña **Por facturar** toca **Facturar** en una venta u orden ya cobrada.
2. Revisa los datos del cliente (vienen de su ficha, se pueden corregir) y toca **Timbrar factura**.
3. Descarga el **PDF** y el **XML**, y prueba **Enviar por WhatsApp**.
4. Con un pago **mixto**, comprueba que el sistema te pide **elegir la forma de pago**.
5. Entra como **cajero**: la sección **Facturas** no debe estar disponible.

**Debe pasar:** solo un administrador puede facturar; una venta ya facturada no se puede facturar otra vez.

### 8. El cliente se factura solo en el portal (E5)

*Desde el teléfono, sin cuenta.*

1. Abre la dirección que viene en el **QR del ticket**. Escribe el **folio** y el **código de verificación**.
2. Captura los datos fiscales y pide la factura. Descárgala.
3. Intenta de nuevo con **el mismo folio** (ya facturado), con un folio **de un mes anterior** (fuera de plazo) y con un **código equivocado**.

**Debe pasar:** la primera vez se genera la factura de prueba; las otras tres se **rechazan con un mensaje claro** y **no se duplica ningún timbre**. Un folio que no existe y uno con código incorrecto muestran **lo mismo** (para que nadie pueda adivinar folios).

### 9. Corregir una factura mal emitida (RN-28)

1. Como administrador, en **Facturas** → **Emitidas**, elige una factura y toca **Cancelar**.
2. Elige el **motivo** (si es el 01, escribe el folio de la factura que la sustituye) y confirma.
3. Vuelve a **Por facturar**: la venta u orden ya se puede facturar otra vez.

**Debe pasar:** la factura queda como *Cancelada* (no desaparece), y queda anotado **quién la canceló y por qué**.

### 10. Revisar las facturas emitidas y entender "en proceso"

1. En **Facturas** → **Emitidas** revisa la lista: cada factura con su estado (*Vigente*, *Cancelada* o *En proceso*), su fecha y su total.
2. Juanito explica qué hace el sistema cuando el proveedor de timbrado no contesta: la factura queda **En proceso**, se reintenta sola y también se puede tocar **Reintentar**, y **nunca se timbra dos veces**.
3. Revisa el indicador de **timbres** del año.

**Debe pasar:** Luis entiende qué significa cada estado y qué hacer con una factura en proceso. *Esta falla no se puede provocar desde la tablet:* Juanito la prueba con pruebas automáticas y, más adelante, contra el entorno de pruebas del proveedor real (S4-31).

### 11. Cuentas por cobrar y clientes

1. Entra a **Cuentas por cobrar**: deben verse las órdenes con saldo, de la más atrasada a la más reciente, con las atrasadas resaltadas.
2. Toca **Registrar pago** en una de ellas.
3. En **Clientes**, abre la ficha de un cliente con varios trabajos: sus cotizaciones, órdenes, ventas, pagos, garantías y facturas, y la marca de **cliente recurrente** (dos o más trabajos entregados).

**Debe pasar:** los saldos coinciden con lo cobrado y lo pendiente de cada orden.

### 12. Reportes y permisos (E7 y E8)

1. Como **administrador**, abre **Reportes**. Compara el día, la semana (de lunes a domingo) y el mes con las ventas y pagos que tú hiciste al probar.
2. Entra como **cajero** e intenta ver **Reportes**, **Usuarios**, **Facturas**, cortes ajenos y precios que no le tocan.

**Debe pasar:** los reportes coinciden **al centavo** con lo registrado, con el día, la semana y el mes bien delimitados en hora de México. El cajero **no** ve nada de eso.

### 13. Imprimir 30 tickets seguidos 🖨️ (E10)

1. Imprime **30 tickets** uno tras otro.
2. Revisa que el **QR** de cada uno se escanee con el teléfono.

**Debe pasar:** los 30 salen sin error ni cortes a medias.

### 14. Si se descompone: respaldo y restauración (E9)

*Lo hace Juanito; Luis solo lo presencia.*

1. Juanito toma una copia completa y la restaura en un entorno limpio.
2. Se comparan cuántas ventas, órdenes, pagos y clientes hay en cada uno.

**Debe pasar:** los datos coinciden y el procedimiento queda escrito en el manual de soporte.

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
| 7 | Facturar desde el sistema | | |
| 8 | El cliente se factura en el portal | | |
| 9 | Corregir una factura mal emitida | | |
| 10 | Revisar las facturas emitidas y entender "en proceso" | | |
| 11 | Cuentas por cobrar y clientes | | |
| 12 | Reportes y permisos | | |
| 13 | Imprimir 30 tickets | | |
| 14 | Respaldo y restauración | | |

## Firmas

| | Nombre | Fecha | Firma |
|---|---|---|---|
| Por ZAMMIR | Luis | | |
| Por HummingX BI | Juanito | | |

> Firmar significa que los escenarios marcados ✅ funcionan como se espera **en el entorno de pruebas**. Las facturas siguen siendo de prueba hasta conectar el proveedor de timbrado real y el certificado de sello digital de ZAMMIR (PD-04, PD-05); esa conexión tiene su propia revisión antes de operar con datos reales.

## De dónde sale cada escenario

| Escenario | Recorrido | Historias |
|---|---|---|
| 1 | E3 | Sprint 2 (cotizador) |
| 2 y 3 | E1 | Sprint 2 y 3 (órdenes y pagos) |
| 4, 5 y 13 | E2, E10 | Sprint 3 (mostrador y caja) |
| 6 | E4 | Sprint 1 y 3 |
| 7 y 9 | E6 | S4-16, S4-17, S4-21 |
| 8 | E5 | S4-18, S4-19 |
| 10 | RF-M10-15 | S4-20 |
| 11 | — | Sprint 3 y 4 |
| 12 | E7, E8 | Sprint 4 |
| 14 | E9 | S5-06 |
