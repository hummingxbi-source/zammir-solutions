<!--
  Plantilla del documento HMX-ZAM-02 del expediente de entrega [ADR-0047]. Historia S5-15 · [DC §13].
  La versión llenada (nombres completos, números de serie y firmas) se guarda en la carpeta local `privado/`,
  que git ignora, y se imprime de ahí. Nunca se sube al repositorio [CLAUDE.md regla 7, ADR-0010].
  Lo que dependa del contrato (montos, plazos, soporte y garantía del software) se toma del contrato.
  Mientras el acta no esté firmada, no se etiqueta la versión 1.0.0 (pasos en CIERRE_DEL_PROYECTO.md §6).
-->

# Acta de entrega y aceptación

| | |
|---|---|
| **Documento** | HMX-ZAM-02 · versión 1.0 |
| **Cliente** | ZAMMIR, Soluciones en Vidrio y Aluminio · Otumba, Estado de México |
| **Proveedor** | HummingX BI |
| **Sistema** | Sistema de gestión de ZAMMIR: cotizador, órdenes de trabajo, mostrador y caja, clientes, cuentas por cobrar, reportes, usuarios y legal |
| **Versión del sistema** | `1.0.0` |
| **Dirección** | `https://sistema.zammir-solutions.com` |
| **Lugar y fecha** | Otumba, Estado de México, a ____ de noviembre de 2026 |

En el lugar y la fecha indicados, HummingX BI entrega a ZAMMIR el sistema descrito, y ZAMMIR lo recibe en los términos de esta acta y del contrato de prestación de servicios (HMX-ZAM-01).

## 1. Qué se entrega

| Entregable | Dónde está | Entregado |
|---|---|---|
| Sistema funcionando con los datos reales de ZAMMIR y **sin datos de prueba** | `https://sistema.zammir-solutions.com` | ☐ |
| Dos tablets con la aplicación instalada y conectadas al sistema | En el local (anexo D) | ☐ |
| Impresión en **hoja carta** probada con la impresora de ZAMMIR, y envío de documentos en PDF por WhatsApp [ADR-0040] | En el local (anexo D) | ☐ |
| Recorrido guiado dentro del sistema [ADR-0042] | Botón **Recorrido guiado** de la barra | ☐ |
| Cuentas de administrador de Luis y Ricardo, y una persona con PIN para cada quien en la tablet | Anexo C | ☐ |
| Exportación de los datos del negocio probada (CSV, JSON y PDF) | Configuración → Exportar los datos | ☐ |
| Respaldo nocturno cifrado, con 30 días de copias, y su restauración ensayada | Informe técnico de entrega (HMX-ZAM-03) | ☐ |
| Capacitación de Luis, de Ricardo y del equipo de mostrador | Anexo B | ☐ |
| Expediente: contrato (HMX-ZAM-01), esta acta, informe técnico (HMX-ZAM-03), manual de usuario (HMX-ZAM-04) y guías rápidas por rol (HMX-ZAM-05) | Carpeta impresa y en PDF | ☐ |

## 2. Titularidad y datos

- Las cuentas de la plataforma, el **dominio** `zammir-solutions.com` y el **código** del sistema quedan a nombre de **HummingX BI** [ADR-0045].
- Los **datos** que se capturen en el sistema (clientes, cotizaciones, órdenes, ventas y pagos) son de **ZAMMIR**. HummingX los trata por cuenta de ZAMMIR, en los términos del contrato y del aviso de privacidad (anexo E).
- ZAMMIR puede llevarse todos sus datos cuando quiera desde **Configuración → Exportar los datos**.

## 3. Cómo quedó configurado

Decisiones de operación que aplica el sistema [ADR-0044]:

| Tema | Cómo funciona |
|---|---|
| Corte de caja | Si el efectivo contado no coincide con el esperado, aunque sea por un centavo, se pide una explicación escrita para cerrar el turno |
| Fecha de entrega | Es obligatoria al crear la orden. Una orden que pasó su fecha sin entregarse sale como **Atrasada** |
| Cuentas por cobrar | Los días se cuentan **desde la entrega**. Una cuenta está atrasada desde el día siguiente (1 día, se cambia en Configuración). Lo no entregado sale como **Por entregar** |
| Transferencias | Un administrador las marca como **Ya llegó** después de revisar su banco; queda quién y cuándo |
| Cancelar una venta de mostrador | Se devuelve el dinero por el mismo medio, desde el turno abierto de quien cancela. Un corte ya cerrado no cambia |
| Entregas por partes | Una orden por cada parte, eligiendo qué líneas de la cotización entran |
| Categorías | El administrador las agrega, renombra, ordena y desactiva |
| Cargos extra | Cantos, perforaciones y biselados se agregan a una línea de vidrio y se cobran por m², metro lineal o pieza |
| Reportes | "Ventas" son las ventas de mostrador más los pagos de órdenes recibidos en el periodo |

## 4. Anticipo cuando se cancela una orden

Política acordada [ADR-0045]:

1. El anticipo es un pago a cuenta del trabajo y **no se devuelve en automático**.
2. Si la orden se cancela **En espera**, antes de cortar o comprar material, se recomienda devolverlo completo.
3. Si se cancela **En proceso** o **Listo**, con el material ya cortado a medida, el anticipo se queda para cubrir material y mano de obra. Luis o Ricardo pueden devolver una parte si lo consideran justo.
4. Lo decide siempre un administrador, y la decisión se escribe en el **motivo** de la cancelación.
5. Si se devuelve efectivo, sale del cajón y el corte lo muestra como faltante: se anota en la explicación del corte. El sistema todavía no registra esa devolución por separado (PP-35).

## 5. Fuera de esta entrega

- **Facturación electrónica (CFDI):** construida y probada, pero **en pausa** hasta que ZAMMIR tenga en orden sus datos fiscales [ADR-0039]. Mientras tanto, el contador de ZAMMIR sigue facturando. Los documentos no llevan QR ni mencionan factura.
- **Ticket térmico e impresora Bluetooth:** el comprobante es una hoja carta [ADR-0040].
- **Portal de seguimiento** para el cliente final (P1) y **existencias** de piezas estándar (P2), apagados [ADR-0019].
- Las mejoras propuestas que todavía no se aprueban; si ZAMMIR quiere alguna, se acuerda aparte.
<!-- Lista interna: PENDIENTES.md (propuestas PP) y docs/backlog/DESPUES_DE_LA_ENTREGA.md. -->

## 6. Compuerta de salida

<!-- El detalle y la evidencia de cada punto están en CIERRE_DEL_PROYECTO.md. -->

- [ ] Pruebas de aceptación ejecutadas por Luis y firmadas (anexo A).
- [ ] Cero errores críticos abiertos; los menores quedan en la sección 7 con fecha de atención.
- [ ] Restauración ensayada con éxito a partir de una copia **real** del respaldo de la nube, en un entorno limpio [ADR-0043].
- [ ] Las tres sesiones de capacitación hechas y firmadas (anexo B).
- [ ] Manual de usuario y guías rápidas entregados.
- [ ] Versión `1.0.0` etiquetada (después de firmar).

## 7. Pendientes aceptados

Errores menores o mejoras que **no** impiden la entrega y que ambas partes aceptan atender después.

| # | Qué es | Gravedad | Se atiende el |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

## 8. Firmas

Con estas firmas ZAMMIR da por **aceptado** el sistema descrito, en los términos del contrato y con los pendientes aceptados de la sección 7.

| | Nombre | Firma |
|---|---|---|
| **Por ZAMMIR** | Luis ______________________________ | |
| **Por HummingX BI** | ______________________________ | |
| **Por HummingX BI** | ______________________________ | |
| **Por HummingX BI** | ______________________________ | |

---

## Anexo A · Constancia de pruebas de aceptación

*Se firma el sábado 28, al terminar las pruebas.*

Luis ejecutó los escenarios del plan de pruebas de aceptación ([`PLAN_DE_ACEPTACION_CLIENTE.md`](../calidad/PLAN_DE_ACEPTACION_CLIENTE.md)) con datos **inventados**; el escenario 14, de respaldo y restauración, lo hizo HummingX en su presencia, antes de cargar los datos reales [ADR-0043]. Se adjunta la hoja de resultados firmada, escenario por escenario.

