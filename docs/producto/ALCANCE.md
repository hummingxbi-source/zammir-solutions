# Alcance del sistema ZAMMIR

> Fuente principal: Documento de construcción v1 [DC §3]. Cambios posteriores, con su ADR.
> Regla de oro: **lo que no está aquí, no se construye.** Si crees que falta o sobra algo, anótalo en `PENDIENTES.md` como propuesta [DC §0 regla 5].

## 1. Para quién es

**Cliente:** Soluciones en Vidrio y Aluminio ZAMMIR, vidriería de un solo local en Otumba de Gómez Farías, Estado de México [DC §1.2].

- Dueño: Luis Ramírez Rodríguez. Socio: Ricardo.
- 3 empleados que cobran en el mostrador, una sola caja a la vez.
- Hoy no usan ningún sistema ni equipo de cómputo [DC §2].

**Problema número uno, en palabras del cliente:** dar los presupuestos más rápido, en forma y que se vean más profesionales [DC §2]. El cotizador en tablet es el corazón del sistema.

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
| M10 | Facturación | CFDI y portal de autofacturación para los clientes de ZAMMIR |

**Transversal:** aplicación web instalable (PWA) para tablets Android, que funciona sin internet para capturar cotizaciones y ventas [DC §3.1].

El detalle de cada módulo está en `REQUERIMIENTOS.md`.

## 3. Detrás de un interruptor (pendiente de confirmar con el cliente)

Se construyen apagados por defecto, activables por configuración [DC §3.2].

| Clave | Función | Estado |
|---|---|---|
| P1 | Portal de seguimiento para el cliente final: aceptar cotización en línea, línea de tiempo del trabajo | El cliente "quiere verlo antes de decidir". **Ojo:** el comprobante con folio y QR de autofacturación **sí es obligatorio**, porque lo necesita la facturación |
| P2 | Existencias de piezas estándar (puertas y ventanas) con alerta de mínimo | Propuesta de HummingX; la demo lo mostró |

## 4. Fuera del alcance

No construir, aunque parezca natural [DC §3.3]:

- Inventario completo: compras a proveedor, mermas, costos, descuento de material por m², valuación.
- Terminal de pago con tarjeta y cobros en línea.
- Cajón de dinero.
- Más dispositivos de los acordados (dos tablets).
- Aplicación nativa iOS o Android.
- Integraciones con contabilidad, ERP o marketplaces.
- API oficial de WhatsApp Business. Solo enlaces y el menú de compartir del dispositivo.
- Crédito a clientes. "Cuentas por cobrar" es solo el saldo de un trabajo.
- Inteligencia de negocio predictiva.
- Multi-sucursal.
- Factura global y contabilidad. El contador de ZAMMIR se encarga.
- **Impresión en impresora tamaño carta** [ADR-0005]. Los PDF tamaño carta (cotización, comprobante) se generan y se comparten por WhatsApp, pero no se imprimen desde el sistema. Lo único que se imprime es el ticket térmico de 80 mm.

## 5. Equipo y dispositivos

| Elemento | Detalle | Fuente |
|---|---|---|
| Dispositivos | 2 tablets Android y 1 impresora térmica inalámbrica de 80 mm | [DC §3.3], acuerdo con Juanito |
| Internet del local | Telmex | [DC §1.2] |
| Usuarios previstos | 2 administradores y 3 a 5 empleados, sin límite técnico | [DC RF-M8-04] |

## 6. Calendario comprometido

- Arranque: 23 de octubre de 2026.
- Entrega: del 23 de noviembre al 1 de diciembre de 2026.
- La fecha se recorre si no llegan a tiempo el anticipo, la aprobación de requerimientos o los insumos del cliente, sobre todo el catálogo [DC §1.3].

Ver `docs/ROADMAP.md` para fases y sprints.
