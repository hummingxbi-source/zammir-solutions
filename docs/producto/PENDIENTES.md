# Pendientes y propuestas

> Todo lo que aún no está definido. **Nada de esta lista se inventa en el código**: se construye configurable o se espera la respuesta [DC §0 regla 1].
> Al resolverse un pendiente: se marca como resuelto, se actualiza el documento afectado y, si es una decisión, se registra su ADR.
>
> **Bloquea** = sí, si no se puede avanzar la parte afectada sin la respuesta.
> Última revisión: 27 de octubre de 2026, contra la §15 del documento completo. La columna "§15" indica a qué punto de esa lista corresponde cada pendiente.

## Abiertos

| ID | Pendiente | Responsable | Bloquea | Cuándo se necesita | Mientras tanto |
|---|---|---|---|---|---|
| PD-02 | Reglas de precio por producto: área mínima, redondeo de medidas, cargos extra, mínimos [RN-02] (§15 punto 8) | Luis | No | Antes de cargar el catálogo real | Regla básica sin mínimos [ADR-0006] |
| PD-03 | Catálogo real, 50 a 150 productos [DC RF-M1-05] | Luis | No | Etapa final | Catálogo de prueba inventado |
| PD-04 | Datos fiscales de ZAMMIR: RFC activo, régimen, e.firma vigente y CSD (`.cer`, `.key` y contraseña). El CSD lo tramita ZAMMIR en el SAT, es gratuito y se hace con la e.firma [DC §7.2] (§15 punto 1) | Luis | Solo para facturar en producción | **Pedir ya**: el trámite del CSD puede tardar | Entorno de pruebas del PAC [ADR-0007] |
| PD-05 | Elegir PAC y quién lo contrata (HummingX o ZAMMIR). HummingX prefiere contratarlo e incluirlo en la anualidad; eso exige que el PAC admita varios emisores y que HummingX pueda contratar con su situación fiscal actual. Criterios en [RF-M10-03] [DC §7.3] (§15 punto 2) | Juanito | Solo para facturar en producción | Antes del Sprint 4 (el documento pedía evaluarlo en la semana 1; ver [ADR-0017]) | Adaptador simulado [ADR-0007] |
| PD-06 | Garantía: duración, texto, cobertura y exclusiones; configurable por producto y por orden [RN-14] (§15 punto 5) | Luis | No | Antes de pruebas con el cliente | Campos configurables; la demo usó 6 meses de relleno |
| PD-07 | Qué pasa con el anticipo si se cancela una orden [DC RF-M3-08] (§15 punto 12) | Contrato | No | Antes de construir la cancelación | Se registra el motivo y el monto, sin regla automática |
| PD-08 | Confirmar base de "ventas" en reportes [RN-20] (§15 punto 13) | Luis | No | Antes de pruebas con el cliente | Base de efectivo recibido |
| PD-09 | Confirmar con el contador el plazo de autofacturación: hasta el último día del mes de la compra o de la liquidación [RN-26] [DC §7.6] (§15 punto 16) | Contador de ZAMMIR | No | Antes de pruebas con el cliente | Regla de fin de mes, en un solo lugar de configuración; leyenda configurable |
| PD-10 | Dominio de ZAMMIR, con DNS en Cloudflare. **No puede cambiar después de imprimir el primer ticket real**, porque los QR apuntan a él [RNF-37] (§15 punto 10) | Juanito / Luis | Sí, para salir a producción | Antes de imprimir el primer ticket real | Dominio de prueba de Vercel, solo en pruebas |
| PD-11 | Nombres reales, roles y datos del negocio: domicilio, teléfono, logo y colores de ZAMMIR para documentos (§15 punto 15) | Luis | No | Antes de pruebas con el cliente | Datos de prueba |
| PD-12 | Texto final del aviso de privacidad y términos, que declare a los proveedores técnicos [RNF-17] [DC RF-M9-01] (§15 punto 11) | ZAMMIR con su asesor | No | Antes de producción | Borrador base de HummingX |
| PD-13 | Activar o no P1 (portal de seguimiento). Se pregunta al cliente en el cuestionario de acuerdos **y Juanito debe aprobar el diseño del portal**, que el de la demo no tiene [DC §3.2] (§15 punto 6) | Luis y Juanito | No | Antes de pruebas con el cliente | Apagado por interruptor; fuera de la entrega salvo que se active [ADR-0019] |
| PD-14 | Activar o no P2 (existencias de piezas estándar) (§15 punto 7) | Luis | No | Antes de pruebas con el cliente | Apagado por interruptor; fuera de la entrega salvo que se active [ADR-0019] |
| PD-17 | Confirmar que Luis y Ricardo tienen exactamente los mismos permisos [DC §4] | Luis | No | Antes de construir permisos | Mismos permisos, configurable |
| PD-19 | Pasar a privado el repositorio de la demo (`HummingX-BI/formularios`), que hoy es público y contiene datos del cliente | Juanito | No | **Urgente** | — |
| PD-20 | Costo mensual de hosting en producción, para el contrato [ADR-0003] | Juanito | No | Antes de firmar | — |
| PD-22 | Política de intentos fallidos de PIN: cuántos y cuánto dura el bloqueo | Juanito | No | Antes de Sprint 1 | Valores configurables propuestos en ADR-0013 |
| PD-23 | ¿Qué año lleva el folio de un documento creado sin conexión el 31 de dic. y enviado en enero? [RN-15 dice "año real en curso"] | Juanito / Luis | No | Antes de Sprint 2 | Propuesta en SINCRONIZACION.md: año de la fecha de emisión en hora de México |
| PD-24 | Qué efecto tiene cancelar una venta de mostrador en el corte de caja (¿se devuelve efectivo?) [RF-M4-07] | Luis | No | Antes de Sprint 3 | Se registra la cancelación con motivo, sin regla automática sobre la caja |
| PD-25 | Cómo se mide el "metro lineal" de un producto: largo capturado o perímetro [RN-01] | Luis | No | Antes de cargar el catálogo real | Configurable por regla de precio |
| PD-26 | Límite anual de timbres del paquete incluido en la anualidad [DC §7.9] (§15 punto 2) | Juanito | No | Antes del Sprint 4 | Límite configurable; aviso al 80% [RF-M10-20] |
| PD-27 | Tratamiento fiscal de anticipos: un CFDI al liquidar (a) o CFDI de anticipo más CFDI final relacionado (b) [RN-27] [DC §7.7] (§15 punto 4) | Contador de ZAMMIR | No | Antes del Sprint 4 | Opción (a) |
| PD-28 | Forma de pago en el CFDI cuando el pago fue mixto (efectivo y transferencia) [RN-28] [DC §7.5] | Contador de ZAMMIR | No | Antes del Sprint 4 | Configurable; sin regla supuesta |
| PD-29 | Validar las claves SAT de producto o servicio, de unidad y el objeto de impuesto del catálogo [RN-28] [DC §7.4] | Contador o PAC | No | Antes de cargar el catálogo real | Valores de prueba por categoría |
| PD-30 | Leyenda "Powered by HummingX BI" en el pie de la aplicación [RN-21] [DC §12.3] (§15 punto 14) | Luis | No | Antes de producción | Apagada por configuración |
| PD-31 | Contenido del panel de inicio por rol [RF-UX-01]. La demo mostraba saludo, ventas del día por método, cuentas por cobrar, tendencia de 10 días y pipeline de producción [DC §12.1], pero el documento no lo define como requerimiento. **[Juanito, 2026-10-27]**: la demo mostraba cuatro bloques (ventas del día y medios de pago, cuentas por cobrar, tendencia de ingresos y pipeline de producción) y prefiere que la tendencia sea del **último mes (~31 días)** y no de 10; falta definir si son 30 días corridos o mes calendario y la base de cálculo [RN-20]. Ver `docs/producto/DEMO_REFERENCIA.md` §3 | Juanito | No | Antes del Sprint 4 | Panel con accesos a las secciones, sin cifras |
| PD-32 | Retención de respaldos de 30 días: verificar la del plan de Supabase y, si es menor, exportación nocturna externa [RNF-21] (§15 punto 17) | Juanito | No | Antes del Sprint 5 | — |
| PD-33 | Umbral de antigüedad de cuentas por cobrar [RF-M6-01] (§15 punto 18) | Luis | No | Antes de pruebas con el cliente | 10 días por defecto, configurable |
| PD-35 | Identidad visual de la aplicación (colores y tipografía). El documento pide copiar los tokens de la demo, pero se construye desde cero [ADR-0002], [ADR-0017]. Guía general del documento: fondo cálido claro, tarjetas blancas, acento azul marino, títulos en serifa y etiquetas pequeñas en monoespaciada [DC §12.1] | Juanito | No | Antes del Sprint 0 (sistema de diseño base) | Guía general del documento |
| PD-36 | Caja compartida: ¿cuántas personas cobran en un día, cada cuánto se relevan, cuentan el efectivo en cada relevo o solo al cierre, y a qué hora cierran? Define la unidad del corte [RF-M4-06, RN-11]. Considerar también que una tablet va a domicilio y los empleados instalan [ALCANCE]: el efectivo cobrado en campo no pasa por el cajón del mostrador, ¿cómo se integra al corte? | Luis | **Sí, para el corte (Sprint 3)** | Antes de Sprint 3 | El modelo separa turno de caja y cobros por cajero; el corte se construye con turno como unidad |
| PD-37 | Salidas de efectivo del cajón (gastos, depósitos, retiros): ¿existen y cómo se anotan hoy? | Luis | No | Antes de Sprint 3 | No se construyen retiros; el efectivo esperado = fondo + cobros en efectivo |
| PD-38 | Medición final distinta de la cotizada: cómo se ajusta el precio, quién autoriza, a partir de qué diferencia y qué pasa con el anticipo [RN-03 vs RN-13.3] | Luis | No | Antes de Sprint 3 | Sin ajuste automático; el cambio de medidas lo hace un administrador con motivo |
| PD-39 | ¿Se puede iniciar la fabricación sin anticipo? ¿Quién lo autoriza? (regla derivada de RN-08 y RN-13.1) | Luis | No | Antes de Sprint 3 | "En proceso" exige anticipo registrado o autorización de administrador con motivo, configurable |
| PD-40 | Roturas y errores de medida: ¿quién absorbe cada caso y se quiere registrar la causa? | Luis | No | Después de la entrega, salvo que se priorice | No se construye; las reposiciones se manejan como una orden nueva sin cobro |
| PD-41 | Tiempos de entrega por tipo de producto y qué se considera "atrasada" | Luis | No | Antes de Sprint 3 | Fecha estimada capturada a mano; umbrales de atención configurables sin valor fijo |
| PD-42 | Medición a domicilio y flete: ¿se cobra, se abona al trabajo, hay recargo fuera de Otumba? | Luis | No | Antes de pruebas con el cliente | Se cobran como servicios del catálogo, sin abono automático |
| PD-43 | Transferencias: ¿cómo se comprueba que llegó el dinero y se quiere marcarlas como confirmadas? | Luis | No | Antes de Sprint 3 | Se guarda la referencia opcional, sin estado de confirmación |
| PD-44 | Tolerancia de sobrante o faltante en el corte y si exige explicación | Luis | No | Antes de pruebas con el cliente | Solo se registra la diferencia |
| PD-45 | Descuentos: ¿hay un máximo y quién puede darlo? | Luis | No | Antes de Sprint 2 | Cualquier descuento exige PIN de administrador [RF-M2-03] |
| PD-46 | ¿Se entregan trabajos por partes? (estatus por orden o por línea) | Luis | No, pero cambia el modelo | **Antes de Sprint 3** | Estatus por orden |
| PD-47 | ¿Se quiere control de existencias de hojas o material, o solo de piezas estándar (P2)? | Luis | No | Antes de pruebas con el cliente | Fuera de alcance; P2 apagado. Relacionado con PD-14 (piezas estándar) |
| PD-49 | Categorías del catálogo: validar con Luis la propuesta de `docs/producto/CATEGORIAS_CATALOGO.md` (laminado, plásticos, canceles y mamparas, herrajes juntos o separados, cargos de canto y perforación) | Luis | No | Antes de S1-05 con datos reales | Las 11 categorías de RF-M1-02 más las propuestas, editables desde el catálogo |

