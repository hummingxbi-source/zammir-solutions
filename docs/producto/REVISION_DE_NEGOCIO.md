# Revisión de negocio de la demo

> Retroalimentación sobre lo que mostró la demo (ver [`docs/producto/DEMO_REFERENCIA.md`](DEMO_REFERENCIA.md)), con las reglas de negocio que faltan por definir.
> Fecha: 2026-10-27. Autor: Claude Code, a petición de Juanito.
>
> **Cómo leer este documento**
> - Todo lo de aquí es **propuesta**. Ninguna regla se vuelve regla (`RN-xx`) hasta que Juanito la apruebe y, cuando dependa del negocio, Luis la confirme.
> - Parto de lo que ya dicen `REGLAS_DE_NEGOCIO.md` y `REQUERIMIENTOS.md`, y de cómo suele trabajar una vidriería. **No conozco las prácticas de ZAMMIR**: donde hay un hueco, lo convierto en una pregunta para Luis, no en una suposición [CLAUDE.md regla 1].
> - Las preguntas están en `PENDIENTES.md` como PD-25 a PD-36; las ideas, como PP-07 a PP-19.

---

## 1. Resumen

**La demo acierta en lo esencial:** el recorrido (catálogo → cotización → orden → mostrador → reportes) es el correcto, la cotización en vivo con PDF y WhatsApp ataca el problema número uno del cliente, y el ciclo de la orden (espera → proceso → listo → entregado) corresponde a cómo trabaja un taller.

**Lo que más pesa y todavía no está definido** (en orden de importancia):

| # | Tema | Por qué importa | Pregunta |
|---|---|---|---|
| 1 | **Significado de cada estatus** y qué se exige para avanzar | Sin esto el tablero y los reportes no significan nada | Sección 2 |
| 2 | **Caja compartida entre tres personas** | El corte "por cajero" solo funciona si se sabe cómo se reparte el efectivo | PD-25 |
| 3 | **Medición final distinta de la cotizada** | Las condiciones de la cotización la prevén, pero el precio está congelado [RN-03] | PD-27 |
| 4 | **¿Se fabrica sin anticipo?** | Decide cuándo una orden pasa a "en proceso" | PD-28 |
| 5 | **Roturas y reposiciones** | En vidrio ocurren; hoy no hay dónde registrarlas | PD-29 |
| 6 | **Retiros y gastos de caja** | Si salen pesos del cajón, el "efectivo esperado" nunca cuadra | PD-26 |
| 7 | **Tiempos de entrega** | El templado suele depender de un tercero; sin tiempos no hay "atrasadas" | PD-30 |

**Mi recomendación de alcance:** el calendario es apretado [ROADMAP]. Las propuestas de abajo están ordenadas por valor y esfuerzo (sección 8) para que Juanito decida qué entra antes de la entrega y qué se mueve a después.

---

## 2. Órdenes de trabajo: estatus y reglas

### 2.1 Estatus propuestos
Se mantienen los cinco que ya tiene RF-M3-02. Lo que propongo es **definir cada uno** y lo que se exige para entrar a él:

| Estatus | Significa | Para entrar |
|---|---|---|
| **En espera** | La orden existe, pero todavía no se fabrica (falta anticipo, medida final o material) | Se crea la orden |
| **En proceso** | Se está fabricando | Anticipo exigido registrado [RN-08], o autorización de un administrador con motivo *(PD-28)* |
| **Listo** | Terminado; espera que el cliente lo recoja o que se instale | Pasa de "en proceso" |
| **Entregado** | Recogido o instalado | Saldo en cero, o administrador con motivo [RF-M3-04]. Crea la garantía [RF-M3-05] |
| **Cancelado** | Terminó sin entregarse | Solo administrador, con motivo [RF-M3-08]. Se guarda **en qué etapa estaba** al cancelar |

**Transiciones permitidas:** en espera → en proceso → listo → entregado; y a cancelado desde espera, proceso o listo. **Retroceder** (por ejemplo, de listo a proceso porque se rompió una pieza) solo lo hace un administrador, con motivo y rastro. De entregado o cancelado no se sale. Cada cambio guarda usuario, dispositivo y hora [RN-19].

### 2.2 Sin más estatus: dos marcas
La tentación es agregar estatus ("en templado", "esperando material", "en instalación"). Cada estatus nuevo complica el tablero. Propongo **no agregar estatus** y usar:
- **Marca "detenida"** con motivo (falta material, el cliente no responde, esperan medidas). Propuesta PP-10.
- **Forma de entrega** de la orden: *recoge en el local* o *instalación en obra*, con fecha programada si es instalación. Los responsables (quién mide, fabrica, instala) ya están en RF-M3-01.

