# Sprint 2 — Cotizador sin conexión (9 – 15 nov)

> Plan: [`docs/plan/fase-06-sprint-2-cotizador.md`](../plan/fase-06-sprint-2-cotizador.md). Diseño: `docs/arquitectura/SINCRONIZACION.md`. Formato y tallas: [`README.md`](README.md).
> **Objetivo:** que ZAMMIR cotice en casa del cliente sin internet, con PDF en la tablet, envío por WhatsApp y folios sin huecos ni duplicados al sincronizar.
> **Entra si:** Sprint 1 cerrado en verde. Es el sprint de mayor carga técnica: si se atrasa, se recortan comodidades (duplicar, historial) antes que folios o totales.

## Sincronización y folios

### S2-01 · Validación `spike/sync` con dos tablets simuladas · L · 8 h
Como Juanito (desarrollador)
quiero demostrar que la cola propia, la idempotencia y los folios sin huecos funcionan bajo concurrencia y cortes
para cerrar ADR-0012 y ADR-0016 con evidencia.
- **Requerimientos:** RNF-03, RNF-07 · **Reglas:** RN-15, RN-16 · **Decisión:** ADR-0012, ADR-0016 · **Riesgo:** R5. *Rama `spike/sync`, código desechable. Se hace primero.*
- **Criterios de aceptación:**
  - Dadas 200 operaciones desde dos dispositivos al mismo tiempo, cuando se aplican, entonces los folios definitivos son del 1 al 200, sin huecos ni repetidos.
  - Dado un corte de conexión a mitad de una operación, repetido muchas veces, cuando termina, entonces no hay huecos, duplicados ni documentos a medias.
  - Dada cada operación reenviada 2 o 3 veces, cuando se aplican, entonces queda un solo registro por `opId`.
  - Dada una tablet sin conexión por horas, cuando se reconecta, entonces se pone al día en orden y sin pérdida.
  - Dada una operación fuera de orden, cuando llega, entonces se detecta y se corrige con reenvío.
  - Dada la función del servidor, cuando corre `packages/core` con una conexión directa a Postgres y una transacción, entonces funciona; si no, se documenta la alternativa en SQL.

### S2-02 · Cola de salida en la tablet · L · 8 h
Como cajero
quiero que todo lo que capture se guarde primero en la tablet y espere su turno para enviarse
para no perder nada si se va el internet.
- **Requerimientos:** RNF-02, RNF-03 · **Decisión:** ADR-0012, ADR-0016
- **Criterios de aceptación:**
  - Dado un cambio, cuando se guarda, entonces el documento y su operación (con `opId`, `deviceId`, `seq`, tipo, versión y carga) se escriben en una sola transacción local.
  - Dado el puerto `SyncOutbox`, cuando corre la batería de contrato, entonces pasan memoria e IndexedDB la misma.
  - Dada una operación con formato inválido, cuando se intenta encolar, entonces la validación la rechaza antes de guardarla.
  - Dada la aplicación actualizada, cuando hay operaciones viejas en cola, entonces no se borran.

### S2-03 · Receptor de operaciones idempotente · L · 8 h
Como administrador
quiero que el servidor aplique cada operación una sola vez
para que reenviar no duplique cotizaciones ni pagos.
- **Requerimientos:** RNF-03, RNF-11 · **Reglas:** RN-16, RN-18 · **Decisión:** ADR-0016
- **Criterios de aceptación:**
  - Dado un `opId` ya aplicado, cuando llega otra vez, entonces devuelve el mismo resultado guardado y no repite nada.
  - Dado `seq = n+1` sin haber procesado `n`, cuando llega, entonces responde "fuera de orden".
  - Dado un dispositivo revocado, un usuario desactivado o un tipo desconocido, cuando llega la operación, entonces se rechaza de forma estructural o se marca "por revisar" según [ADR-0013].
  - Dado un resultado, cuando se guarda, entonces queda en `operations` con `received_at`.

### S2-04 · Folio definitivo sin huecos ni duplicados · M · 4 h
Como administrador
quiero folios `COT-AAAA-0001` consecutivos asignados por el servidor
para que ZAMMIR tenga una numeración confiable.
- **Reglas:** RN-15, RN-16 · **Decisión:** ADR-0016 · **Pendientes:** PD-23 (año de la fecha de emisión en hora de México)
- **Criterios de aceptación:**
  - Dadas dos transacciones simultáneas, cuando piden folio, entonces se turnan y no obtienen el mismo número.
  - Dada una transacción que falla, cuando se revierte, entonces el contador no avanza (no hay huecos).
  - Dado el cambio de año, cuando se emite el primer documento, entonces el contador de ese año empieza en 1.
  - Dado el contrato de `FolioAllocator`, cuando corre la batería, entonces pasan el local y el del servidor.
  - Dada una cotización cancelada, cuando se revisa, entonces conserva su folio.

