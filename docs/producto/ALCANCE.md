# Alcance del sistema ZAMMIR

> Fuente principal: Documento de construcción v1 completo [DC §3, §8, §12]. Cambios posteriores, con su ADR.
> Regla de oro: **lo que no está aquí, no se construye.** Si crees que falta o sobra algo, anótalo en `PENDIENTES.md` como propuesta [DC §0 regla 5].
> Si algo de este documento contradice al contrato firmado o a su anexo técnico, **manda lo firmado** y se avisa a Juanito [DC §15].

## 1. Para quién es

**Cliente:** Soluciones en Vidrio y Aluminio ZAMMIR, vidriería de un solo local en Otumba de Gómez Farías, Estado de México, con año y medio de operación [DC §1.2].

- Dueño: Luis Ramírez Rodríguez. Socio: Ricardo.
- 3 empleados que cobran en el mostrador (una sola caja a la vez) y ellos mismos instalan [DC §4].
- Hoy no usan ningún sistema ni equipo de cómputo [DC §2].
- Muchos de sus clientes finales son personas mayores o poco familiarizadas con la tecnología [DC §2].

**Problema número uno, en palabras del cliente:** dar los presupuestos más rápido, en forma y que se vean más profesionales [DC §2]. El cotizador en tablet es el corazón del sistema.

**Quién desarrolla:** HummingX BI. Todavía no está constituida como sociedad: su marca solo aparece como nombre comercial, nunca con razón social ni datos fiscales [DC §1.1], [RN-21].

## 2. Dentro del alcance (confirmado)

| Módulo | Nombre | Resumen |
|---|---|---|
| M1 | Catálogo | Productos y servicios limpios, con tipo, unidad de cobro, precio y datos fiscales |
| M2 | Cotizador | En mostrador y a domicilio, PDF generado en el dispositivo y envío por WhatsApp |
| M3 | Órdenes de trabajo | Seguimiento por estatus, anticipo, saldo y garantía documentada |
| M4 | Mostrador | Venta rápida, ticket térmico de 80 mm y corte de caja por cajero |
| M5 | Clientes | Ficha, historial y derechos sobre datos personales |
| M6 | Cuentas por cobrar | Saldos pendientes de trabajos, recordatorio por WhatsApp |
| M7 | Reportes | Las cinco vistas que pidió Luis: sumas, conteos y comparativos |
| M8 | Usuarios y roles | Usuarios, PIN, dispositivos registrados y bitácora |
| M9 | Legal | Aviso de privacidad y términos dentro del sistema |
| M10 | Facturación | CFDI 4.0 desde el sistema y portal público de autofacturación para los clientes de ZAMMIR |

**Transversales** (detalle en `REQUERIMIENTOS.md` y `REQUERIMIENTOS_NO_FUNCIONALES.md`):
- Aplicación web instalable (PWA) para tablets Android, que funciona sin internet para cotizar, vender, cobrar, avanzar órdenes e imprimir tickets [DC §3.1, §9].
- Experiencia para usuarios sin experiencia con sistemas: navegación en el orden del trabajo, "Primeros pasos", ayuda contextual y estados siempre visibles [DC §12.2].
- Configuración del negocio en una tabla (nombre, logo, textos legales, folios, porcentajes) para poder reutilizar el sistema más adelante [DC §10.8].

## 3. Detrás de un interruptor (pendiente de confirmar)

Se construyen apagados por defecto, activables por configuración [DC §3.2].

| Clave | Función | Estado |
|---|---|---|
| P1 | Portal de seguimiento para el cliente final: aceptar cotización en línea, línea de tiempo del trabajo | Se le pregunta al cliente en el cuestionario de acuerdos, y **Juanito todavía no aprueba el diseño del portal de la demo** (PD-13). **Ojo:** el comprobante con folio y QR de autofacturación **sí es obligatorio**, porque lo necesita la facturación |
| P2 | Existencias de piezas estándar (puertas y ventanas) con alerta de mínimo | Propuesta de HummingX; la demo lo mostró (PD-14) |

## 4. Fuera del alcance

No construir, aunque parezca natural [DC §3.3, §7.8]:

- Inventario completo: compras a proveedor, mermas, costos, descuento de material por m², valuación.
- Terminal de pago con tarjeta y cobros en línea.
- Cajón de dinero, escáner de código de barras, monitor táctil y computadora [DC §8.1].
- Más dispositivos de los acordados (dos tablets y una impresora térmica).
- Aplicación nativa iOS o Android. Solo aplicación web.
- Integraciones con contabilidad, ERP o marketplaces.
- API oficial de WhatsApp Business. Solo enlaces y el menú de compartir del dispositivo.
- Crédito a clientes. "Cuentas por cobrar" es solo el saldo de un trabajo.
- Inteligencia de negocio predictiva.
- Multi-sucursal.
- Factura global, contabilidad, **complemento de pago, notas de crédito complejas y cualquier otro complemento del CFDI**. El contador de ZAMMIR se encarga de lo que no sea emitir facturas desde el sistema.
- **Impresión en impresora tamaño carta** [ADR-0005]. Los PDF tamaño carta (cotización, comprobante) se generan y se comparten por WhatsApp, pero no se imprimen desde el sistema. Lo único que se imprime es el ticket térmico de 80 mm. *El documento fuente sí la incluía (§8.1, §8.5); ver [ADR-0017].*

## 5. Equipo y dispositivos

El cliente compra el equipo directamente; HummingX recomienda modelos y configura [DC §8.1].

| Elemento | Detalle | Fuente |
|---|---|---|
| 2 tablets Android | Una fija en el mostrador y otra para visitas a domicilio. Android 13 o superior con Google Play y Chrome actualizado; **nunca iPad**, porque iOS no permite imprimir por Bluetooth desde una página web. Candidata: Samsung Galaxy Tab A11+ 5G (SM-X236B, 11 pulgadas, Bluetooth 5, datos 5G) | [DC §8.1, §8.2, §10.6], PD-16 |
| 1 impresora térmica de 80 mm | Con **Bluetooth de baja energía (BLE)** utilizable desde el navegador. Candidata: Epson serie TM-m30; modelo exacto por definir tras la prueba de concepto | [DC §8.1, §8.3], PD-15 |
| Plan de datos de la tablet de campo | Lo paga ZAMMIR | [DC §8.6] |
| Internet del local | Telmex, único proveedor | [DC §1.2, §9] |
| Usuarios previstos | 2 administradores y 3 a 5 empleados, sin límite técnico | [DC RF-M8-04] |

La idea detrás: si ZAMMIR abre otro mostrador, solo agrega una tablet y una impresora térmica, sin computadora [DC §8.1].

## 6. Calendario comprometido

- Arranque: 23 de octubre de 2026.
- Entrega: del 23 de noviembre al 1 de diciembre de 2026.
- El lunes 16 de noviembre es feriado [DC §13].
- La fecha se recorre si se atrasa el anticipo, la aprobación de requerimientos, el catálogo y precios reales, la llegada del equipo, el CSD y el PAC, o las decisiones de P1 y P2 [DC §1.3, §13].

Ver `docs/ROADMAP.md` para fases y sprints.

## 7. Entregables finales

Según [DC §13]:
- Sistema en producción.
- Repositorio y documentación técnica.
- Registro de decisiones (`DECISIONES.md`).
- Manual de usuario y manual de soporte (Juanito los edita).
- Plan de respaldo.
- Accesos entregados a Juanito por un canal seguro.
- Capacitación presencial de 3 horas en tres sesiones: una con Luis, una con Ricardo y una con el equipo de mostrador.
- Acta de entrega.