### 2.3 Tiempos y atención
- Cada orden tiene **fecha estimada de entrega** [RF-M3-01]. Una orden está **atrasada** si hoy supera esa fecha y no está entregada.
- Como cada cambio de estatus se guarda con su hora, el sistema puede mostrar **cuántos días lleva en la etapa actual** sin guardar nada más.
- Con eso se arma una lista de **Atención** (PP-07): órdenes atrasadas, detenidas o con demasiados días en una etapa, y cuentas por cobrar viejas. Los umbrales son configurables y **los valores los define Luis** (PD-30). Esto es lo que la demo llamaba "detecta cuellos de botella": se logra con reglas simples, sin predicciones, que quedan fuera del alcance.
- **Fecha estimada sugerida** según el tipo de producto (PP-16): depende de que Luis diga cuánto tarda cada cosa.
- **Entregadas** en el tablero debe tener un periodo (por ejemplo, últimos 30 días, configurable); de lo contrario el número solo crece.

### 2.4 Cobro y comprobante
- "Generar comprobante" y "Avanzar" son las dos acciones correctas por fila. Sugiero una tercera, **cobrar saldo**, porque es lo que se hace al entregar [RF-M6-02, RF-M4-05].
- El comprobante se genera al cobrar el anticipo y se actualiza al liquidar [RF-M3-06].
- **Aviso de trabajo listo:** al pasar a "listo", ofrecer un mensaje de WhatsApp prellenado al cliente (PP-11), igual que el recordatorio de cobro [RF-M6-03]. Es barato y reduce llamadas.

### 2.5 Entregas parciales *(PD-35)*
Una orden con varias piezas puede quedar lista por partes. En esta versión el estatus es **por orden**. Si ZAMMIR entrega con frecuencia por partes, hay que cambiar el modelo (estatus por línea); es mejor saberlo **antes** del Sprint 3.

### 2.6 Roturas y reposiciones *(PD-29, PP-12)*
En vidrio, una pieza se rompe al cortar, al templar o al instalar, y un error de medida obliga a rehacerla. Hoy el sistema no tiene dónde decirlo, y sin eso no se puede saber cuántos trabajos se repiten ni por qué.
- **Propuesta:** una **reposición** es una orden ligada a la original, con **causa** (error de medida, rotura en fabricación, rotura en instalación, defecto del proveedor, otra) y sin cobro. No guarda costos (están fuera del alcance), pero sí **cuántas** y **por qué**.
- **Pregunta de fondo:** ¿quién absorbe cada caso? Eso es una regla comercial y de garantía que define Luis [PD-06].

---

## 3. Precio y cotización

### 3.1 Medición final distinta de la cotizada *(PD-27)*
La condición 3 de las cotizaciones dice que el tiempo y el trabajo están "sujetos a la medición física final en obra" [RN-13]. Pero el precio se congela al emitir [RN-03]. **Estas dos cosas chocan** cuando el cliente cotizó con medidas de cinta y ZAMMIR mide distinto.
- **Propuesta:** el ajuste se hace en la **orden**, nunca editando la cotización original. Un administrador cambia las medidas de una línea con motivo; el sistema recalcula con la regla de precio y deja en la bitácora el valor anterior y el nuevo. El cliente recibe un comprobante actualizado.
- **A definir con Luis:** si el cliente debe aceptar el cambio, a partir de qué diferencia, y qué pasa con el anticipo ya cobrado.

### 3.2 Medición a domicilio y flete *(PD-31)*
La medición y la instalación son servicios del catálogo [RN-01]. Falta saber:
- ¿La visita de medición se cobra, es gratis o **se abona al trabajo si el cliente continúa**?
- ¿Hay recargo por distancia fuera de Otumba?
Es un tema de reglas de precio configurables [ADR-0006], no de código nuevo.

### 3.3 Descuentos *(PD-34)*
Hoy los descuentos exigen el PIN de un administrador [RF-M2-03]. Falta saber si hay **tope** (porcentaje máximo) y si un administrador puede dar cualquier descuento.

