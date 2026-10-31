# Registro de decisiones

Índice de las decisiones técnicas y de negocio del proyecto. Cada una tiene su archivo en `docs/decisiones/` [ADR-0001].

**Antes de proponer un cambio, revisa si ya se decidió.** Una decisión aceptada no se edita: se reemplaza con una nueva.

| ADR | Decisión | Estado | Fecha |
|---|---|---|---|
| [0001](docs/decisiones/0001-registrar-decisiones-con-adr.md) | Registrar las decisiones como ADR | Aceptada | 2026-10-26 |
| [0002](docs/decisiones/0002-construir-desde-cero.md) | Construir desde cero; la demo solo es referencia | Aceptada | 2026-10-26 |
| [0003](docs/decisiones/0003-stack-base.md) | Stack base: React + Vite + TypeScript, Supabase y Vercel | Aceptada en lo general | 2026-10-26 |
| [0004](docs/decisiones/0004-precios-con-iva-incluido.md) | Los precios del catálogo incluyen IVA | Aceptada (redondeo: ver 0011) | 2026-10-26 |
| [0005](docs/decisiones/0005-sin-impresora-carta.md) | Impresión tamaño carta fuera del alcance | Aceptada | 2026-10-26 |
| [0006](docs/decisiones/0006-reglas-de-precio-configurables.md) | Reglas de precio configurables por producto | Aceptada | 2026-10-26 |
| [0007](docs/decisiones/0007-facturacion-detras-de-interfaz.md) | Facturación detrás de una interfaz; PAC real al final | Aceptada | 2026-10-26 |
| [0008](docs/decisiones/0008-prueba-de-impresion-y-despliegue-continuo.md) | Prueba de impresión en semana 1 y despliegue continuo a pruebas | Aceptada | 2026-10-26 |
| [0009](docs/decisiones/0009-idioma-del-codigo.md) | Idioma del código | Aceptada | 2026-10-26 |
| [0010](docs/decisiones/0010-repositorios-privados.md) | Repositorios privados y sin datos reales | Aceptada | 2026-10-26 |
| [0011](docs/decisiones/0011-redondeo-y-desglose-de-iva.md) | Redondeo y desglose de IVA | Aceptada | 2026-10-26 |
| [0012](docs/decisiones/0012-motor-de-sincronizacion.md) | Motor de sincronización sin conexión | **Aceptada** (validada por ADR-0023) | 2026-10-26 |
| [0013](docs/decisiones/0013-autenticacion-por-dispositivo-y-pin.md) | Autenticación por dispositivo y PIN (PIN sin conexión) | Aceptada | 2026-10-26 |
| [0014](docs/decisiones/0014-estructura-del-repositorio-y-herramientas.md) | Estructura del repositorio y herramientas | Aceptada | 2026-10-26 |
| [0015](docs/decisiones/0015-convenciones-del-modelo-de-datos.md) | Convenciones del modelo de datos | **Propuesta** | 2026-10-26 |
| [0016](docs/decisiones/0016-protocolo-de-operaciones-y-folios.md) | Protocolo de operaciones y asignación de folios | **Aceptada** (validada por ADR-0023) | 2026-10-26 |
| [0017](docs/decisiones/0017-reconciliacion-con-el-documento-completo.md) | Reconciliación con el documento de construcción completo: qué decisión manda | Aceptada (calendario abierto: PD-34) | 2026-10-27 |
| [0018](docs/decisiones/0018-impresion-de-tickets-en-tres-capas.md) | Impresión de tickets en tres capas (Web Bluetooth, impresión de Android, compartir) | Aceptada como estrategia | 2026-10-27 |
| [0019](docs/decisiones/0019-calendario-plan-actual-con-recortes.md) | Calendario: se mantiene el plan actual de sprints, con recortes desde ahora | Aceptada | 2026-10-27 |
| [0020](docs/decisiones/0020-importacion-del-catalogo-todo-o-nada.md) | Importación del catálogo: todo o nada, primero CSV | Aceptada | 2026-10-30 |
| [0021](docs/decisiones/0021-clientes-alta-directa-desde-la-tablet-transitoria.md) | La tablet da de alta clientes directo en la base (transitorio hasta el Sprint 2) | Sustituida por ADR-0024 | 2026-10-30 |
| [0022](docs/decisiones/0022-catalogo-en-la-tablet-indexeddb.md) | Catálogo en la tablet: IndexedDB con Dexie y cambios por número | Aceptada (propuesta) | 2026-10-30 |
| [0023](docs/decisiones/0023-receptor-de-operaciones-en-dos-capas.md) | Receptor de operaciones en dos capas y validación de la sincronización | Aceptada (propuesta) | 2026-10-30 |
| [0024](docs/decisiones/0024-clientes-como-operacion-y-folio-reconciliado.md) | Clientes como operación en cola, réplica por número de cambio y folio reconciliado | Aceptada (propuesta) | 2026-10-31 |
| [0025](docs/decisiones/0025-ordenes-pagos-y-fotos-en-la-tablet.md) | Órdenes de trabajo, pagos que solo se agregan y fotos de medición | Aceptada (propuesta) | 2026-10-31 |

Plantilla para una nueva decisión: [`docs/decisiones/0000-plantilla.md`](docs/decisiones/0000-plantilla.md).
