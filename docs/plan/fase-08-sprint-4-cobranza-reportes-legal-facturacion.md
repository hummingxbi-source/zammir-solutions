# Fase 8 — Sprint 4: Cobranza, reportes, legal y facturación

- **Tipo:** código
- **Fechas:** 23 – 29 de noviembre de 2026 (empieza la ventana de entrega)
- **Lee antes:** [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md), `REQUERIMIENTOS.md` M6, M7, M9 y M10, RN-17, RN-20, [ADR-0007]

> M10 completo según [DC §7]: `REQUERIMIENTOS.md` RF-M10-01 a RF-M10-21 y reglas RN-24 a RN-28.

## Objetivo

Cerrar el círculo del negocio: saber quién debe, ver los números que pidió Luis, cumplir con los avisos legales y facturar cuando el cliente lo pida.

## Entra si

- Sprint 3 cerrado con su compuerta en verde.
- PAC elegido y su cuenta de pruebas abierta (PD-05). Quién lo contrata, definido.

## Alcance

### 8.1 Cuentas por cobrar — M6
- RF-M6-01 a RF-M6-04.
- Lista de órdenes con saldo mayor a cero, con días transcurridos calculados con fechas reales y antigüedad resaltada según el umbral configurado.
- Registrar el pago desde la lista (usa `RegisterPayment` del Sprint 3).
- Recordatorio por WhatsApp con mensaje prellenado y amable.

### 8.2 Reportes — M7
- RF-M7-01 a RF-M7-06, solo administradores, legibles en celular.
- Base de "ventas" según RN-20, explicada en la pantalla (PD-08).
- Periodos en hora de México, semana de lunes a domingo [RN-17].
- Comparativo contra el periodo anterior con porcentaje y flecha; qué se muestra cuando el periodo anterior es cero se define en la historia.
- Sin predicciones; se llama "Reportes".

### 8.3 Legal — M9 (completo)
- RF-M9-01: aviso de privacidad enlazado desde cotizador, comprobantes y portal de autofacturación.
- RF-M9-02: términos del servicio visibles en cotizaciones y comprobantes, editables con versión.
- RF-M9-04: canal visible para ejercer derechos sobre datos personales.
- RF-M9-05: el aviso declara la transferencia de datos fiscales al PAC.
- Textos de prueba hasta recibir los finales (PD-12).

### 8.4 Facturación — M10 [DC §7]

**Proveedor**
- Puerto `BillingProvider` con timbrar, cancelar, consultar estatus y descargar XML y PDF, y su batería de contrato [RF-M10-01], [ADR-0007].
- Adaptador **simulado** que cumple el contrato, y adaptador del **PAC elegido** contra su entorno de pruebas, pasando la misma batería.
- El CSD (`.key` y contraseña) se sube directamente al PAC; nunca pasa por nuestro código ni base de datos [RF-M10-02].
- Las llamadas al PAC solo ocurren en funciones del servidor.

**Camino A: desde el sistema** [RF-M10-04 a RF-M10-08]
- Solo ventas u órdenes liquidadas, no facturadas ni canceladas [RN-25].
- Receptor desde la ficha del cliente o capturado: RFC, nombre o razón social como en su constancia, código postal fiscal, régimen y uso de CFDI.
- Forma de pago `01` o `03`, método `PUE`; regla de pago mixto configurable (PD-28) [RN-28].
- Guardar UUID, XML y PDF; reenviar por correo o WhatsApp.
- Administrador; cajero solo con autorización por PIN de un administrador.
- Folio `F-AAAA-0001`.

**Camino B: portal `/factura`** [RF-M10-09 a RF-M10-17]
- Entrada por QR (folio + código de verificación) o tecleando ambos.
- Validaciones en el servidor antes de mostrar nada: folio, código, liquidada, no facturada, dentro del plazo de fin de mes [RN-26].
- Límite de intentos por IP y por folio, verificación contra automatización, y nunca revelar si un folio existe [RF-M10-11].
- Muestra solo conceptos y total; formulario con RFC (12 o 13 caracteres), código postal (5 dígitos), listas de régimen y uso de CFDI, y aceptación del aviso de privacidad que menciona al PAC.
- Resultado con descarga de PDF y XML y envío por correo opcional.
- Si el PAC falla o tarda: solicitud "en proceso", reintentos automáticos y aviso en el panel de administrador; **nunca un timbre duplicado** [RN-24].
- Fuera de plazo: mensaje amable para pedir la factura al negocio.
- Diseño para personas mayores: pocos pasos, botones grandes, instrucciones simples [RF-M10-16], [RF-UX-10].