### S2-05 · Folio temporal por dispositivo · S · 2 h
Como cajero
quiero que una cotización hecha sin conexión lleve un folio provisional como `T1-0004`
para identificarla mientras no se envía.
- **Reglas:** RN-16 · **Decisión:** ADR-0016
- **Criterios de aceptación:**
  - Dado un dispositivo registrado, cuando emite documentos, entonces su serie `T<n>` avanza sin repetirse.
  - Dado un documento emitido sin conexión, cuando se muestra, entonces dice "Folio provisional T1-0004" y lleva un código público único.
  - Dado un borrador, cuando se revisa, entonces no tiene folio.

### S2-06 · Envío automático, reintentos y estado visible · M · 4 h  · `tablet`
Como cajero
quiero que lo guardado se envíe solo al volver el internet y ver si ya salió
para no preocuparme.
- **Requerimientos:** RNF-04, RF-UX-06 (pendientes) · **Reglas:** `GLOSARIO` ("Guardado en la tablet" y "Enviado") · **Decisión:** ADR-0012
- **Criterios de aceptación:**
  - Dado un documento con operaciones sin enviar, cuando se muestra, entonces dice "Guardado en la tablet"; con todo confirmado, dice "Enviado".
  - Dado el indicador global, cuando hay operaciones pendientes, entonces muestra "N pendientes".
  - Dado un error de red, cuando falla el envío, entonces reintenta con espera creciente y sin límite de intentos.
  - Dado un error estructural, cuando ocurre, entonces la cola de ese dispositivo se detiene y aparece un aviso para llamar a soporte.
  - Dado que no se usan las palabras "sincronizar" ni "offline", cuando corre la prueba de vocabulario, entonces pasa.

### S2-07 · Descarga de documentos propios y reconciliación del folio · M · 4 h
Como cajero
quiero que el folio definitivo aparezca solo en mis documentos
para ver el número real sin hacer nada.
- **Requerimientos:** RNF-04, RNF-06 · **Decisión:** ADR-0016, ADR-0012
- **Criterios de aceptación:**
  - Dada una operación aplicada, cuando la tablet recibe el resultado, entonces actualiza el folio y marca el documento como enviado.
  - Dado un cursor de cambios, cuando se piden los cambios nuevos, entonces llegan por páginas sin duplicar.
  - Dados cambios pendientes locales, cuando llega la versión del servidor, entonces se vuelven a aplicar encima los no enviados.
  - Dado que no se bajan los datos fiscales de todos los clientes, cuando se revisa lo replicado, entonces solo están los necesarios [RNF-06].

### S2-08 · Conflictos entre tablets · M · 4 h
Como administrador
quiero que dos tablets que editan lo mismo no pierdan información
para confiar en los datos.
- **Requerimientos:** RNF-05 · **Reglas:** RN-18, RN-19 · **Decisión:** ADR-0016, `SINCRONIZACION.md` §6
- **Criterios de aceptación:**
  - Dadas dos ediciones del mismo cliente, cuando llegan, entonces gana el último cambio por campo y queda el valor anterior en bitácora.
  - Dados pagos y ventas, cuando llegan, entonces solo se agregan, nunca se pisan.
  - Dada una transición de estado que ya no es válida, cuando llega, entonces se aplica como "por revisar" con motivo visible para un administrador.

## Cotizador

### S2-09 · Cotización: líneas del catálogo y cálculo visible · L · 8 h  · `tablet`
Como cajero
quiero agregar productos del catálogo, capturar ancho, alto y cantidad y ver el cálculo
para dar un presupuesto correcto en minutos.
- **Requerimientos:** RF-M2-02 · **Reglas:** RN-01, RN-02, RN-04, RN-06 · **Pendientes:** PD-02 (regla básica)
- **Criterios de aceptación:**
  - Dado un producto a medida, cuando se capturan medidas y cantidad, entonces el importe sale de su regla de precio y se muestra `ancho × alto × cantidad = m² × precio`.
  - Dado un producto de pieza o servicio, cuando se agrega, entonces se cobra por su unidad.
  - Dados cm o m, cuando se captura, entonces la unidad es clara en pantalla.
  - Dada una línea, cuando se muestra, entonces el desglose de IVA coincide con `TaxCalculator`.
  - Dado el catálogo vacío, cuando se abre el cotizador, entonces el aviso contextual dice "Revisa primero tu catálogo" y se puede cerrar.