| | |
|---|---|
| Fecha y hora de las pruebas | |
| Escenarios ejecutados | ___ de 19 (1 a 6 y 11 a 23; los escenarios 7 a 10, de facturación, están en pausa) |
| Escenarios que pasaron | ___ |
| Lo que no pasó y cómo se resolvió | |

| | Nombre | Firma |
|---|---|---|
| **Por ZAMMIR** | Luis ______________________________ | |
| **Por HummingX BI** | ______________________________ | |

---

## Anexo B · Capacitación

*Cada apartado se firma al terminar su sesión. Los temas se marcan conforme se ven.*

### Sesión 1 · Luis (administrador)

| | |
|---|---|
| Fecha | |
| Hora de inicio y de fin | ______ a ______ (duración: ______) |
| Imparte (HummingX BI) | |

**Temas vistos**

- [ ] Entrar a la tablet con PIN y a la computadora con correo y contraseña; recorrido guiado
- [ ] Cotizar: cliente, vidrio a medida, piezas, cargos extra, descuento con PIN, emitir y enviar por WhatsApp
- [ ] Convertir una cotización en orden: fecha de entrega y entregas por partes
- [ ] Cobrar anticipo y saldo, avanzar la orden, entregar y comprobante
- [ ] Órdenes atrasadas y cancelar una orden con anticipo (sección 4)
- [ ] Cuentas por cobrar y "Ya llegó" en las transferencias
- [ ] Mostrador: abrir turno, vender, cobrar, cancelar una venta y corte de caja con explicación
- [ ] Imprimir en hoja carta, la marca COPIA al reimprimir una venta y qué hacer si la impresora no responde
- [ ] Reportes
- [ ] Usuarios, PIN y tablets; catálogo, categorías e importación; configuración y exportación de datos
- [ ] Trabajar sin internet

**Criterio (S5-11):** Luis completa **sin ayuda** un recorrido de cotización a cobro. ☐ Sí ☐ No

Observaciones: ____________________________________________________________

| | Nombre | Firma |
|---|---|---|
| **Recibe** | Luis ______________________________ | |
| **Imparte** | ______________________________ | |

### Sesión 2 · Ricardo (administrador)

| | |
|---|---|
| Fecha | |
| Hora de inicio y de fin | ______ a ______ (duración: ______) |
| Imparte (HummingX BI) | |

**Temas vistos** (los mismos de la sesión 1, con énfasis en los reportes)

- [ ] Entrar a la tablet con PIN y a la computadora con correo y contraseña; recorrido guiado
- [ ] Cotizar: cliente, vidrio a medida, piezas, cargos extra, descuento con PIN, emitir y enviar por WhatsApp
- [ ] Convertir una cotización en orden: fecha de entrega y entregas por partes
- [ ] Cobrar anticipo y saldo, avanzar la orden, entregar y comprobante
- [ ] Órdenes atrasadas y cancelar una orden con anticipo (sección 4)
- [ ] Cuentas por cobrar y "Ya llegó" en las transferencias
- [ ] Mostrador: abrir turno, vender, cobrar, cancelar una venta y corte de caja con explicación
- [ ] Imprimir en hoja carta, la marca COPIA al reimprimir una venta y qué hacer si la impresora no responde
- [ ] Reportes
- [ ] Usuarios, PIN y tablets; catálogo, categorías e importación; configuración y exportación de datos
- [ ] Trabajar sin internet

**Criterio (S5-12):** Ricardo completa **sin ayuda** un recorrido de cotización a cobro **y revisa los reportes**. ☐ Sí ☐ No

Observaciones: ____________________________________________________________

| | Nombre | Firma |
|---|---|---|
| **Recibe** | Ricardo ______________________________ | |
| **Imparte** | ______________________________ | |

### Sesión 3 · Equipo de mostrador (cajero / vendedor)

| | |
|---|---|
| Fecha | |
| Hora de inicio y de fin | ______ a ______ (duración: ______) |
| Imparte (HummingX BI) | |

**Temas vistos**

