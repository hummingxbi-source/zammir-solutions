# Acta de entrega y aceptación final

> Historia S5-15 · [DC §13] · documento HMX-ZAM-03 del expediente de entrega ([`PLAN_MAESTRO_DE_ENTREGA.md`](PLAN_MAESTRO_DE_ENTREGA.md) §7).
> **Plantilla**: se llena y se firma el día de la entrega. La versión llenada, con nombres completos y números de serie, se guarda **fuera del repositorio** [CLAUDE.md regla 7, ADR-0010]. Mientras no esté firmada, no se etiqueta la versión `1.0.0`.
> Lo que dependa del contrato (montos, plazos, soporte y garantía del software) se toma **del contrato**. Esta acta no inventa plazos ni costos.
> Integra en un solo documento la constancia de las pruebas de aceptación (anexo A), el registro de entrega de accesos (anexo B) y la carta de entrega de equipo (anexo C) [ADR-0045].

## Datos de la entrega

| | |
|---|---|
| **Cliente** | ZAMMIR, Soluciones en Vidrio y Aluminio · Otumba, Estado de México |
| **Proveedor** | HummingX BI |
| **Sistema** | Sistema de gestión de ZAMMIR: cotizador, órdenes de trabajo, mostrador y caja, clientes, cuentas por cobrar, reportes, usuarios y legal |
| **Versión que se entrega** | `1.0.0` |
| **Dirección del sistema** | `https://sistema.zammir-solutions.com` |
| **Fecha y lugar** | ______________________ · Otumba, Estado de México |

## 1. Qué se entrega

| Entregable | Dónde está | Entregado |
|---|---|---|
| Sistema funcionando con los datos reales de ZAMMIR y **sin datos de prueba** | `https://sistema.zammir-solutions.com` | ☐ |
| Dos tablets con la aplicación instalada y conectadas al sistema | En el local (anexo C) | ☐ |
| Impresión en **hoja carta** probada con la impresora de ZAMMIR, y envío de documentos en PDF por WhatsApp [ADR-0040] | En el local | ☐ |
| Recorrido guiado dentro del sistema [ADR-0042] | Botón **Recorrido guiado** de la barra | ☐ |
| Cuentas de administrador de Luis y Ricardo, y una persona con PIN para cada quien en la tablet | Anexo B | ☐ |
| Exportación de los datos del negocio probada (CSV, JSON y PDF) | Configuración → Exportar los datos | ☐ |
| Respaldo nocturno cifrado, con 30 días de copias, y su restauración ensayada | Plan de continuidad (HMX-ZAM-07) | ☐ |
| Expediente de entrega (contrato, acta de capacitación, aviso de privacidad, informe de calidad y seguridad, ficha técnica, plan de continuidad, manual de usuario, guías rápidas y constancias de capacitación) | Carpeta impresa y en PDF | ☐ |

## 2. Titularidad y datos

- Las cuentas de la plataforma, el **dominio** `zammir-solutions.com` y el **código** del sistema quedan a nombre de **HummingX BI** [ADR-0045].
- Los **datos** que se capturen en el sistema (clientes, cotizaciones, órdenes, ventas y pagos) son de **ZAMMIR**. HummingX los trata por cuenta de ZAMMIR, en los términos del contrato y del aviso de privacidad.
- ZAMMIR puede llevarse todos sus datos cuando quiera desde **Configuración → Exportar los datos**.

## 3. Cómo quedó configurado

Decisiones de operación que aplica el sistema [ADR-0044]:

| Tema | Cómo funciona |
|---|---|
| Corte de caja | Si el efectivo contado no coincide con el esperado, aunque sea por $1, se pide una explicación escrita para cerrar el turno |
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
- Las propuestas sin aprobar de [`PENDIENTES.md`](../producto/PENDIENTES.md) y de [`DESPUES_DE_LA_ENTREGA.md`](../backlog/DESPUES_DE_LA_ENTREGA.md).

## 6. Compuerta de salida

*(El detalle y la evidencia de cada punto están en [`CIERRE_DEL_PROYECTO.md`](CIERRE_DEL_PROYECTO.md).)*

- [ ] Pruebas de aceptación ejecutadas por Luis y firmadas (anexo A).
- [ ] Cero errores críticos abiertos; los menores quedan en la sección 8 con fecha de atención.
- [ ] Restauración ensayada con éxito a partir de una copia **real** del respaldo de la nube, en un entorno limpio [ADR-0043].
- [ ] Las tres sesiones de capacitación hechas y firmadas (HMX-ZAM-02).
- [ ] Manual de usuario y guías rápidas entregados.
- [ ] Versión `1.0.0` etiquetada (después de firmar).

