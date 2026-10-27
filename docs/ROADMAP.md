# Hoja de ruta

> **Resumen.** El detalle de cada fase (alcance, diseño, pruebas obligatorias y compuerta de salida) está en [`docs/plan/`](plan/README.md).
> **Borrador.** Se afina en la Fase 3, al armar el backlog. Fechas en hora de México.
> Metodología: Scrum en solitario, por fases y sprints de **1 semana**. Al cerrar cada sprint, el sistema queda desplegado en pruebas y funcionando, nunca a medias [DC §0 regla 2].

## Fechas fijas

- Arranque del proyecto: 23 de octubre de 2026 [DC §1.3].
- Ventana de entrega: 23 de noviembre al 1 de diciembre de 2026 [DC §1.3].
- **Lunes 16 de noviembre: feriado** [DC §13].
- La fecha se recorre si se atrasa el anticipo, la aprobación de requerimientos, el catálogo y precios reales, la llegada del equipo, el CSD y el PAC, o las decisiones de P1 y P2 [DC §1.3, §13].

**El calendario es apretado:** cabe con un sprint de colchón como máximo. Cualquier cosa que no sea indispensable para la entrega se mueve a "después de la entrega" en lugar de recorrer la fecha.

## Fases previas al código

| Fase | Qué incluye | Resultado | Fechas |
|---|---|---|---|
| 0. Cierre de contexto | Documento completo, lista de pendientes con responsables | `PENDIENTES.md` al día | 26–27 oct ✅ |
| 1. Documentación base | Alcance, reglas, glosario, requerimientos, decisiones, guías del repositorio | Esta carpeta `docs/` | 26–28 oct |
| 2. Arquitectura | Capas y módulos, modelo de datos, sincronización sin conexión y folios, autenticación por dispositivo y PIN, dinero y redondeo, entornos, pruebas | `docs/arquitectura/`, `docs/calidad/` y ADRs | 26–30 oct (en curso) |
| 3. Backlog | Épicas por módulo, historias con criterios de aceptación, Definition of Ready y de Done | Backlog en GitHub (Issues y Projects) | 30–31 oct |

## Sprints de construcción

| Sprint | Fechas | Objetivo |
|---|---|---|
| S0 | 29 oct – 1 nov | Repositorio listo (estructura, linter, pruebas, CI, despliegue a pruebas). **Prueba de concepto de impresión en tablet real** [ADR-0018]. Autenticación de administradores y registro de dispositivo. Navegación base |
| S1 | 2 – 8 nov | Núcleo del dominio: dinero e IVA [ADR-0004], reglas de precio [ADR-0006]. Catálogo con importación CSV, clientes, usuarios con PIN y bitácora |
| S2 | 9 – 15 nov | Cotizador completo: captura en tablet, PDF en el dispositivo, envío por WhatsApp, modo sin conexión y folios temporales |
| S3 | 16 – 22 nov (16 feriado) | Órdenes de trabajo con anticipo, saldo y garantía. Mostrador: venta, ticket térmico en tres capas y corte de caja |
| S4 | 23 – 29 nov | Cuentas por cobrar, reportes, legal, facturación (desde el sistema y portal) con adaptador simulado y PAC en pruebas [ADR-0007], "Primeros pasos" y botón "¿Por dónde empiezo?". Preparar producción vacía, dominio y manuales [ADR-0019] |
| S5 | 30 nov – 1 dic | Salida a producción: dominio, PAC en producción, carga del catálogo real, E1 a E10 con el equipo real, capacitación (3 sesiones de 3 horas) y acta de entrega |

## Calendario: decidido, opción A (PD-34, [ADR-0019])

Se mantiene el plan actual y se recorta desde ahora. Abajo queda la comparación que se tuvo a la vista.

El documento de construcción propone otro reparto [DC §13]. La diferencia importante: **el documento deja una semana completa para estabilizar y entregar; el plan actual deja dos días.**

| Semana | Plan actual | Plan del documento [DC §13] |
|---|---|---|
| 28 oct – 1 nov | S0: fundaciones y prueba de impresión | Fundación y riesgos: lo mismo, más evaluación del PAC y pruebas en su entorno de pruebas |
| 2 – 8 nov | S1: núcleo de dinero y precios, catálogo, clientes, usuarios con PIN | Catálogo, clientes **y cotizador completo sin conexión** |
| 9 – 15 nov | S2: cotizador sin conexión y motor de sincronización | Órdenes, pagos, garantía, mostrador, corte, PIN |
| 16 – 22 nov (16 feriado) | S3: órdenes y mostrador | Cuentas por cobrar, reportes, facturación en pruebas, legal, respaldos |
| 23 nov – 1 dic | S4: cobranza, reportes, legal y facturación (23–29) · S5: producción y entrega (30 nov – 1 dic) | **Estabilización y entrega**: equipo real, catálogo real, PAC real, manuales, capacitación y acta |

**Opciones:**

- **A. Mantener el plan actual y recortar desde ahora.** P1, P2 y el recorrido guiado pasan a "después de la entrega" salvo que Luis los active; producción vacía, dominio y manuales se preparan durante el S4; la entrega se acuerda para el final de la ventana (1 dic). *A favor:* respeta la carga semanal que pide la calidad exigida (100% de cobertura y mutación en dinero y folios). *En contra:* sin colchón; cualquier atraso del cliente recorre la fecha.
- **B. Adoptar el plan del documento.** *A favor:* una semana completa para entregar y absorber sorpresas del equipo, el PAC o el cliente. *En contra:* la semana del 2 al 8 nov junta el núcleo de dinero, el catálogo, el cotizador y el motor de sincronización, que es lo más difícil del proyecto, para una sola persona y con la compuerta de calidad completa.

**Decisión: A** [ADR-0019], por la recomendación original: B concentra el riesgo técnico mayor en una sola semana y la regla de avance impide cerrar un sprint a medias. **Pendiente:** avisar a Luis desde ahora que la entrega es al final de la ventana (1 dic) y que P1, P2 y el recorrido guiado quedan fuera de la entrega salvo que los active.

## Después de la entrega (fuera del calendario)

- Ajustes de las pruebas de aceptación.
- P1 y P2 si el cliente los activa.
- Soporte y mantenimiento según el contrato.

## Documentos de cierre que faltan

Se escriben antes de la entrega [DC §13]:
- Manual de usuario y guion de capacitación, pensados para usuarios sin experiencia con sistemas [DC §2].
- Manual de soporte para HummingX.
- Plan de pruebas de aceptación con el cliente (base: `docs/calidad/PRUEBAS_DE_ACEPTACION.md`).
- Plan de respaldo y recuperación.
- Plan de soporte posterior a la entrega.
- Acta de entrega.