## Resueltos

| ID | Pendiente | Resolución | Fecha |
|---|---|---|---|
| PR-01 | ¿Los precios incluyen IVA? [DC §5.6] | Sí, incluyen IVA [ADR-0004] | 26 oct 2026 |
| PR-02 | ¿Se imprime en tamaño carta? [DC RF-M2-06] | No, fuera del alcance [ADR-0005] | 26 oct 2026 |
| PR-03 | ¿Se reutiliza el código de la demo? | No, se construye desde cero [ADR-0002] | 26 oct 2026 |
| PR-04 | PD-18: idioma de los identificadores en el código | Inglés; interfaz, docs y commits en español [ADR-0009] | 26 oct 2026 |
| PR-05 | PD-01: resto del documento de construcción (§7 a §17) | Recibido y guardado en `docs/contexto/`; integrado en los documentos de producto y el plan [ADR-0017] | 27 oct 2026 |
| PR-06 | ¿ZAMMIR ya tiene impresora tamaño carta? (§15 punto 9) | No aplica: la impresión carta queda fuera [ADR-0005] | 27 oct 2026 |
| PR-07 | ¿Los precios incluyen IVA? (§15 punto 3) | Ya resuelto en PR-01 | 27 oct 2026 |
| PR-08 | PD-34: calendario del proyecto | Se mantiene el plan actual de sprints, con recortes desde ahora (P1, P2 y recorrido guiado fuera de la entrega salvo activación) [ADR-0019] | 27 oct 2026 |
| PR-09 | PD-21: cierre de sesión de administradores por inactividad | **30 minutos**, propuesto por el desarrollador a petición de Juanito; configurable (`admin_idle_logout_minutes`). Por confirmar con Luis | 29 oct 2026 |
| PR-10 | PD-48: vigencia del código de registro de una tablet | **15 minutos**, sugerido al generar el código y editable (`device_code_validity_minutes`). Por confirmar con Luis | 29 oct 2026 |
| PR-11 | PD-15: modelo de impresora térmica de 80 mm | **Epson TM-m30III-052** (tickets de 80 mm, 203 dpi, autocorte). La ficha de la tienda se contradice (anuncia Wi-Fi + Bluetooth pero su tabla dice "Bluetooth: No" y "Wifi: No"): **confirmar con Epson o el vendedor qué interfaces trae esa variante antes de comprar** y probarla en S0-18 | 29 oct 2026 |
| PR-12 | PD-16: modelo de tablet | **Samsung Galaxy Tab A9+ 5G (SM-X236B)**: 11", 1920×1200, 6 GB de RAM, 128 GB, Android, con datos móviles (nano-SIM). Es la tablet de referencia para las pruebas manuales y de impresión | 29 oct 2026 |