## 7. Capacitación

| Sesión | Con quién | Fecha | Hecha |
|---|---|---|---|
| 1 | Luis | | ☐ |
| 2 | Ricardo | | ☐ |
| 3 | Equipo de mostrador | | ☐ |

El detalle de cada sesión está en el acta de capacitación (HMX-ZAM-02).

## 8. Pendientes aceptados

Errores menores o mejoras que **no** impiden la entrega y que ambas partes aceptan atender después.

| # | Qué es | Gravedad | Se atiende el |
|---|---|---|---|
| | | | |

## 9. Firmas

Con estas firmas ZAMMIR da por **aceptado** el sistema descrito, en los términos del contrato y con los pendientes aceptados de la sección 8.

| | Nombre | Fecha | Firma |
|---|---|---|---|
| Por ZAMMIR | Luis ______________________ | | |
| Por HummingX BI | ______________________ | | |
| Por HummingX BI | ______________________ | | |
| Por HummingX BI | ______________________ | | |

---

## Anexo A · Constancia de pruebas de aceptación

Luis ejecutó los escenarios de [`PLAN_DE_ACEPTACION_CLIENTE.md`](../calidad/PLAN_DE_ACEPTACION_CLIENTE.md) con datos inventados, antes de cargar los datos reales [ADR-0043]. Se adjunta la hoja de resultados firmada, escenario por escenario.

| | |
|---|---|
| Fecha de las pruebas | |
| Escenarios que pasaron | ___ de ___ |
| Escenarios en pausa (facturación) | 7 a 10 |
| Lo que no pasó y cómo se resolvió | |

| | Nombre | Firma |
|---|---|---|
| Por ZAMMIR | Luis ______________________ | |
| Por HummingX BI | ______________________ | |

## Anexo B · Registro de entrega de accesos

**Sin contraseñas ni PIN.** Cada persona escribe su contraseña o su PIN en persona; nunca se mandan por mensaje [ADR-0045].

| Acceso | Persona | Rol | Cómo se entregó | Fecha |
|---|---|---|---|---|
| Cuenta de administrador (correo y contraseña) | Luis | Administrador | La escribió en persona | |
| Cuenta de administrador (correo y contraseña) | Ricardo | Administrador | La escribió en persona | |
| Persona con PIN en la tablet | Luis | Administrador | Escribió su PIN en persona | |
| Persona con PIN en la tablet | Ricardo | Administrador | Escribió su PIN en persona | |
| Persona con PIN en la tablet | ______________ | Cajero / vendedor | Escribió su PIN en persona | |

Las cuentas de la plataforma (Supabase, Vercel, GitHub y Cloudflare) son de HummingX BI y **no se entregan** [ADR-0045].

## Anexo C · Carta de entrega de equipo

| # | Equipo | Modelo | Número de serie | Accesorios | Estado | Origen |
|---|---|---|---|---|---|---|
| 1 | Tablet | Samsung Galaxy Tab A11+ | | | | Incluida en el contrato |
| 2 | Tablet | Samsung Galaxy Tab A11+ | | | | Comprada por ZAMMIR; HummingX la configuró |

- Las dos tablets quedan con la aplicación instalada, conectadas al sistema y entregadas a ZAMMIR.
- La garantía del fabricante se tramita con la factura de compra; HummingX apoya el trámite. *(Las condiciones exactas de cada tablet van en el contrato.)*

| | Nombre | Firma |
|---|---|---|
| Recibe por ZAMMIR | Luis ______________________ | |
| Entrega por HummingX BI | ______________________ | |

---

## Publicar la versión (lo hace Juanito, después de firmar)

1. Con `main` en verde y el acta firmada, subir la versión de `apps/web/package.json` y `packages/core/package.json` de `0.0.0` a `1.0.0`. El `package.json` de la raíz no lleva versión.
2. En `CHANGELOG.md`, cambiar `## [1.0.0] — pendiente de etiquetar` por `## [1.0.0] — AAAA-MM-DD` y quitar la nota de "todavía no está etiquetada".
3. Fusionar ese cambio por Pull Request, como cualquier otro.
4. Etiquetar: `git tag -a v1.0.0 -m "ZAMMIR 1.0.0"` y `git push origin v1.0.0`; crear la versión en GitHub con las notas del `CHANGELOG.md`.
5. Anotar la fecha y la etiqueta en `CIERRE_DEL_PROYECTO.md`.