### 3.4 Seguimiento de cotizaciones *(PP-19)*
El cotizador existe porque ZAMMIR perdía presupuestos por tardar. El siguiente paso natural es **darles seguimiento**: una lista de cotizaciones enviadas que vencen pronto, con un botón de WhatsApp para preguntar al cliente, y un indicador de **cuántas cotizaciones se vuelven órdenes**. Es el dato que más le sirve a un dueño para saber si el cotizador funciona. Se calcula con los estados que ya existen [RF-M2-07].

### 3.5 Convertir solo una parte *(PP-15)*
RF-M2-08 convierte la cotización completa. En la práctica, el cliente suele aceptar **solo algunas líneas**. Propuesta: poder elegir qué líneas pasan a la orden.

---

## 4. Dinero y caja

### 4.1 La pregunta central: ¿de quién es el efectivo? *(PD-25, bloquea el Sprint 3)*
El documento original pide controlar "la caja compartida por tres personas" y hacer un corte **por cajero** [RF-M4-06]. Pero si los tres usan el mismo cajón, el efectivo contado al final del día **no se puede repartir** entre ellos. Hay dos formas de resolverlo:

| | A. Corte por relevo | B. Un corte por día |
|---|---|---|
| Cómo funciona | Cuando cambia quien cobra, el que sale cuenta el efectivo y cierra su turno; el que entra abre con ese monto como fondo | El efectivo se cuenta una vez al cierre; los cobros por cajero se obtienen de lo que cada uno registró |
| Responsabilidad de un faltante | Clara: de quien cerró el turno | Difusa: del día |
| Esfuerzo | Más conteos | Un solo conteo |
| Encaja con RN-11 ("cuentan en la caja de quien los recibió") | Sí | Parcialmente |

**No elijo por Luis.** Propongo preguntarle cómo cuentan hoy y cuántas veces cambia la persona en caja en un día. Por diseño, el sistema separa dos cosas que no hay que confundir: **el turno de caja** (el cajón físico) y **los cobros por cajero** (quién registró cada pago). Eso permite cualquiera de las dos opciones sin rehacer el modelo.

### 4.2 Retiros y gastos de caja *(PD-26, PP-09)*
Si alguien saca efectivo del cajón (pagar un flete, comprar algo, depositar al banco, retirar el dueño), el "efectivo esperado" deja de coincidir. Muchas vidrierías lo hacen. **Propuesta:** registrar cada salida de efectivo en el turno, con tipo, monto, motivo y usuario; se resta del esperado. Si ZAMMIR nunca saca efectivo, no se construye.

### 4.3 Transferencias *(PD-32)*
La demo muestra "transferencias **reportadas**": son lo que el cajero dice haber recibido. Una transferencia no está en el cajón, así que el corte de efectivo no la cuenta, pero sí importa saber si **llegó**. Preguntas: ¿cómo lo comprueban hoy (aplicación del banco, estado de cuenta)? ¿Quieren que el administrador marque las transferencias como "confirmadas"? Mientras tanto se guarda la referencia opcional [RF-M4-02].

### 4.4 Sobrantes y faltantes *(PD-33)*
Se calculan siempre [RF-M4-06]. Falta saber si hay una **tolerancia** y si, arriba de ella, el cajero debe escribir una explicación. El sistema solo registra: no descuenta ni sanciona.

### 4.5 Reglas de pago que se derivan de lo existente
Son consecuencias directas de las reglas actuales; las anoto para que queden explícitas y se prueben:
- Un pago nunca supera el saldo pendiente; en efectivo, la diferencia es **cambio** [RF-M4-02].
- El saldo nunca es negativo y se calcula sumando pagos (nunca se guarda a mano).
- Una venta de mostrador se paga **completa** en el momento; el anticipo es solo para órdenes [RN-08].
- Un pago mixto son varias formas de pago sobre el mismo documento [RN-10].

### 4.6 Impresión
- **La venta no depende de la impresora.** Si falla (sin papel, desconectada), el cobro se guarda y el ticket se reimprime después.
- **Reimpresión marcada "COPIA"**, con rastro de quién y cuándo (PP-14). Evita tickets duplicados que parezcan originales.
- El modelo de la impresora sigue pendiente [PD-15] y la prueba en tablet es de la semana 1 [ADR-0008].

### 4.7 Dos bases de "día"
La pantalla de ventas usa los **pagos por hora de cobro** [RN-20]; el corte usa el **turno**. Si un turno cruza la medianoche, ambos pueden dar totales distintos. Es raro, pero conviene saber el horario de cierre de ZAMMIR (PD-25) para documentarlo.

---

## 5. Usuarios y acceso