## Propuestas

Funciones que alguien cree que faltan o sobran. **No se construyen** hasta que Juanito las apruebe [DC §0 regla 5].

| ID | Propuesta | Quién | Estado |
|---|---|---|---|
| PP-01 | Recorrido "Primeros pasos" (5 pasos) para usuarios nuevos, visto en la demo [Juanito, 2026-10-27] | Juanito | **Incorporada** en RF-UX-02 a RF-UX-05 |
| PP-02 | Gráfica de tendencia de ingresos del último mes (~31 días) en el panel de inicio; la demo usaba 10 días [Juanito, 2026-10-27] | Juanito | **Incorporada** en PD-31 (contenido del panel de inicio) |
| PP-03 | Panel de inicio con ventas y medios de pago, cuentas por cobrar, tendencia y pipeline, como se vio en la demo [Juanito, 2026-10-27] | Juanito | **Incorporada** en RF-UX-01 y PD-31 |
| PP-04 | Campo "descripción" en el producto (RF-M1-01 no lo incluye) [Juanito, 2026-10-27] | Juanito | Por aprobar |
| PP-05 | Código del producto generado por el sistema (iniciales del nombre + consecutivo) en lugar de capturado por Luis [Juanito, 2026-10-27]. RF-M1-01 ya dice "autogenerable"; falta la regla | Juanito | Por aprobar; definir regla |
| PP-06 | Gráfica de distribución del catálogo por categoría [Juanito, 2026-10-27] | Juanito | Por aprobar |
| PP-07 | Lista de "Atención": órdenes atrasadas o detenidas, días en la etapa actual y cuentas por cobrar viejas, con umbrales configurables | Claude, a partir de la demo | Por aprobar |
| PP-08 | Marca "venta rápida" por producto para armar el catálogo rápido del mostrador | Claude, a partir de la demo | Por aprobar |
| PP-09 | Registro de retiros y gastos de caja dentro del turno | Claude | Por aprobar; depende de PD-37 |
| PP-10 | Marca "detenida" con motivo en una orden, en lugar de más estatus | Claude | Por aprobar |
| PP-11 | Aviso de "trabajo listo" por WhatsApp (mensaje prellenado) | Claude | Por aprobar |
| PP-12 | Reposición: orden ligada a la original con causa, sin cobro | Claude | Por aprobar; depende de PD-40 |
| PP-13 | Atribuir en la base de datos las acciones de la tablet a la persona que entró con PIN. Hoy la base solo ve la sesión de la tablet (`auth.uid()`), no a la persona; la bitácora de esas acciones queda a nombre de la tablet. Diseño por decidir (por ejemplo, que cada alta o cambio mande el identificador de la persona activa y la base lo valide contra las personas activas). Hace falta antes de S3 (cobros) para que E4 cubra la atribución completa [E4] | Claude, al construir S1-20 | **Por decidir; bloquea la parte de atribución de E4** |
| PP-13 | Comparar periodos equivalentes en reportes (mismo tramo del periodo anterior) | Claude | Por aprobar; modifica RF-M7-01 |
| PP-14 | Reimpresión de ticket marcada "COPIA", con rastro | Claude | Por aprobar |
| PP-15 | Convertir solo algunas líneas de una cotización en orden | Claude | Por aprobar; modifica RF-M2-08 |
| PP-16 | Fecha estimada de entrega sugerida según el tipo de producto | Claude | Por aprobar; depende de PD-41 |
| PP-17 | Mostrar el valor contratado del periodo junto a lo cobrado | Claude | Por aprobar; ver PD-08 |
| PP-18 | Metros cuadrados vendidos en productos más vendidos | Claude | Por aprobar; modifica RF-M7-02 |
| PP-19 | Seguimiento de cotizaciones por vencer y tasa de aceptación | Claude | Por aprobar |
| PP-20 | Bajar a la tablet las cotizaciones propias desde el servidor por número de cambio (reinstalar una tablet, ver lo que hizo otra). Hoy lo emitido ya está en la base local de cada tablet; falta la vista `quotes_for_device` y la descarga. Ver [ADR-0024] | Claude, al cerrar el Sprint 2 | Por aprobar; depende de 19.3 y 19.5 |
| PP-21 | Que el aviso de privacidad vigente viaje en la configuración que baja la tablet, para anotar su versión en el cliente que se da de alta sin internet (hoy queda sin versión) [RF-M9-03] | Claude, al cerrar el Sprint 2 | Por aprobar |
| PP-23 | Capturar una orden de trabajo manual desde la pantalla (sin cotización previa). El caso de uso `createManualWorkOrder` existe y está probado; falta la pantalla de captura de conceptos [RF-M3-01] | Claude, al construir S3-01 | Por aprobar |
| PP-22 | Pantalla de "por revisar" para administradores: operaciones que el servidor aplicó pero dejó con motivo (descuento sin autorización, persona desactivada, cliente anonimizado, transición inválida). El servidor ya las guarda; falta la lista | Claude, al cerrar el Sprint 2 | Por aprobar; queda para el Sprint 8 (bitácora) o antes si Juanito lo pide |
| PP-24 | Imprimir el comprobante de una orden (anticipo o saldo) desde la pantalla de Órdenes. La plantilla `orderPaymentTicket` existe y está probada; falta el botón en el detalle de la orden | Claude, al cerrar el Sprint 3 | Por aprobar |
| PP-25 | Imprimir el corte del día de los administradores (hoy se imprime el corte de un turno) | Claude, al cerrar el Sprint 3 | Por aprobar |
| PP-26 | Lista de clientes recurrentes como vista propia en Clientes (hoy se ve en la ficha de cada cliente). El cálculo `recurringCustomerIds` existe | Claude, al cerrar el Sprint 3 | Por aprobar |
| PP-27 | Elegir ancho de papel y parámetros de la impresora Bluetooth desde Configuración (hoy son constantes en la composición) [PD-15] | Claude, al cerrar el Sprint 3 | Por aprobar; depende de la respuesta a 37.3 |
