# Instrucciones para agentes de IA

Este archivo es lo primero que lee cualquier agente de IA que trabaje en este repositorio. Es corto a propósito: aquí están las reglas y dónde está cada cosa.

## Qué es este proyecto

Sistema de gestión para **ZAMMIR**, una vidriería de un solo local en Otumba, Estado de México. Lo desarrolla **HummingX BI**. Responsable: Juanito, único desarrollador.

El corazón del sistema es un **cotizador en tablet que funciona sin internet**. Además: catálogo, órdenes de trabajo, mostrador con corte de caja, clientes, cuentas por cobrar, reportes, usuarios, legal y facturación CFDI.

## Lee antes de trabajar

| Para | Lee |
|---|---|
| Qué se construye y qué no | `docs/producto/ALCANCE.md` |
| Reglas de dinero, folios, fechas, auditoría | `docs/producto/REGLAS_DE_NEGOCIO.md` |
| Qué hace cada módulo | `docs/producto/REQUERIMIENTOS.md` |
| Sin internet, seguridad, rendimiento, accesibilidad | `docs/producto/REQUERIMIENTOS_NO_FUNCIONALES.md` |
| Cómo se llama cada cosa | `docs/producto/GLOSARIO.md` |
| Qué no está definido todavía | `docs/producto/PENDIENTES.md` |
| **Dudas para Luis (una sola ronda)** | `docs/producto/CUESTIONARIO_LUIS.md`: cada duda de negocio nueva se agrega ahí con su referencia a `PENDIENTES.md`; no se le pregunta a Luis por separado |
| Riesgos del proyecto | `docs/producto/RIESGOS.md` |
| Recorridos que deben pasar antes de entregar (E1 a E10) | `docs/calidad/PRUEBAS_DE_ACEPTACION.md` |
| Qué ya se decidió | `DECISIONES.md` |
| **Qué construir en cada fase, con sus pruebas y compuertas** | `docs/plan/` — empieza por su README y `00-principios-de-ingenieria.md` |
| Historias por sprint y su trazabilidad | `docs/backlog/` (borrador hasta que Juanito lo apruebe) |
| Fases y sprints (resumen) | `docs/ROADMAP.md` |
| Cómo se trabaja en el repositorio | `CONTRIBUTING.md` |
| Arquitectura | `docs/arquitectura/` (en construcción, Fase 2) |

## Reglas que no se rompen

1. **No inventes reglas de negocio.** Si algo está marcado [POR DEFINIR] o aparece en `PENDIENTES.md`, hazlo configurable y avisa. Nunca supongas un valor.
2. **Disciplina de alcance.** No construyas funciones que no estén en `REQUERIMIENTOS.md`. Si crees que falta algo, agrégalo como propuesta en `PENDIENTES.md`.
3. **Dinero en centavos, nunca flotantes.** Los precios incluyen IVA. Toda la aritmética de dinero e impuestos vive en un solo módulo del dominio [RN-05, RN-06, RN-07].
4. **Nada contable se borra.** Ventas, órdenes, pagos y facturas solo se cancelan con motivo y rastro [RN-18].
5. **Fechas en UTC, se muestran en `America/Mexico_City`.** Semana de lunes a domingo [RN-17].
6. **Interfaz en español de México** con el vocabulario del oficio. Nada de "checkout", "carrito" ni "Punto de Venta". Ver palabras prohibidas en el glosario.
7. **Sin secretos ni datos reales.** Nunca subas claves (usa variables de entorno). Nunca uses ni escribas datos reales de clientes de ZAMMIR en código, pruebas o documentación [ADR-0010]. Ningún agente de IA tiene acceso a datos de producción [RNF-19]. El CSD de ZAMMIR se sube directo al PAC; nunca pasa por el código [RF-M10-02].
8. **Las decisiones se registran.** Si tomas una decisión técnica o de negocio, escribe su ADR en `docs/decisiones/` y agrégala al índice de `DECISIONES.md`.
9. **No reutilices código de la demo** (`HummingX-BI/formularios`) [ADR-0002].
10. **Antes de una tarea grande, presenta un plan breve** (qué, en qué orden, qué riesgos) y espera aprobación.
11. **No se avanza con algo en rojo.** Una fase no se cierra hasta que su compuerta de calidad está en verde. Nunca se desactivan pruebas ni se bajan umbrales para que pase. Si no alcanza el tiempo, se recorta alcance con aprobación de Juanito, nunca calidad (`docs/plan/README.md`).
12. **Si el documento fuente contradice un ADR, manda el ADR** ([ADR-0017]). Si crees que el ADR está mal, propónlo en `PENDIENTES.md`; no lo cambies por tu cuenta.

## Cómo citar

- `[DC §5.6]`: documento de construcción original, en `docs/contexto/`.
- `[RN-07]`: regla de negocio.
- `RF-M2-05`: requerimiento funcional.
- `[ADR-0004]`: decisión registrada.
- `PD-04`: pendiente.

Cita la fuente en comentarios de código solo cuando la regla no sea obvia, por ejemplo: `// RN-16: folio definitivo asignado al sincronizar`.

## Stack

React + Vite + TypeScript estricto (PWA), Supabase (Postgres, Auth, Edge Functions) y Vercel [ADR-0003]. Los detalles se definen en la Fase 2.