La demo permite elegir "cajero actual" sin autenticarse. Lo que pide Juanito (que cada cajero tenga su sesión) **ya está diseñado** [ADR-0013]:
- Cada empleado entra con su **nombre y PIN** sobre la tablet registrada.
- **Los cajeros no se registran solos.** Un administrador los da de alta, les asigna el PIN y los puede desactivar [RF-M8-01]. Si cualquiera pudiera darse de alta, el reporte "quién cobró qué" y el control de caja perderían sentido.
- El cambio de usuario es de un toque y hay bloqueo por inactividad [RF-M4-08].

---

## 6. Reportes: cómo deben leerse

### 6.1 Comparar periodos equivalentes *(PP-13)*
La demo compara "hoy contra ayer". Si son las 11 de la mañana, hoy siempre pierde contra el día completo de ayer. Propongo comparar **el mismo tramo**:

| Periodo en curso | Se compara contra |
|---|---|
| Hoy hasta ahora | Ayer hasta la misma hora |
| Esta semana (lunes a hoy) | La semana pasada (lunes al mismo día) |
| Este mes (día 1 a hoy) | El mes pasado (día 1 al mismo día) |

Si el periodo anterior es cero, no se muestra un porcentaje sino "sin base de comparación". La semana va de lunes a domingo y los días se cuentan en hora de México [RN-17].

### 6.2 "Ventas" son pesos recibidos, no trabajos vendidos
Con la base por defecto [RN-20], un trabajo grande aparece en ventas **cuando se cobra el anticipo** y de nuevo **cuando se cobra el saldo**, no el día que se contrata. Es una buena medida para flujo de efectivo, pero no dice cuánto se vendió. Propongo mostrar al lado el **valor contratado del periodo** (valor de las órdenes nuevas), para que el dueño vea las dos cosas (PP-17). La base definitiva la decide Luis [PD-08].

### 6.3 Productos más vendidos
En vidrio, contar **piezas** engaña (una pieza puede ser un espejo chico o un cristal enorme). Para productos que se cobran por m², propongo mostrar **metros cuadrados vendidos** además de importe y cantidad (PP-18). Lo de "unidades que quedan" **no corresponde** a este reporte: es existencia, que solo aplica a piezas estándar y solo si P2 está activo.

### 6.4 Cobros por cajero
Se muestran totales por periodo (hoy, semana, mes) [RF-M7-05]. Recomiendo presentarlos como **totales cobrados**, no como un ranking de desempeño: el cajero que cobra más no necesariamente vende más.

### 6.5 Cuentas por cobrar
La demo la llama "riesgo de cobranza" y usa "contrato". En el sistema real: **Cuentas por cobrar**, con **fecha de la orden** y antigüedad por tramos configurables (por ejemplo 0 a 7, 8 a 15, 16 a 30 y más de 30 días; **los valores los define Luis**). Los días se calculan con fechas reales [RF-M6-04].

### 6.6 Nombre de la sección
"Panel de inteligencia" no puede usarse en la interfaz [GLOSARIO]. La sección se llama **Reportes**.

---

## 7. Lo que no recomiendo por ahora

| Idea | Por qué no ahora |
|---|---|
| Inventario de hojas y material (cuántas hojas de templado 9 mm quedan) | Está fuera del alcance [ALCANCE §4] y requiere compras, mermas y costos. Si Luis lo quiere, es otro proyecto (PD-36) |
| Utilidad y costos por producto | Es lo que más le serviría a un dueño, pero ZAMMIR no registra costos. Candidato natural para **después de la entrega** |
| Tarjeta, cobros en línea, WhatsApp oficial, crédito, varias sucursales | Fuera del alcance [ALCANCE §4] |
| Predicciones de ventas | Fuera del alcance; las reglas simples de PP-07 cubren lo útil |
| Estatus adicionales | Se resuelven con marcas (sección 2.2) |

---

## 8. Priorización sugerida de las propuestas

Escala mía (valor para ZAMMIR / esfuerzo de construcción). Es una sugerencia para que Juanito decida.

