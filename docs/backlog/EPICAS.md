# Épicas

Una por módulo del negocio (M1 a M10) y las técnicas que los sostienen. El código de la épica se usa en las etiquetas de GitHub (`epica:fund`, `epica:m2`…).

## Técnicas

| Código | Épica | Qué cubre | Sprint(s) |
|---|---|---|---|
| `fund` | Fundaciones | Monorepo, TypeScript estricto, lint, reglas de dependencia, núcleo compartido (`Result`, `Clock`, `IdGenerator`), raíz de composición | 0 |
| `ci` | Calidad y CI | Herramientas de prueba, umbrales, pipeline, escaneo de secretos, compuerta que se prueba sola | 0 |
| `env` | Entornos y despliegue | Supabase local, pruebas (staging), producción, variables, respaldos, monitoreo | 0, 5 |
| `ds` | Sistema de diseño y experiencia | PWA, variables de diseño, componentes táctiles, textos centralizados, navegación, Primeros pasos, estados | 0, 4 |
| `core` | Núcleo del dominio | Dinero, medidas, IVA, reglas de precio, permisos | 1 |
| `sync` | Sincronización y folios | Cola de salida, servidor idempotente, folios temporales y definitivos, conflictos | 2 |
| `print` | Impresión | Prueba de concepto, `TicketPrinter` con tres adaptadores, plantillas | 0, 3 |
| `doc` | Documentos de entrega | Manuales, plan de aceptación, guía de operación, soporte, capacitación, acta | 4, 5 |

## Por módulo

| Código | Épica | Requerimientos | Sprint(s) |
|---|---|---|---|
| `m1` | Catálogo | RF-M1-01 a RF-M1-06 (RF-M1-07 queda en "después de la entrega") | 1 |
| `m2` | Cotizador | RF-M2-01 a RF-M2-10 (RF-M2-11 queda en "después de la entrega") | 2, 3 |
| `m3` | Órdenes de trabajo | RF-M3-01 a RF-M3-08 | 3 |
| `m4` | Mostrador | RF-M4-01 a RF-M4-08 | 1, 3 |
| `m5` | Clientes | RF-M5-01 a RF-M5-05 | 1, 3 |
| `m6` | Cuentas por cobrar | RF-M6-01 a RF-M6-04 | 4 |
| `m7` | Reportes | RF-M7-01 a RF-M7-06 | 4 |
| `m8` | Usuarios, dispositivos y bitácora | RF-M8-01 a RF-M8-04 | 0, 1 |
| `m9` | Legal | RF-M9-01 a RF-M9-05 | 1, 4 |
| `m10` | Facturación y autofacturación | RF-M10-01 a RF-M10-21 | 4 |

## Etiquetas para GitHub (cuando se creen los Issues)

- `epica:<código>` — una por épica.
- `sprint:s0` … `sprint:s5` y `sprint:despues` — hito (milestone) con el mismo nombre.
- `talla:xs|s|m|l`.
- `bloqueada:pd-xx` — la historia espera una respuesta pendiente.
- `tablet` — requiere prueba manual en la tablet real.
- `propuesta` — viene de una propuesta `PP-xx` aprobada.
