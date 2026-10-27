# Fase 6 — Sprint 2: Cotizador sin conexión

- **Tipo:** código
- **Fechas:** 9 – 15 de noviembre de 2026
- **Lee antes:** [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md), `SINCRONIZACION.md`, `REQUERIMIENTOS.md` M2, RN-03, RN-12, RN-13, RN-15, RN-16

## Objetivo

Resolver el problema número uno del cliente [DC §2]: **una cotización profesional, hecha en la casa del cliente, sin internet, enviada por WhatsApp en minutos.** Y dejar funcionando el motor de sincronización que usarán todos los módulos siguientes.

## Entra si

- Sprint 1 cerrado con su compuerta en verde.
- Catálogo disponible sin conexión.

## Alcance

### 6.1 Motor de sincronización (`shared/infra/sync`)
- Cola de salida en IndexedDB: cada operación con identificador único, tipo, contenido, intentos y estado.
- Envío automático al recuperar la conexión, con reintentos y espera creciente.
- Servidor idempotente: la misma operación enviada dos veces se aplica una sola vez.
- Estado visible para el usuario con palabras del oficio: "Guardado en la tablet" / "Enviado" [GLOSARIO], y el contador de operaciones pendientes en el indicador global [RF-UX-06], [RNF-04].
- Política de conflictos según `SINCRONIZACION.md`.

### 6.2 Folios [RN-15, RN-16]
- Serie temporal por dispositivo (`T1-0001`) asignada en la tablet.
- Folio definitivo `COT-AAAA-0001` asignado en el servidor dentro de la transacción que guarda la cotización, sin huecos ni duplicados.
- Año real en curso, en hora de México.
- Relación permanente entre folio temporal, identificador único y folio definitivo, para reconocer documentos generados sin conexión.

### 6.3 Cotizador — M2
- RF-M2-01 a RF-M2-07, RF-M2-09 y RF-M2-10.
- RF-M2-08 (convertir en orden de trabajo) va en el Sprint 3, cuando existan órdenes.
- RF-M2-11 (aceptación en línea) va en el Sprint 4, detrás del interruptor P1.
- Detalle:
  - Buscar o capturar cliente sin salir del cotizador.
  - Agregar líneas desde el catálogo; en productos a medida, ancho, alto y cantidad con teclado numérico y unidad clara; el cálculo visible en cada línea [RN-04].
  - Cargos adicionales como líneas de servicio.
  - Descuento o cambio de precio solo con autorización de administrador por PIN, con bitácora.
  - Vista previa en vivo: dos paneles en pantalla grande, pestaña en pantalla chica.
  - Guardado automático del borrador.
  - Precio congelado al emitir [RN-03].
  - Vigencia por defecto desde configuración [RN-12]; condiciones por defecto editables por administrador [RN-13].
  - Estados: borrador → enviada → aceptada / rechazada; vencida cuando pasa la vigencia.
  - Duplicar cotización.
  - Historial de cotizaciones por cliente.
  - Aviso contextual cerrable si el catálogo está vacío: "Revisa primero tu catálogo" [RF-UX-05].

### 6.4 Documento PDF [RF-M2-05]
- Puerto `DocumentRenderer` con su adaptador que genera el PDF **en la tablet**.
- Tamaño carta, con: datos de ZAMMIR (de prueba hasta PD-11), folio, fecha, vigencia, cliente, conceptos con medidas, cantidades e importes, subtotal, IVA y total, condiciones, espacio de firma y aviso de privacidad abreviado.
- Si no se ha sincronizado, muestra el folio temporal y el identificador único.

### 6.5 Enviar [RF-M2-06, ADR-0005]
- Puerto `ShareService`: compartir el PDF con el menú de compartir del dispositivo; respaldo con enlace de WhatsApp con mensaje prellenado más descarga del PDF.
- Sin impresión tamaño carta.

## Fuera de esta fase

- Órdenes de trabajo, mostrador y cobros (Sprint 3).
- Portal del cliente final (Sprint 4, P1).

## Diseño

- **S:** casos de uso separados: `CreateQuoteDraft`, `AddQuoteLine`, `ApplyQuoteDiscount`, `IssueQuote`, `MarkQuoteAccepted`, `MarkQuoteRejected`, `DuplicateQuote`, `ShareQuote`.
- **O:** la máquina de estados de cotización es una tabla de transiciones; el vencimiento es una regla derivada del reloj, no un proceso aparte.
- **L:** contrato de `QuoteRepository` (memoria, IndexedDB, Supabase) y de `FolioAllocator` (local y servidor).
- **I:** el PDF recibe un modelo de documento ya calculado; no conoce repositorios ni reglas.
- **D:** el cotizador no sabe si está en línea; habla con puertos y la sincronización ocurre por debajo.