| ID | Propuesta | Valor | Esfuerzo | Cuándo |
|---|---|---|---|---|
| PP-13 | Comparar periodos equivalentes | Alto | Bajo | Sprint 4 (reportes) |
| PP-10 | Marca "detenida" con motivo | Alto | Bajo | Sprint 3 |
| PP-07 | Lista de Atención (atrasadas, detenidas, tiempo en etapa) | Alto | Bajo a medio | Sprint 4 |
| PP-14 | Reimpresión marcada "COPIA" | Medio | Bajo | Sprint 3 |
| PP-08 | Venta rápida: marca por producto para el mostrador | Alto | Bajo | Sprint 3 |
| PP-11 | Aviso de trabajo listo por WhatsApp | Medio | Bajo | Sprint 3 |
| PP-19 | Seguimiento de cotizaciones y tasa de aceptación | Alto | Medio | Sprint 4 o después |
| PP-09 | Retiros y gastos de caja | Depende de PD-26 | Medio | Sprint 3, si Luis lo confirma |
| PP-17 | Valor contratado junto a lo cobrado | Medio | Bajo | Sprint 4 |
| PP-18 | m² vendidos en productos más vendidos | Medio | Bajo | Sprint 4 |
| PP-12 | Reposiciones con causa | Medio a alto | Medio | Después de la entrega, si no hay holgura |
| PP-16 | Fecha estimada sugerida por producto | Medio | Bajo | Depende de PD-30 |
| PP-15 | Convertir solo algunas líneas a orden | Medio | Medio | Después de la entrega |

Las propuestas PP-01 a PP-06 (primera parte) quedan para decidir aparte. **Todo lo que se agregue desplaza algo**: el calendario no tiene holgura.

---

## 9. Cambios que provocaría en los documentos (si se aprueba)

| Documento | Cambio |
|---|---|
| `REGLAS_DE_NEGOCIO.md` | Nuevas reglas: significado y requisitos de los estatus; pago ≤ saldo; ajuste por medición final; período equivalente en comparativos; la venta no depende de la impresión |
| `REQUERIMIENTOS.md` | RF-M3-02 (definiciones, retroceso, marca detenida), RF-M3-01 (forma de entrega), RF-M4-06 (turno y relevo, retiros), RF-M7-01 (periodos equivalentes), RF-M7-02 (m²), RF-M2-08 (líneas elegidas) |
| `GLOSARIO.md` | Turno de caja, reposición, detenida, atrasada, forma de entrega |
| `MODELO_DE_DATOS.md` | Marca y motivo de detenida; forma de entrega y fecha programada; retiros de caja; reposición ligada a la orden |
| `SINCRONIZACION.md` | Retroceso de estatus y reposiciones como operaciones |

Estos cambios **no se hacen** hasta que Juanito apruebe cada propuesta y Luis responda las preguntas que la afectan.

---

## 10. Guion de preguntas para Luis

Para una sola reunión, en este orden (las primeras bloquean más):

1. **Caja (PD-25):** ¿cuántas personas cobran en un día normal y cada cuánto se relevan? ¿Cuentan el efectivo al cambiar de persona o una sola vez al cierre? ¿A qué hora cierran?
2. **Salidas de efectivo (PD-26):** ¿sacan dinero del cajón para pagar algo, depositar o retirar? ¿Cómo lo anotan hoy?
3. **Anticipo (PD-28):** ¿alguna vez empiezan a fabricar sin anticipo? ¿Quién lo autoriza?
4. **Medidas (PD-27):** cuando miden en obra y la medida cambia, ¿cómo ajustan el precio? ¿Le avisan al cliente antes? ¿A partir de qué diferencia?
5. **Roturas (PD-29):** cuando se rompe o se mide mal, ¿quién lo paga, según el caso? ¿Quieren llevar la cuenta de cuántas veces pasa?
6. **Tiempos (PD-30):** ¿cuánto tarda en promedio cada tipo de trabajo (vidrio cortado, templado, cancelería)? ¿Cuándo consideran que un trabajo va "atrasado"?
7. **Medición y flete (PD-31):** ¿cobran la visita? ¿se la abonan al cliente si contrata? ¿cobran distinto fuera de Otumba?
8. **Transferencias (PD-32):** ¿cómo comprueban que llegó el dinero?
9. **Faltantes (PD-33):** ¿cuánta diferencia en caja toleran?
10. **Descuentos (PD-34):** ¿hay un máximo?
11. **Entregas parciales (PD-35):** ¿entregan trabajos por partes?
12. **Material (PD-36):** ¿quieren llevar existencias de hojas de vidrio, o solo de piezas estándar como puertas y ventanas?
13. Las pendientes anteriores que siguen abiertas: reglas de precio (PD-02), garantía (PD-06), base de "ventas" (PD-08) y datos fiscales (PD-04, **urgente**).
