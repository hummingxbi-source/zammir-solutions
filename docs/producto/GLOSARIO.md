# Glosario del dominio

> El lenguaje común del proyecto. La misma palabra significa lo mismo en la conversación con el cliente, en la interfaz, en el código y en las pruebas.
> La columna "En código" es una **propuesta** que depende de [ADR-0009] (idioma del código). Si el ADR cambia, se actualiza esta tabla.

## Términos del negocio

| Término (interfaz) | Significado | En código |
|---|---|---|
| Anticipo | Pago inicial de un trabajo, por defecto 50%, para iniciar fabricación o apartar material [RN-08] | `deposit` |
| Saldo | Lo que falta por pagar de un trabajo: total − pagos recibidos | `balance` |
| Saldo contra entrega | Condición de pagar el saldo al entregar o instalar | `balanceDueOnDelivery` |
| Cotización | Presupuesto formal con folio, vigencia y condiciones | `Quote` |
| Orden de trabajo (OT) | Trabajo aceptado que se fabrica o instala; tarda días o semanas | `WorkOrder` |
| Venta de mostrador | Venta inmediata, sin orden de trabajo | `CounterSale` |
| Mostrador | Pantalla de venta y caja. **Nunca** se llama "Punto de Venta": el cliente usa esa frase para todo el sistema [DC §2] | `counter` |
| Corte de caja | Cierre del turno de un cajero: esperado, contado y diferencia [DC RF-M4-06] | `CashClosing` |
| Fondo inicial | Efectivo con el que abre la caja un cajero | `openingFloat` |
| Sobrante / faltante | Diferencia positiva o negativa entre efectivo contado y esperado | `cashDifference` |
| Cuentas por cobrar | Lista de trabajos con saldo mayor a cero. No es crédito [RN-09] | `receivables` |
| Garantía | Registro escrito de duración, cobertura y exclusiones de un trabajo entregado [RN-14] | `Warranty` |
| Comprobante de trabajo | PDF con folio, saldo, garantía y QR de autofacturación [DC RF-M3-06] | `WorkReceipt` |
| Ticket | Comprobante térmico de 80 mm de una venta o cobro [DC RF-M4-04] | `Ticket` |
| Medición a domicilio | Visita para tomar medidas en obra; ZAMMIR siempre mide | servicio del catálogo |
| Instalación | Colocación en obra; ZAMMIR instala con su propio personal | servicio del catálogo |
| Obra | Domicilio donde se mide, entrega o instala | `SiteAddress` |
| Folio | Identificador consecutivo de un documento [RN-15] | `folio` |
| Folio temporal | Folio provisional de un dispositivo sin conexión, como `T1-0001` [RN-16] | `tempFolio` |
| Autofacturación | Portal donde el cliente final genera su factura con el código del comprobante | `selfInvoicing` |
| Cliente recurrente | Cliente con dos o más trabajos entregados [DC RF-M5-03] | `isRecurring` |

## Productos

| Término | Significado | En código |
|---|---|---|
| A medida | Producto que se cobra según medidas del cliente [RN-01] | `CUSTOM` |
| Pieza estándar | Producto de medida fija, se cobra por pieza | `STANDARD` |
| Servicio | Instalación, medición u otro trabajo, se cobra por visita o unidad | `SERVICE` |
| Unidad de cobro | m², metro lineal, pieza o servicio | `ChargeUnit` |
| Regla de precio | Fórmula y parámetros con que se calcula el importe de un producto [RN-02] | `PricingRule` |
| Cancelería | Estructuras de aluminio para puertas, ventanas y canceles | categoría |
| Termopanel | Cristal doble con cámara de aire | categoría |
| Templado | Vidrio tratado térmicamente, más resistente | categoría |
| Flotado | Vidrio claro común | categoría |
| Herrajes | Bisagras, jaladores, chapas | categoría |

## Personas y accesos

| Término | Significado | En código |
|---|---|---|
| Administrador | Dueño (Luis) o socio (Ricardo), mismos permisos [DC §4] | `ADMIN` |
| Cajero / vendedor | Empleado que cobra, cotiza y avanza trabajos | `STAFF` |
| Cliente final | Cliente de ZAMMIR; no tiene cuenta, solo enlaces con código | `Customer` |
| Dispositivo del mostrador | Tablet registrada por un administrador donde se entra con PIN | `RegisteredDevice` |
| PIN | Clave personal de 4 a 6 dígitos de cada empleado, guardada con hash | `pin` |

## Facturación (México)

| Término | Significado |
|---|---|
| CFDI | Comprobante Fiscal Digital por Internet: la factura electrónica del SAT |
| PAC | Proveedor Autorizado de Certificación: timbra los CFDI ante el SAT |
| Timbrar | Certificar un CFDI con el PAC para que tenga validez fiscal |
| CSD | Certificado de Sello Digital del emisor, necesario para firmar facturas |
| e.firma | Firma electrónica del contribuyente; con ella se tramita el CSD |
| RFC, régimen fiscal, uso de CFDI | Datos fiscales del emisor y del receptor |

## Palabras prohibidas en la interfaz

La interfaz usa el vocabulario del oficio, nunca jerga de software ni de comercio electrónico [DC §0 regla 6].

| No usar | Usar |
|---|---|
| Checkout | Cobrar |
| Carrito | Ticket actual / conceptos |
| Punto de Venta, POS | Mostrador |
| Inteligencia de negocio, BI, dashboard predictivo | Reportes |
| Sincronizar, offline (al usuario) | "Guardado en la tablet" / "Enviado" |
| Login | Entrar |