## Entregables

- Cotizador completo en la tablet, funcionando sin conexión.
- Motor de sincronización reutilizable.
- PDF generado en el dispositivo y envío por WhatsApp.

## Pruebas obligatorias

**Cotización (dominio)**
- [ ] Cada transición válida de la máquina de estados y **cada transición inválida** rechazada con error tipado.
- [ ] Vencimiento: un segundo antes y un segundo después del fin del último día de vigencia, en hora de México, corriendo las pruebas en otra zona horaria.
- [ ] Precio congelado: cambiar el precio del catálogo después de emitir no cambia la cotización.
- [ ] Descuento sin autorización rechazado; con autorización aplicado y registrado en bitácora.
- [ ] Total de la cotización = suma de líneas, con desglose de IVA según la tabla de oro.
- [ ] Duplicar crea un borrador nuevo con precios **actuales** del catálogo y sin folio (el comportamiento exacto se confirma en la historia).

**Folios**
- [ ] Formato y año correctos, incluido el cambio de año a medianoche del 31 de diciembre en hora de México.
- [ ] **Concurrencia:** dos dispositivos crean 100 cotizaciones cada uno sin conexión y sincronizan al mismo tiempo: 200 folios definitivos, consecutivos, sin huecos ni duplicados.
- [ ] Una transacción que falla no consume folio.
- [ ] El folio temporal se puede buscar y lleva al documento definitivo.

**Sincronización**
- [ ] Operación guardada sin conexión se envía al reconectar.
- [ ] La misma operación enviada dos veces se aplica una vez.
- [ ] Corte de red a mitad del envío: se reintenta sin duplicar.
- [ ] La cola sobrevive a cerrar y abrir la aplicación.
- [ ] Orden respetado: una línea no llega antes que su cotización.
- [ ] Error permanente del servidor (por ejemplo, validación): la operación se marca y se avisa al usuario; no se reintenta para siempre.
- [ ] Conflictos según la política de `SINCRONIZACION.md`, un caso por regla.

**PDF**
- [ ] Se extrae el texto del PDF generado y se verifica: folio, cliente, cada línea con su medida, subtotal, IVA y total **idénticos al centavo** a los del dominio.
- [ ] Textos con acentos, ñ y nombres largos no se cortan ni se desbordan.
- [ ] Cotización con muchas líneas genera varias páginas correctamente.
- [ ] Con folio temporal, el PDF muestra el folio temporal y el identificador.

**Enviar**
- [ ] El mensaje prellenado de WhatsApp está bien codificado con acentos y ñ.
- [ ] Sin soporte para compartir archivos, se usa el respaldo.

**Pantalla del cotizador**
- [ ] El cálculo visible de cada línea coincide con el importe.
- [ ] Teclado numérico en los campos de medida.
- [ ] Dos paneles en pantalla grande; pestaña en pantalla chica.
- [ ] Borrador recuperado tras cerrar la aplicación sin guardar.

**Extremo a extremo (tamaño de tablet)**
- [ ] Flujo completo **sin conexión**: buscar cliente, agregar vidrio a medida y un servicio, ver vista previa, emitir, generar PDF; reconectar y verificar folio definitivo.
- [ ] Cajero intenta descuento: se le pide PIN de administrador.

**Rendimiento**
- [ ] PDF de una cotización típica en menos de 3 segundos en la tablet objetivo [RNF-25].

**Aceptación (parte de E3)**
- [ ] Modo avión, 3 cotizaciones; al reconectar: cero duplicados, folios correctos y totales exactos.

**Manual en tablet**
- [ ] Cotización completa en modo avión, compartida por WhatsApp a un número de prueba.
- [ ] El PDF se ve profesional en el teléfono de quien lo recibe.

## Compuerta de salida

- [ ] Compuerta común de [00 §5.2] en verde.
- [ ] Prueba de concurrencia de folios en verde **diez veces seguidas** (para descartar fallas intermitentes).
- [ ] Totales del PDF idénticos al dominio en todos los casos de la tabla de oro.
- [ ] Revisión del sprint: demo del cotizador a Luis, si es posible en una tablet. Sus comentarios se registran como historias o pendientes.

## Riesgos y pendientes

- Este sprint es el de mayor carga técnica: si el motor de sincronización se atrasa, se recortan funciones de comodidad (duplicar, historial por cliente) antes que tocar folios o totales.
- PD-02 (reglas reales), PD-06 (garantía, no aplica aún), PD-11 (datos del negocio en el PDF), PD-12 (texto del aviso).
