# Reglas de negocio

> Reglas transversales que aplican a varios módulos. Cada regla tiene un identificador `RN-XX` para citarla desde código, pruebas e historias de usuario.
> Fuente: [DC §5], salvo que se indique otro origen.
> Las marcadas **[POR DEFINIR]** se construyen **configurables** (ajuste, campo o tabla) y nunca se inventan [DC §0 regla 1]. Su seguimiento está en `PENDIENTES.md`.

## Productos y precio

**RN-01 Tipos de producto.** Cada producto tiene un tipo y una unidad de cobro [DC §5.1]:

| Tipo | Unidad de cobro | Ejemplos |
|---|---|---|
| A medida | m² (ancho × alto × cantidad), metro lineal o pieza, según el producto | Vidrio claro, templado, espejo, termopanel, cancelería a medida |
| Pieza estándar | Pieza | Puerta corrediza de aluminio, ventana fija, mampara |
| Servicio | Visita o unidad | Instalación a domicilio, medición a domicilio |

**RN-02 Regla de precio configurable por producto** [DC §5.1], [ADR-0006].
- Cada producto tiene asignada una regla de precio con parámetros guardados en datos, no en código.
- Parámetros previstos desde el diseño: área mínima cobrable, redondeo de medidas, cargos adicionales (cantos, pulido, perforaciones, instalación) y mínimo por trabajo.
- **Valores [POR DEFINIR]**: el cliente aún no los envía. Mientras tanto, todos los productos usan la regla básica: precio × cantidad en su unidad, sin mínimos ni redondeos.
- Agregar una regla nueva no debe obligar a modificar las existentes.

**RN-03 Precio congelado.** El precio de una cotización u orden se congela al emitirse. Los cambios posteriores del catálogo no la modifican [DC §5.1].

**RN-04 Medidas visibles.** En productos a medida, el sistema muestra el cálculo (ancho × alto × cantidad = m², por precio) junto al importe, con la unidad clara: cm o m [DC RF-M2-02].

## Dinero e impuestos

**RN-05 Moneda y representación.** Pesos mexicanos. Los importes se guardan como enteros en centavos o numéricos de 2 decimales. **Nunca números flotantes** [DC §5.6].

**RN-06 Precios con IVA incluido.** Los precios del catálogo de ZAMMIR **ya incluyen IVA** [ADR-0004]. Esto resuelve el pendiente que dejaba abierto [DC §5.6].
- La tasa es 16% y vive como ajuste global del negocio.
- Un producto se puede marcar como exento.
- El desglose (subtotal e IVA) se calcula a partir del precio con IVA cuando el documento lo requiere: cotización, comprobante y factura.

**RN-07 Redondeo único.** Ticket, PDF y factura deben coincidir al centavo [DC §5.6].
- La política de redondeo se implementa en **un solo módulo** del dominio y se cubre con pruebas automáticas.
- Ningún componente calcula impuestos ni redondea por su cuenta.
- El algoritmo exacto (redondeo por línea o por documento, y cómo cuadrar contra el CFDI) se define en la Fase 2 en un ADR [ADR-0004].

## Anticipo, saldo y pagos

**RN-08 Anticipo obligatorio.** Trabajos a medida y puertas y ventanas siempre piden anticipo. Por defecto 50%, configurable. El saldo se paga contra entrega o instalación [DC §5.2].

**RN-09 Sin crédito.** No existen límites de crédito, intereses ni estados de cuenta. Un saldo pendiente solo existe como remanente de un trabajo en proceso o entregado con adeudo autorizado [DC §5.2].

**RN-10 Formas de pago.** Efectivo y transferencia. Se permite pago mixto en una misma operación. Sin tarjeta [DC §5.2].

**RN-11 Atribución de cobros.** Cada venta y cada pago guardan usuario activo, dispositivo y hora. Los anticipos y saldos de órdenes cuentan en la caja del cajero que los recibió [DC RF-M4-03, RF-M4-05].

## Cotizaciones

**RN-12 Vigencia.** 15 días naturales por defecto, configurable [DC §5.3].

**RN-13 Condiciones por defecto**, editables por un administrador [DC §5.3]:
1. Se requiere el 50% de anticipo para iniciar fabricación o apartar material.
2. El saldo se liquida contra entrega o instalación.
3. El tiempo de entrega está sujeto a disponibilidad de material y a la medición física final en obra.

## Garantía

**RN-14 Garantía escrita.** La garantía hoy es verbal; el sistema la vuelve un registro escrito ligado a cada trabajo entregado, con duración, cobertura y exclusiones, impresa en el comprobante [DC §5.4].
- **Duración [POR DEFINIR].** La demo usó 6 meses como relleno: **no es un dato real**.

## Folios

**RN-15 Formato** [DC §5.5]:

| Documento | Formato |
|---|---|
| Cotización | `COT-AAAA-0001` |
| Orden de trabajo | `OT-AAAA-0001` |
| Venta de mostrador | `V-AAAA-0001` |
| Factura emitida por el sistema | `F-AAAA-0001` |

`AAAA` es el año real en curso. La demo usó 2024 por error.

**RN-16 Folios sin conexión** [DC §5.5].
- Cada dispositivo usa su propia serie temporal (por ejemplo, `T1-0001`).
- El servidor asigna el folio definitivo al sincronizar, **sin huecos ni duplicados**.
- Un comprobante impreso sin conexión lleva el folio temporal y un identificador único que el servidor reconoce después.

## Fechas

**RN-17 Zona horaria.** Se guarda en UTC y se muestra en `America/Mexico_City`. Día, semana, mes y cortes de caja se calculan en hora de México. La semana va de lunes a domingo [DC §5.7].

## Auditoría

**RN-18 Nada contable se borra.** Ventas, órdenes, pagos y facturas solo se cancelan, con motivo y rastro [DC §5.8]. Catálogo y usuarios se desactivan, no se borran [DC RF-M1-04, RF-M8-01].

**RN-19 Bitácora de acciones sensibles.** Cambio de precio, descuento, cancelación, reapertura de corte y cambio de usuario o de permisos guardan usuario, fecha, valor anterior y valor nuevo [DC §5.8].

## Reportes

**RN-20 Base de "ventas".** Por defecto, "ventas" = ventas de mostrador + pagos recibidos de órdenes de trabajo en el periodo (base de efectivo recibido) [DC §6 M7]. **[POR DEFINIR con Luis]**: se construye así y la base queda documentada en la pantalla.
