# Pendientes y propuestas

> Todo lo que aún no está definido. **Nada de esta lista se inventa en el código**: se construye configurable o se espera la respuesta [DC §0 regla 1].
> Al resolverse un pendiente: se marca como resuelto, se actualiza el documento afectado y, si es una decisión, se registra su ADR.
>
> **Bloquea** = sí, si no se puede avanzar la parte afectada sin la respuesta.
> Última revisión: 27 de octubre de 2026.

## Abiertos

| ID | Pendiente | Responsable | Bloquea | Cuándo se necesita | Mientras tanto |
|---|---|---|---|---|---|
| PD-01 | Resto del documento de construcción: §7 Facturación y PAC, §8 Impresión, §12 Demo, §15 Pendientes y detalle de M10 | Juanito | Sí, para M10 y la prueba de impresión | 27 oct 2026 | Se trabaja con lo disponible |
| PD-02 | Reglas de precio por producto: área mínima, redondeo de medidas, cargos extra, mínimos [RN-02] | Luis | No | Antes de cargar el catálogo real | Regla básica sin mínimos [ADR-0006] |
| PD-03 | Catálogo real, 50 a 150 productos [DC RF-M1-05] | Luis | No | Etapa final | Catálogo de prueba inventado |
| PD-04 | Datos fiscales de ZAMMIR: RFC, régimen, e.firma vigente y CSD | Luis | Solo para facturar en producción | **Pedir ya**: el trámite del CSD puede tardar | Sandbox del PAC con datos de prueba [ADR-0007] |
| PD-05 | Elegir PAC | Juanito | Solo para facturar en producción | Antes de la última semana | Adaptador simulado [ADR-0007] |
| PD-06 | Garantía: duración, cobertura y exclusiones [RN-14] | Luis | No | Antes de pruebas con el cliente | Campos configurables; la demo usó 6 meses de relleno |
| PD-07 | Qué pasa con el anticipo si se cancela una orden [DC RF-M3-08] | Contrato | No | Antes de construir la cancelación | Se registra el motivo y el monto, sin regla automática |
| PD-08 | Confirmar base de "ventas" en reportes [RN-20] | Luis | No | Antes de pruebas con el cliente | Base de efectivo recibido |
| PD-09 | Plazo para autofacturar que aparece como leyenda en tickets y comprobantes [DC RF-M4-04] | Luis / contador | No | Antes de pruebas con el cliente | Texto configurable |
| PD-10 | Dominio del sistema | Juanito / Luis | No | Última semana | Dominio de prueba de Vercel |
| PD-11 | Logo, teléfono, dirección y datos de contacto de ZAMMIR para documentos | Luis | No | Antes de pruebas con el cliente | Datos de prueba |
| PD-12 | Texto final del aviso de privacidad y términos [DC RF-M9-01] | ZAMMIR con su asesor | No | Antes de producción | Borrador base de HummingX |
| PD-13 | Activar o no P1 (portal de seguimiento) | Luis | No | Antes de pruebas con el cliente | Apagado por interruptor |
| PD-14 | Activar o no P2 (existencias de piezas estándar) | Luis | No | Antes de pruebas con el cliente | Apagado por interruptor |
| PD-15 | Modelo de impresora térmica de 80 mm | Juanito | Sí, para la prueba de impresión | Semana 1 [ADR-0008] | — |
| PD-16 | Modelo de tablet (Wi-Fi o con datos móviles) | Juanito | No | Antes de comprar | — |
| PD-17 | Confirmar que Luis y Ricardo tienen exactamente los mismos permisos [DC §4] | Luis | No | Antes de construir permisos | Mismos permisos, configurable |
| PD-19 | Pasar a privado el repositorio de la demo (`HummingX-BI/formularios`), que hoy es público y contiene datos del cliente | Juanito | No | **Urgente** | — |
| PD-20 | Costo mensual de hosting en producción, para el contrato [ADR-0003] | Juanito | No | Antes de firmar | — |
| PD-21 | Cierre de sesión de administradores por inactividad: ¿cuánto tiempo? [DC §4 dice "prolongada"] | Juanito / Luis | No | Antes de Sprint 0 | Valor configurable; sin valor fijo en el código |
| PD-22 | Política de intentos fallidos de PIN: cuántos y cuánto dura el bloqueo | Juanito | No | Antes de Sprint 1 | Valores configurables propuestos en ADR-0013 |
| PD-23 | ¿Qué año lleva el folio de un documento creado sin conexión el 31 de dic. y enviado en enero? [RN-15 dice "año real en curso"] | Juanito / Luis | No | Antes de Sprint 2 | Propuesta en SINCRONIZACION.md: año de la fecha de emisión en hora de México |
| PD-24 | Qué efecto tiene cancelar una venta de mostrador en el corte de caja (¿se devuelve efectivo?) [RF-M4-07] | Luis | No | Antes de Sprint 3 | Se registra la cancelación con motivo, sin regla automática sobre la caja |
| PD-25 | Caja compartida: ¿cuántas personas cobran en un día, cada cuánto se relevan, cuentan el efectivo en cada relevo o solo al cierre, y a qué hora cierran? Define la unidad del corte [RF-M4-06, RN-11] | Luis | **Sí, para el corte (Sprint 3)** | Antes de Sprint 3 | El modelo separa turno de caja y cobros por cajero; el corte se construye con turno como unidad |
| PD-26 | Salidas de efectivo del cajón (gastos, depósitos, retiros): ¿existen y cómo se anotan hoy? | Luis | No | Antes de Sprint 3 | No se construyen retiros; el efectivo esperado = fondo + cobros en efectivo |
| PD-27 | Medición final distinta de la cotizada: cómo se ajusta el precio, quién autoriza, a partir de qué diferencia y qué pasa con el anticipo [RN-03 vs RN-13.3] | Luis | No | Antes de Sprint 3 | Sin ajuste automático; el cambio de medidas lo hace un administrador con motivo |
| PD-28 | ¿Se puede iniciar la fabricación sin anticipo? ¿Quién lo autoriza? (regla derivada de RN-08 y RN-13.1) | Luis | No | Antes de Sprint 3 | "En proceso" exige anticipo registrado o autorización de administrador con motivo, configurable |
| PD-29 | Roturas y errores de medida: ¿quién absorbe cada caso y se quiere registrar la causa? | Luis | No | Después de la entrega, salvo que se priorice | No se construye; las reposiciones se manejan como una orden nueva sin cobro |
| PD-30 | Tiempos de entrega por tipo de producto y qué se considera "atrasada" | Luis | No | Antes de Sprint 3 | Fecha estimada capturada a mano; umbrales de atención configurables sin valor fijo |
| PD-31 | Medición a domicilio y flete: ¿se cobra, se abona al trabajo, hay recargo fuera de Otumba? | Luis | No | Antes de pruebas con el cliente | Se cobran como servicios del catálogo, sin abono automático |
| PD-32 | Transferencias: ¿cómo se comprueba que llegó el dinero y se quiere marcarlas como confirmadas? | Luis | No | Antes de Sprint 3 | Se guarda la referencia opcional, sin estado de confirmación |
| PD-33 | Tolerancia de sobrante o faltante en el corte y si exige explicación | Luis | No | Antes de pruebas con el cliente | Solo se registra la diferencia |
| PD-34 | Descuentos: ¿hay un máximo y quién puede darlo? | Luis | No | Antes de Sprint 2 | Cualquier descuento exige PIN de administrador [RF-M2-03] |
| PD-35 | ¿Se entregan trabajos por partes? (estatus por orden o por línea) | Luis | No, pero cambia el modelo | **Antes de Sprint 3** | Estatus por orden |
| PD-36 | ¿Se quiere control de existencias de hojas o material, o solo de piezas estándar (P2)? | Luis | No | Antes de pruebas con el cliente | Fuera de alcance; P2 apagado [PD-14] |

