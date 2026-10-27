# Fase 8 — Sprint 4: Cobranza, reportes, legal y facturación

- **Tipo:** código
- **Fechas:** 23 – 29 de noviembre de 2026 (empieza la ventana de entrega)
- **Lee antes:** [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md), `REQUERIMIENTOS.md` M6, M7, M9 y M10, RN-17, RN-20, [ADR-0007]

> ⚠ **PD-01:** el detalle de M10 depende de la §7 del documento fuente. Este archivo describe lo que ya se sabe y debe completarse cuando llegue esa sección, **antes** de empezar el sprint.

## Objetivo

Cerrar el círculo del negocio: saber quién debe, ver los números que pidió Luis, cumplir con los avisos legales y facturar cuando el cliente lo pida.

## Entra si

- Sprint 3 cerrado con su compuerta en verde.
- La §7 del documento fuente recibida y M10 completo en `REQUERIMIENTOS.md` (PD-01).
- PAC elegido (PD-05), al menos para conectar su entorno de pruebas.

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

### 8.4 Facturación — M10 (lo conocido)
- Puerto `BillingProvider` con su batería de contrato [ADR-0007].
- Adaptador **simulado** que cumple el contrato.
- Adaptador del **PAC elegido** contra su entorno de pruebas, pasando la misma batería de contrato.
- Factura desde el sistema por administrador; cajero solo con autorización por PIN [DC §4].
- Folio `F-AAAA-0001`.
- Datos fiscales de productos y cliente desde M1 y M5.
- Portal público de autofacturación: el cliente final entra con el código del QR, captura sus datos fiscales, obtiene su factura; sin cuenta ni contraseña [DC §4].
- Plazo para autofacturar configurable (PD-09).
- La factura aparece en el historial del cliente [RF-M5-02].
- ⚠ PD-01: cancelación, complementos, formatos de entrega y cualquier otra regla de la §7.

### 8.5 Portal de seguimiento — P1, detrás del interruptor (último del sprint)
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
- [ ] Portal: código válido, inválido, vencido (fuera de plazo) y ya usado; un ticket no se factura dos veces.
- [ ] Portal: el código de un ticket no da acceso a datos de otro (prueba de acceso con códigos ajenos).
- [ ] Portal: validación de RFC, régimen, código postal y uso de CFDI según lo que defina la §7.
- [ ] Respuestas de error del PAC (rechazo, tiempo agotado, servicio caído): mensaje claro y nada a medias.
- [ ] Ningún secreto del PAC aparece en el código del navegador (prueba que revisa el paquete construido).
- [ ] ⚠ PD-01: pruebas de cancelación y demás reglas de la §7.

**Portal de seguimiento (P1, si se construye)**
- [ ] Con el interruptor apagado, el enlace no funciona.
- [ ] Aceptar en línea cambia la cotización a "aceptada" con bitácora; una cotización vencida no se puede aceptar.

**Extremo a extremo**
- [ ] Venta en Mostrador → el cliente escanea el QR → autofactura con datos de prueba → la factura aparece en el historial.
- [ ] Orden entregada con saldo → aparece en cuentas por cobrar → se cobra desde la lista → desaparece.
- [ ] Administrador revisa los reportes en tamaño de celular.

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
- ⚠ PD-01, PD-04, PD-05, PD-08, PD-09, PD-12, PD-13.
