# Backlog

> Fase 3 del plan (`docs/plan/fase-03-backlog.md`). Convierte los requerimientos en historias listas para construir, ordenadas por sprint según el calendario de [ADR-0019] (opción A).
> **Estado: borrador para aprobación de Juanito.** Todavía no hay Issues en GitHub: se crean después de aprobarlo.
> Si una historia contradice `REQUERIMIENTOS.md`, `REGLAS_DE_NEGOCIO.md` o un ADR, ganan ellos y se corrige la historia.

## Qué hay aquí

| Archivo | Contenido |
|---|---|
| [`EPICAS.md`](EPICAS.md) | Épicas por módulo y técnicas |
| [`SPRINT-0.md`](SPRINT-0.md) a [`SPRINT-5.md`](SPRINT-5.md) | Historias de cada sprint, con criterios de aceptación |
| [`DESPUES_DE_LA_ENTREGA.md`](DESPUES_DE_LA_ENTREGA.md) | Lo que quedó fuera de la entrega [ADR-0019] y las propuestas sin aprobar |
| [`TRAZABILIDAD.md`](TRAZABILIDAD.md) | Requerimiento → historias; recorridos E1 a E10 → historias |
| [`CAPACIDAD.md`](CAPACIDAD.md) | Carga por sprint contra capacidad, y opciones si no cabe |

## Formato de una historia

```
### S1-03 · Título corto · talla · N h
Como <administrador | cajero | cliente final | Juanito (desarrollador)>
quiero <acción>
para <beneficio>
- **Requerimientos:** RF-… · **Reglas:** RN-… · **Pendientes:** PD-… (qué se hace mientras tanto)
- **Criterios de aceptación:**
  - Dado …, cuando …, entonces ….
```

- El **identificador** es `S<sprint>-<número>`. Al crear los Issues se conserva en el título.
- Cada criterio de aceptación se vuelve **al menos una prueba automática**, salvo los marcados *(manual)* que van en la lista firmada de tablet [`00-principios` §4.4].
- Una historia con **⛔** depende de una respuesta pendiente y no entra a un sprint hasta tener valor acordado o configurable (Definition of Ready, `CONTRIBUTING.md`).
- Las historias de P1 y P2 no están en los sprints: ver `DESPUES_DE_LA_ENTREGA.md`.

## Estimación

Tallas, en **horas de trabajo conjunto** (Juanito + agente de IA, incluidas pruebas, revisión y despliegue a pruebas):

| Talla | Horas | Ejemplo |
|---|---|---|
| XS | 1 | Un ajuste, una utilidad pequeña con sus pruebas |
| S | 2 | Una pantalla sencilla o un caso de uso con pocas reglas |
| M | 4 | Un caso de uso con varias reglas y su pantalla |
| L | 8 | Una pieza grande (motor, PDF, adaptador, portal) |
| XL | — | No existe: se divide |

**Estas cifras son estimaciones mías, no mediciones.** No hay datos de la velocidad real de Juanito con este stack. Se recalibran al cerrar el Sprint 0 y cada sprint después. Es esperable un error de ±50 % por historia.

## Capacidad supuesta

Juanito indicó el 27 de octubre de 2026 que puede dedicar **3 horas al día de construcción junto con el agente**. No dijo cuántos días por semana; se calcula en dos escenarios (detalle y cuentas en `CAPACIDAD.md`):

- **Base:** solo días hábiles (15 h por semana completa).
- **Optimista:** los siete días (21 h por semana completa).

## Reglas de armado

1. Todo `RF-Mx-yy` y `RF-UX-yy` está cubierto por al menos una historia (`TRAZABILIDAD.md`).
2. Los recorridos E1 a E10 tienen su historia de aceptación en el sprint de `PRUEBAS_DE_ACEPTACION.md`, y se repiten completos en el Sprint 5.
3. Cada sprint termina con una historia de **cierre**: compuerta común de `00-principios` §5.2, lista de tablet firmada, documentación al día, revisión y retrospectiva.
4. Las historias que dependen de [POR DEFINIR] usan el valor configurable de `PENDIENTES.md` y citan su `PD`. No se inventa ningún valor [CLAUDE.md regla 1].
5. Las propuestas `PP-xx` no aprobadas **no** están en los sprints.
6. Nada se desactiva ni se baja de umbral para que una historia "pase" [CLAUDE.md regla 11].