### S2-10 · Cotizador: buscar o capturar al cliente sin salir · S · 2 h
Como cajero
quiero buscar o capturar al cliente dentro del cotizador
para no cambiar de pantalla.
- **Requerimientos:** RF-M2-01 · **Reglas:** RN-22
- **Criterios de aceptación:**
  - Dado un cliente existente, cuando se busca, entonces se selecciona con nombre y WhatsApp; el domicilio de la obra es opcional.
  - Dado un cliente nuevo, cuando se captura nombre y WhatsApp, entonces se guarda y se registra el aviso de privacidad informado.

### S2-11 · Cargos adicionales y descuentos con autorización · M · 4 h
Como cajero
quiero agregar instalación, medición o cantos como líneas de servicio, y pedir un descuento autorizado
para cotizar el trabajo completo.
- **Requerimientos:** RF-M2-03 · **Reglas:** RN-19 · **Pendientes:** PD-45 (tope de descuentos: cualquier descuento exige PIN de administrador), PD-42 (medición y flete como servicios del catálogo)
- **Criterios de aceptación:**
  - Dado un cargo adicional, cuando se agrega, entonces es una línea de servicio.
  - Dado un descuento o cambio de precio de una línea, cuando lo pide un cajero, entonces exige PIN de administrador y deja bitácora con valor anterior y nuevo.
  - Dado un administrador, cuando aplica un descuento, entonces también queda registrado.

### S2-12 · Vista previa en vivo · M · 4 h  · `tablet`
Como cajero
quiero ver el documento al mismo tiempo que lo armo
para corregir antes de enviar.
- **Requerimientos:** RF-M2-04
- **Criterios de aceptación:**
  - Dada una pantalla grande, cuando se arma la cotización, entonces hay dos paneles: datos a la izquierda y documento a la derecha, actualizado en vivo.
  - Dada una pantalla chica, cuando se arma, entonces la vista previa es una pestaña.

### S2-13 · Emitir la cotización: precio congelado, vigencia y folio · M · 4 h
Como cajero
quiero emitir la cotización con su folio, vigencia y condiciones
para entregar un documento formal.
- **Requerimientos:** RF-M2-07 · **Reglas:** RN-03, RN-12, RN-13, RN-15
- **Criterios de aceptación:**
  - Dada una cotización emitida, cuando cambia el precio del catálogo, entonces la cotización no cambia.
  - Dada la vigencia por defecto, cuando se emite, entonces `valid_until` se calcula desde la configuración (15 días).
  - Dada la emisión sin conexión, cuando termina, entonces lleva folio provisional; al enviarse, el definitivo.
  - Dada la emisión, cuando se guarda, entonces usa el caso de uso `IssueQuote` y guarda la versión del catálogo usada.

### S2-14 · Estados de la cotización · S · 2 h
Como cajero
quiero marcar una cotización como enviada, aceptada o rechazada, y que se muestre vencida al pasar la vigencia
para saber en qué punto está cada presupuesto.
- **Requerimientos:** RF-M2-07 · **Reglas:** RN-12
- **Criterios de aceptación:**
  - Dada una transición no permitida, cuando se intenta, entonces la tabla de transiciones la rechaza.
  - Dada la fecha posterior a `valid_until`, cuando se muestra la cotización, entonces aparece como vencida sin proceso aparte (reloj fijo).

### S2-15 · Duplicar y guardado automático de borradores · S · 2 h
Como cajero
quiero duplicar una cotización y que mis borradores se guarden solos
para no repetir captura ni perder lo hecho.
- **Requerimientos:** RF-M2-09
- **Criterios de aceptación:**
  - Dada una cotización, cuando se duplica, entonces nace un borrador nuevo sin folio con los mismos conceptos y precios actuales del catálogo.
  - Dado un borrador a medias, cuando se cierra la aplicación o se bloquea la tablet, entonces se recupera al volver.

### S2-16 · Historial de cotizaciones por cliente · S · 2 h
Como cajero
quiero ver las cotizaciones anteriores de un cliente
para retomar lo que ya se le dio.
- **Requerimientos:** RF-M2-07
- **Criterios de aceptación:**
  - Dado un cliente, cuando se abre su ficha o el cotizador, entonces lista sus cotizaciones con folio, fecha, estado y total.