## Resueltos

| ID | Pendiente | Resolución | Fecha |
|---|---|---|---|
| PR-01 | ¿Los precios incluyen IVA? [DC §5.6] | Sí, incluyen IVA [ADR-0004] | 26 oct 2026 |
| PR-02 | ¿Se imprime en tamaño carta? [DC RF-M2-06] | No, fuera del alcance [ADR-0005] | 26 oct 2026 |
| PR-03 | ¿Se reutiliza el código de la demo? | No, se construye desde cero [ADR-0002] | 26 oct 2026 |
| PR-04 | PD-18: idioma de los identificadores en el código | Inglés; interfaz, docs y commits en español [ADR-0009] | 26 oct 2026 |

## Propuestas

Funciones que alguien cree que faltan o sobran. **No se construyen** hasta que Juanito las apruebe [DC §0 regla 5].

| ID | Propuesta | Quién | Estado |
|---|---|---|---|
| PP-01 | Recorrido "Primeros pasos" (5 pasos) para usuarios nuevos, visto en la demo | Juanito | Por aprobar |
| PP-02 | Gráfica de tendencia de ingresos del último mes (~31 días) en el Dashboard; la demo usaba 10 días | Juanito | Por aprobar; definir periodo y base de cálculo [RN-20] |
| PP-03 | Dashboard como pantalla de inicio: ventas y medios de pago, cuentas por cobrar, tendencia y pipeline | Juanito | Por aprobar |
| PP-04 | Campo "descripción" en el producto (RF-M1-01 no lo incluye) | Juanito | Por aprobar |
| PP-05 | SKU generado por el sistema (iniciales del nombre + consecutivo) en lugar de capturado por Luis | Juanito | Por aprobar; definir regla |
| PP-06 | Gráfica de distribución del catálogo por categoría | Juanito | Por aprobar |
| PP-07 | Lista de "Atención": órdenes atrasadas o detenidas, días en la etapa actual y cuentas por cobrar viejas, con umbrales configurables | Claude, a partir de la demo | Por aprobar |
| PP-08 | Marca "venta rápida" por producto para armar el catálogo rápido del mostrador | Claude, a partir de la demo | Por aprobar |
| PP-09 | Registro de retiros y gastos de caja dentro del turno | Claude | Por aprobar; depende de PD-26 |
| PP-10 | Marca "detenida" con motivo en una orden, en lugar de más estatus | Claude | Por aprobar |
| PP-11 | Aviso de "trabajo listo" por WhatsApp (mensaje prellenado) | Claude | Por aprobar |
| PP-12 | Reposición: orden ligada a la original con causa, sin cobro | Claude | Por aprobar; depende de PD-29 |
| PP-13 | Comparar periodos equivalentes en reportes (mismo tramo del periodo anterior) | Claude | Por aprobar; modifica RF-M7-01 |
| PP-14 | Reimpresión de ticket marcada "COPIA", con rastro | Claude | Por aprobar |
| PP-15 | Convertir solo algunas líneas de una cotización en orden | Claude | Por aprobar; modifica RF-M2-08 |
| PP-16 | Fecha estimada de entrega sugerida según el tipo de producto | Claude | Por aprobar; depende de PD-30 |
| PP-17 | Mostrar el valor contratado del periodo junto a lo cobrado | Claude | Por aprobar; ver PD-08 |
| PP-18 | Metros cuadrados vendidos en productos más vendidos | Claude | Por aprobar; modifica RF-M7-02 |
| PP-19 | Seguimiento de cotizaciones por vencer y tasa de aceptación | Claude | Por aprobar |