**Anticipos, cancelación y timbres**
- Ajuste "tratamiento de anticipos" con la opción (a); la (b) no se construye salvo que el contador la exija y Juanito lo apruebe [RN-27], PD-27.
- Cancelación de CFDI solo por administradores, con motivos del SAT y bitácora [RF-M10-19].
- Contador de timbres con aviso al 80% del límite configurable [RF-M10-20], PD-26.
- La factura aparece en el historial del cliente [RF-M10-21].

**Fuera del alcance:** factura global, complemento de pago, notas de crédito complejas y otros complementos [DC §7.8].

### 8.6 Orientación para usuarios nuevos [RF-UX-02, RF-UX-03 y RF-UX-05]
Va en este sprint porque necesita que todas las secciones existan.
- Pantalla de "Primeros pasos" en el primer ingreso, con cinco tarjetas en el orden de la navegación.
- Botón fijo "¿Por dónde empiezo?".
- **El recorrido guiado con globos de ayuda [RF-UX-04] queda fuera de la entrega** [ADR-0019]; se hace después, salvo que Juanito decida otra cosa. "Primeros pasos" y el botón no se recortan.

### 8.5 Portal de seguimiento — P1, detrás del interruptor (fuera de la entrega salvo que Luis lo active [ADR-0019])
- RF-M2-11: el cliente ve y acepta la cotización en línea con un enlace público.
- Línea de tiempo del trabajo [DC §3.2].
- Si no cabe, Juanito decide moverlo a después de la entrega.

## Fuera de esta fase

- Dominio, PAC en producción y datos reales (Sprint 5).
- Factura global y contabilidad: fuera del alcance [DC §3.3].

## Diseño

- **S:** cada reporte es un caso de uso de solo lectura con su propia consulta.
- **O:** agregar un reporte no toca los demás.
- **L:** el adaptador simulado y el del PAC pasan la misma batería de contrato; esa es la garantía de que el cambio al final no rompe nada.
- **I:** los reportes dependen de puertos de lectura, no de los repositorios de escritura.
- **D:** el portal público no toca tablas directamente: pasa por funciones del servidor que validan el código.
- El cálculo del CFDI usa **el mismo** módulo de dinero e IVA que el ticket y el PDF [RN-07].

## Entregables

- Cuentas por cobrar, Reportes y Legal funcionando.
- Facturación funcionando contra el adaptador simulado y contra el entorno de pruebas del PAC.
- Portal de autofacturación.
- P1, si cupo.

## Pruebas obligatorias

**Cuentas por cobrar**
- [ ] Solo aparecen órdenes con saldo mayor a cero; se van al liquidarse.
- [ ] Días transcurridos correctos con reloj fijo, a través de cambios de mes y de año.
- [ ] **Regresión de la demo:** nunca aparece un número de días absurdo; con fechas futuras o inválidas se rechaza el dato, no se muestra.
- [ ] Antigüedad resaltada al cruzar el umbral configurado, justo antes y justo después.
- [ ] Mensaje de recordatorio con nombre, folio y saldo correctos, bien codificado.
- [ ] Solo administradores ven la lista (RLS).

**Reportes** (cada uno con datos de prueba armados a mano y su resultado esperado calculado a mano)
- [ ] Ventas del día, semana y mes con la base de RN-20.
- [ ] Límites de periodo: medianoche, lunes, fin de mes, febrero de año bisiesto, cambio de año; corriendo en otra zona horaria.
- [ ] Comparativo: subida, bajada, sin cambio y periodo anterior en cero.
- [ ] Más vendido por importe y por cantidad, con empates.
- [ ] Trabajos pendientes por estatus con conteo y valor.
- [ ] **Invariante cruzada:** total de cobros por cajero = total por método de pago = suma de los cortes del periodo.
- [ ] Ventas y pagos cancelados no cuentan.
- [ ] Solo administradores (RLS y caso de uso).

**Legal**
- [ ] Cada versión del aviso y de los términos se conserva; los documentos muestran la versión vigente al emitirse.
- [ ] Los enlaces al aviso existen en cotizador, comprobantes y portal.
- [ ] Solo administradores editan.