### S2-17 · Uso en campo: vertical, horizontal y teclado numérico · S · 2 h  · `tablet`
Como cajero
quiero usar la tablet en vertical y horizontal con botones grandes y teclado numérico
para capturar medidas en la obra.
- **Requerimientos:** RF-M2-10, RNF-28, RNF-30
- **Criterios de aceptación:**
  - Dadas ambas orientaciones, cuando se arma una cotización, entonces no se corta ningún control.
  - Dado un campo de medida, cuando se toca, entonces abre el teclado numérico.
  - *(manual)* Cotizar con una mano en la tablet real.

### S2-18 · Condiciones por defecto editables · S · 2 h
Como administrador
quiero editar las condiciones que salen en cada cotización
para ajustarlas sin pedir cambios de código.
- **Requerimientos:** RF-M2-05 (condiciones) · **Reglas:** RN-13, RN-19
- **Criterios de aceptación:**
  - Dadas las tres condiciones por defecto, cuando un administrador las edita, entonces las cotizaciones nuevas usan el texto nuevo y las ya emitidas conservan el anterior.
  - Dado un cajero, cuando intenta editarlas, entonces se rechaza.

## Documento y envío

### S2-19 · PDF carta generado en la tablet · L · 8 h  · `tablet`
Como cajero
quiero generar el PDF de la cotización sin internet
para entregarlo en casa del cliente.
- **Requerimientos:** RF-M2-05, RNF-25 · **Reglas:** RN-21, RN-22 · **Pendientes:** PD-11 (datos de prueba del negocio), PD-12 (aviso abreviado de prueba)
- **Criterios de aceptación:**
  - Dada una cotización, cuando se genera el PDF, entonces trae datos y logo de ZAMMIR, folio, fecha, vigencia, cliente, conceptos con medidas, cantidades e importes, subtotal, IVA, total, condiciones, espacio de firma y aviso abreviado.
  - Dada una cotización sin enviar, cuando se genera, entonces muestra el folio provisional y el código público.
  - Dado el puerto `DocumentRenderer`, cuando corre la batería de contrato, entonces pasan el adaptador real y el falso.
  - Dado el documento, cuando se mide en la tablet, entonces tarda menos de 3 segundos [RNF-25].
  - Dados los totales del PDF, cuando se comparan con los de pantalla, entonces coinciden al centavo.
  - *(manual)* Abrir el PDF en el teléfono de otra persona.

### S2-20 · Compartir por WhatsApp · M · 4 h  · `tablet`
Como cajero
quiero enviar el PDF con el menú de compartir del dispositivo
para mandarlo al cliente en un toque.
- **Requerimientos:** RF-M2-06 · **Reglas:** ADR-0005
- **Criterios de aceptación:**
  - Dado el PDF, cuando se toca enviar, entonces se abre el menú de compartir del dispositivo con la opción de WhatsApp.
  - Dado que el menú no está disponible, cuando se envía, entonces abre un enlace de WhatsApp con mensaje prellenado y descarga el PDF.
  - Dado el producto, cuando se revisa, entonces no hay impresión en tamaño carta.

## Aceptación y cierre

### S2-21 · Aceptación E3 (parte de cotizaciones) · M · 4 h  · `tablet`
Como Juanito (desarrollador)
quiero automatizar el modo avión con tres cotizaciones
para probar el corazón del sistema.
- **Reglas:** E3 de `docs/calidad/PRUEBAS_DE_ACEPTACION.md`, RNF-07
- **Criterios de aceptación:**
  - Dada una tablet en modo avión, cuando se emiten 3 cotizaciones, entonces se guardan con folio provisional.
  - Dada la reconexión, cuando se envían, entonces hay cero duplicados, folios definitivos correctos y totales exactos.
  - *(manual)* Repetir en la tablet real en modo avión.

### S2-22 · Cierre del Sprint 2 · S · 2 h  · `tablet`
Como Juanito (desarrollador)
quiero cerrar el sprint con la compuerta, los ADR del motor y la lista de tablet
para empezar órdenes y mostrador con la sincronización probada.
- **Reglas:** `00-principios` §5.2 · **Plan:** compuerta de salida de la fase 6
- **Criterios de aceptación:**
  - Dada la compuerta común, cuando se corre, entonces está en verde.
  - Dado el `spike/sync`, cuando termina, entonces ADR-0012 y ADR-0016 quedan cerrados con su resultado.
  - Dada la prueba de mutación completa, cuando corre, entonces cumple los umbrales.
  - *(manual)* Lista de tablet firmada: cotizar en modo avión, PDF y compartir por WhatsApp.
  - Dada la revisión, cuando termina, entonces la retrospectiva y la recalibración quedan registradas.