- [ ] Entrar con PIN, cambiar de persona y bloqueo de la tablet
- [ ] Cotizar y enviar por WhatsApp
- [ ] Vender en el mostrador: efectivo, transferencia y pago mixto
- [ ] Cobrar anticipos y saldos de órdenes
- [ ] Corte de caja: contar, cerrar y explicar una diferencia
- [ ] Imprimir y reimprimir una venta (marca COPIA)
- [ ] Trabajar sin internet: "Guardada en la tablet"
- [ ] A quién pedir el PIN de un administrador y cómo reportar un problema

**Criterio (S5-13):** cada persona entra con su PIN, cobra, hace su corte y reimprime el comprobante de una venta. ☐ Sí ☐ No

Observaciones: ____________________________________________________________

| | Nombre | Firma |
|---|---|---|
| **Recibe** | ______________________________ | |
| **Imparte** | ______________________________ | |

---

## Anexo C · Entrega de accesos

**Sin contraseñas ni PIN.** Cada persona escribió su contraseña o su PIN en persona; nunca se mandan por mensaje [ADR-0045].

| Acceso | Persona | Rol | Cómo se entregó | Fecha |
|---|---|---|---|---|
| Cuenta de administrador (correo y contraseña) | Luis | Administrador | Escribió su contraseña en persona | |
| Cuenta de administrador (correo y contraseña) | Ricardo | Administrador | Escribió su contraseña en persona | |
| Persona con PIN en la tablet | Luis | Administrador | Escribió su PIN en persona | |
| Persona con PIN en la tablet | Ricardo | Administrador | Escribió su PIN en persona | |
| Persona con PIN en la tablet | ______________ | Cajero / vendedor | Escribió su PIN en persona | |

- Las cuentas de la plataforma (Supabase, Vercel, GitHub y Cloudflare) son de HummingX BI y **no se entregan** [ADR-0045].
- Si alguien olvida su **PIN**, un administrador lo restablece en **Usuarios**. Si un administrador olvida su **contraseña**, HummingX la restablece desde el panel de la plataforma, porque el sistema no tiene esa pantalla. En los dos casos, la persona escribe la nueva en persona.

| | Nombre | Firma |
|---|---|---|
| **Recibe por ZAMMIR** | Luis ______________________________ | |
| **Entrega por HummingX BI** | ______________________________ | |

---

## Anexo D · Entrega de equipo

| # | Equipo | Modelo | Número de serie | Accesorios | Estado | Origen |
|---|---|---|---|---|---|---|
| 1 | Tablet | Samsung Galaxy Tab A11+ | | | | Incluida en el contrato |
| 2 | Tablet | Samsung Galaxy Tab A11+ | | | | Comprada por ZAMMIR; HummingX la configuró |
| 3 | Impresora de ZAMMIR | | — | — | | De ZAMMIR; HummingX la dio de alta en las dos tablets |

- Las dos tablets quedan con la aplicación instalada, conectadas al sistema y entregadas a ZAMMIR.
- La garantía del fabricante de las tablets se tramita con su factura de compra; HummingX apoya el trámite. Las condiciones de cada tablet van en el contrato.

| | Nombre | Firma |
|---|---|---|
| **Recibe por ZAMMIR** | Luis ______________________________ | |
| **Entrega por HummingX BI** | ______________________________ | |

---

## Anexo E · Aviso de privacidad

Se adjunta impreso el aviso de privacidad vigente en el sistema, el mismo que se consulta en `https://sistema.zammir-solutions.com/aviso` y en **Configuración**.

| | |
|---|---|
| Versión del aviso | ____ · vigente desde el ____________ |
| Revisión del texto | ☐ Lo revisó el asesor de ZAMMIR ☐ Es el borrador base de HummingX, que ZAMMIR acepta como versión inicial (PD-12) |

ZAMMIR recibió el aviso de privacidad, conoce que HummingX BI trata los datos de sus clientes por cuenta de ZAMMIR, y puede cambiar el texto cuando quiera desde **Configuración**; cada cambio crea una versión nueva y las anteriores se conservan.

| | Nombre | Firma |
|---|---|---|
| **Recibe por ZAMMIR** | Luis ______________________________ | |