**Facturación**
- [ ] Batería de contrato de `BillingProvider` en verde con el simulado **y** con el PAC en su entorno de pruebas.
- [ ] **Propiedad:** para cualquier venta u orden, el total del CFDI = total del ticket y del comprobante al centavo, con el mismo desglose de IVA.
- [ ] Factura con productos exentos y gravados.
- [ ] Cajero sin autorización rechazado; con autorización de administrador aceptado y en bitácora.
- [ ] Portal: código válido, inválido, fuera de plazo, ya facturado y operación con saldo pendiente; cada caso con su mensaje claro (E5).
- [ ] Plazo: último segundo del último día del mes en hora de México acepta; el primer segundo del mes siguiente rechaza; corriendo en otra zona horaria [RN-26].
- [ ] Un código incorrecto y un folio inexistente dan **exactamente la misma respuesta** (no se revela si el folio existe).
- [ ] Límite de intentos por IP y por folio: el siguiente intento se bloquea; la verificación contra automatización se exige.
- [ ] **Idempotencia:** dos solicitudes simultáneas para la misma operación producen una sola factura; el PAC simulado que falla o tarda deja la solicitud "en proceso", se reintenta y nunca timbra dos veces [RN-24].
- [ ] Portal: el código de un ticket no da acceso a datos de otro (prueba de acceso con códigos ajenos).
- [ ] Portal: RFC de 12 y 13 caracteres aceptado, otros rechazados; código postal de 5 dígitos; régimen y uso de CFDI solo de sus listas; sin aceptar el aviso no se timbra.
- [ ] Respuestas de error del PAC (rechazo, tiempo agotado, servicio caído): mensaje claro y nada a medias.
- [ ] Ningún secreto del PAC aparece en el código del navegador (prueba que revisa el paquete construido).
- [ ] Solo ventas u órdenes liquidadas se pueden facturar, desde el sistema y desde el portal [RN-25].
- [ ] Forma de pago `01` para efectivo, `03` para transferencia, método `PUE` en el CFDI generado.
- [ ] Cancelación: solo administrador, con motivo del SAT, en bitácora; una operación con factura cancelada se puede volver a facturar.
- [ ] Ajuste de anticipos en opción (a): una orden con anticipo y saldo genera un solo CFDI por el total al liquidarse [RN-27].
- [ ] Contador de timbres y aviso exactamente al 80% del límite configurado.
- [ ] El CSD no existe en ninguna tabla, variable de entorno ni archivo del repositorio (revisión automatizada de esquema y secretos).
- [ ] E6: cajero sin autorización no factura; con autorización sí.

**Orientación**
- [ ] "Primeros pasos" aparece solo en el primer ingreso de cada usuario; el botón "¿Por dónde empiezo?" la vuelve a abrir.

**Rendimiento**
- [ ] Reportes con 12 meses de datos de prueba en menos de 3 segundos [RNF-27].

**Portal de seguimiento (P1, si se construye)**
- [ ] Con el interruptor apagado, el enlace no funciona.
- [ ] Aceptar en línea cambia la cotización a "aceptada" con bitácora; una cotización vencida no se puede aceptar.

**Extremo a extremo**
- [ ] Venta en Mostrador → el cliente escanea el QR → autofactura con datos de prueba → la factura aparece en el historial.
- [ ] Orden entregada con saldo → aparece en cuentas por cobrar → se cobra desde la lista → desaparece.
- [ ] Administrador revisa los reportes en tamaño de celular.
- [ ] E5, E6, E7 y E8 completos (`docs/calidad/PRUEBAS_DE_ACEPTACION.md`).

**Manual**
- [ ] Reportes en un celular real.
- [ ] Autofacturación desde un celular escaneando un ticket impreso.

## Compuerta de salida

- [ ] Compuerta común de [00 §5.2] en verde.
- [ ] Batería de contrato de facturación en verde contra el entorno de pruebas del PAC.
- [ ] Invariante cruzada de reportes en verde.
- [ ] Revisión del sprint con Luis: reportes y una factura de prueba.

## Riesgos y pendientes

- **Mayor riesgo del proyecto en esta fase:** la API del PAC. Se mitiga con el contrato diseñado sobre el estándar CFDI y eligiendo el PAC antes de empezar.
- Si el sprint no alcanza, el orden de recorte es: P1, luego detalles de presentación de reportes. Facturación y cuentas por cobrar no se recortan.
- R12: el IVA por línea puede diferir un centavo del que espera el PAC [ADR-0011]; se confirma en su entorno de pruebas al inicio del sprint, no al final.
- PD-04, PD-05, PD-08, PD-09, PD-12, PD-13, PD-26, PD-27, PD-28, PD-31.
- Detalle de reportes visto en la demo [Juanito, 2026-10-27]: comparar periodos equivalentes (PP-13), valor contratado (PP-17), m² vendidos (PP-18), lista de atención (PP-07). Tolerancia de caja: PD-44. Ver `docs/producto/DEMO_REFERENCIA.md` §8 y `REVISION_DE_NEGOCIO.md` §6.
