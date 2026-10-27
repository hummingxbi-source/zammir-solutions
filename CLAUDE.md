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
| Cómo se llama cada cosa | `docs/producto/GLOSARIO.md` |
| Qué no está definido todavía | `docs/producto/PENDIENTES.md` |
| Qué ya se decidió | `DECISIONES.md` |
| Fases y sprints | `docs/ROADMAP.md` |
| Cómo se trabaja en el repositorio | `CONTRIBUTING.md` |
| Arquitectura | `docs/arquitectura/` (en construcción, Fase 2) |

## Reglas que no se rompen

1. **No inventes reglas de negocio.** Si algo está marcado [POR DEFINIR] o aparece en `PENDIENTES.md`, hazlo configurable y avisa. Nunca supongas un valor.
2. **Disciplina de alcance.** No construyas funciones que no estén en `REQUERIMIENTOS.md`. Si crees que falta algo, agrégalo como propuesta en `PENDIENTES.md`.
3. **Dinero en centavos, nunca flotantes.** Los precios incluyen IVA. Toda la aritmética de dinero e impuestos vive en un solo módulo del dominio [RN-05, RN-06, RN-07].
4. **Nada contable se borra.** Ventas, órdenes, pagos y facturas solo se cancelan con motivo y rastro [RN-18].
5. **Fechas en UTC, se muestran en `America/Mexico_City`.** Semana de lunes a domingo [RN-17].
6. **Interfaz en español de México** con el vocabulario del oficio. Nada de "checkout", "carrito" ni "Punto de Venta". Ver palabras prohibidas en el glosario.
7. **Sin secretos ni datos reales.** Nunca subas claves (usa variables de entorno). Nunca uses ni escribas datos reales de clientes de ZAMMIR en código, pruebas o documentación [ADR-0010].
8. **Las decisiones se registran.** Si tomas una decisión técnica o de negocio, escribe su ADR en `docs/decisiones/` y agrégala al índice de `DECISIONES.md`.
9. **No reutilices código de la demo** (`HummingX-BI/formularios`) [ADR-0002].
10. **Antes de una tarea grande, presenta un plan breve** (qué, en qué orden, qué riesgos) y espera aprobación.

## Cómo citar

- `[DC §5.6]`: documento de construcción original, en `docs/contexto/`.
- `[RN-07]`: regla de negocio.
- `RF-M2-05`: requerimiento funcional.
- `[ADR-0004]`: decisión registrada.
- `PD-04`: pendiente.

Cita la fuente en comentarios de código solo cuando la regla no sea obvia, por ejemplo: `// RN-16: folio definitivo asignado al sincronizar`.

## Stack

React + Vite + TypeScript estricto (PWA), Supabase (Postgres, Auth, Edge Functions) y Vercel [ADR-0003]. Los detalles se definen en la Fase 2.
