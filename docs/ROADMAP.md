# Hoja de ruta

> **Borrador.** Se afina en la Fase 3, al armar el backlog. Fechas en hora de México.
> Metodología: Scrum en solitario, por fases y sprints de **1 semana**. Al cerrar cada sprint, el sistema queda desplegado en pruebas y funcionando, nunca a medias [DC §0 regla 2].

## Fechas fijas

- Arranque del proyecto: 23 de octubre de 2026 [DC §1.3].
- Ventana de entrega: 23 de noviembre al 1 de diciembre de 2026 [DC §1.3].
- La fecha se recorre si se atrasan el anticipo, la aprobación de requerimientos o el catálogo [DC §1.3].

**El calendario es apretado:** cabe con un sprint de colchón como máximo. Cualquier cosa que no sea indispensable para la entrega se mueve a "después de la entrega" en lugar de recorrer la fecha.

## Fases previas al código

| Fase | Qué incluye | Resultado | Fechas |
|---|---|---|---|
| 0. Cierre de contexto | Documento completo, lista de pendientes con responsables | `PENDIENTES.md` al día | 26–27 oct |
| 1. Documentación base | Alcance, reglas, glosario, requerimientos, decisiones, guías del repositorio | Esta carpeta `docs/` | 26–28 oct |
| 2. Arquitectura | Capas y módulos, modelo de datos, sincronización sin conexión y folios, autenticación por dispositivo y PIN, dinero y redondeo, entornos, pruebas | `docs/arquitectura/`, `docs/calidad/` y ADRs | 28–30 oct |
| 3. Backlog | Épicas por módulo, historias con criterios de aceptación, Definition of Ready y de Done | Backlog en GitHub (Issues y Projects) | 30–31 oct |

## Sprints de construcción

| Sprint | Fechas | Objetivo |
|---|---|---|
| S0 | 29 oct – 1 nov | Repositorio listo (estructura, linter, pruebas, CI, despliegue a pruebas). **Prueba de impresión en tablet real** [ADR-0008]. Autenticación de administradores y registro de dispositivo |
| S1 | 2 – 8 nov | Núcleo del dominio: dinero e IVA [ADR-0004], reglas de precio [ADR-0006]. Catálogo con importación CSV, clientes, usuarios con PIN y bitácora |
| S2 | 9 – 15 nov | Cotizador completo: captura en tablet, PDF en el dispositivo, envío por WhatsApp, modo sin conexión y folios temporales |
| S3 | 16 – 22 nov | Órdenes de trabajo con anticipo, saldo y garantía. Mostrador: venta, ticket térmico y corte de caja |
| S4 | 23 – 29 nov | Cuentas por cobrar, reportes, legal, facturación con adaptador simulado y conexión al PAC elegido [ADR-0007] |
| S5 | 30 nov – 1 dic | Salida a producción: dominio, PAC en producción, carga del catálogo real, pruebas de aceptación con Luis y capacitación |

## Después de la entrega (fuera del calendario)

- Ajustes de las pruebas de aceptación.
- P1 y P2 si el cliente los activa.
- Soporte y mantenimiento según el contrato.

## Documentos de cierre que faltan

Se escriben antes de la entrega:
- Manual corto de uso y guion de capacitación, pensados para usuarios sin experiencia con sistemas [DC §2].
- Plan de pruebas de aceptación con el cliente.
- Plan de respaldo y recuperación.
- Plan de soporte posterior a la entrega.
