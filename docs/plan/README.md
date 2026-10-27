# Plan de construcción

> Este es el plan que sigue cualquier agente de IA (Claude Code u otro) para construir el sistema ZAMMIR, fase por fase.
> Se apoya en `docs/producto/` (qué se construye) y `DECISIONES.md` (qué ya se decidió). Si algo aquí contradice esos documentos, **ganan ellos** y se corrige este plan.
>
> Alcance de este plan: el documento de construcción completo [DC §0–§17], recibido el 27 de octubre de 2026. Donde el documento choca con una decisión posterior de Juanito, manda el ADR ([ADR-0017]).
>
> **Calendario en revisión (PD-34):** las fechas de abajo son las del plan actual. El documento propone otro reparto con una semana completa de estabilización; ver opciones en `docs/ROADMAP.md`.

## Fases

| Fase | Archivo | Tipo | Fechas | Estado |
|---|---|---|---|---|
| 0 | [Cierre de contexto](fase-00-cierre-de-contexto.md) | Documentación | 26–27 oct | Lista para cerrar: falta que Juanito confirme pendientes y calendario |
| 1 | [Documentación base](fase-01-documentacion-base.md) | Documentación | 26 oct | Completa |
| 2 | [Arquitectura](fase-02-arquitectura.md) | Documentación | 26–30 oct | En curso (borradores en `docs/arquitectura/`) |
| 3 | [Backlog](fase-03-backlog.md) | Planeación | 30–31 oct | Pendiente |
| 4 | [Sprint 0 — Fundaciones](fase-04-sprint-0-fundaciones.md) | Código | 29 oct – 1 nov | Pendiente |
| 5 | [Sprint 1 — Núcleo, catálogo, clientes y usuarios](fase-05-sprint-1-nucleo-catalogo-usuarios.md) | Código | 2 – 8 nov | Pendiente |
| 6 | [Sprint 2 — Cotizador sin conexión](fase-06-sprint-2-cotizador.md) | Código | 9 – 15 nov | Pendiente |
| 7 | [Sprint 3 — Órdenes de trabajo y mostrador](fase-07-sprint-3-ordenes-mostrador.md) | Código | 16 – 22 nov (16 nov feriado) | Pendiente |
| 8 | [Sprint 4 — Cobranza, reportes, legal y facturación](fase-08-sprint-4-cobranza-reportes-legal-facturacion.md) | Código | 23 – 29 nov | Pendiente |
| 9 | [Sprint 5 — Salida a producción](fase-09-sprint-5-salida-a-produccion.md) | Entrega | 30 nov – 1 dic | Pendiente |

**Antes de cualquier fase de código, lee [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md).** Define la arquitectura objetivo, cómo se aplica SOLID, la estrategia de pruebas y la compuerta de calidad que toda fase debe pasar.

## La regla de avance

**Una fase no termina hasta que pasa su compuerta de calidad. La siguiente no empieza antes.**

- Si una prueba falla, un total no cuadra al centavo o un criterio de aceptación no se cumple, el sprint **no se cierra**: se corrige primero.
- No se desactivan, se saltan ni se marcan como "pendientes" pruebas para lograr que la compuerta pase.
- Si el tiempo no alcanza, **se recorta alcance, nunca calidad**: Juanito decide qué historia se mueve al siguiente sprint o a "después de la entrega", y la decisión se registra en `PENDIENTES.md`. Una historia a medias no se fusiona.

## Cómo trabaja un agente en cada fase

1. Lee `CLAUDE.md`, este README, los principios y el archivo de la fase.
2. Revisa `PENDIENTES.md` por si algo de la fase sigue sin definir.
3. Presenta un plan breve: historias en orden, riesgos, qué pruebas va a escribir primero. **Espera aprobación de Juanito.**
4. Trabaja historia por historia, cada una en su rama, con pruebas primero (rojo → verde → refactor).
5. Al terminar cada historia: compuerta local (lint, tipos, pruebas), Pull Request, integración continua en verde, fusión.
6. Al terminar la fase: corre la compuerta completa de la fase, llena su lista de salida y reporta el resultado.

## Trazabilidad: requerimiento → fase

Cada requerimiento de `REQUERIMIENTOS.md` y `REQUERIMIENTOS_NO_FUNCIONALES.md` tiene una fase dueña. Si se mueve, se actualiza esta tabla.

| Fase | Requerimientos |
|---|---|
| 4 — Sprint 0 | RF-M8-02 (dispositivos), RF-M8-03 (tabla de bitácora), configuración del negocio e interruptores P1 y P2 · RF-UX-01 (navegación), RF-UX-06 (indicador de conexión), RF-UX-08, RF-UX-09 · Prueba de concepto de impresión [ADR-0018] |
| 5 — Sprint 1 | RF-M1-01, RF-M1-02, RF-M1-03, RF-M1-04, RF-M1-05, RF-M1-06 · RF-M5-01, RF-M5-04, RF-M5-05 · RF-M8-01, RF-M8-03 (pantalla), RF-M8-04 · RF-M4-08 · RF-M9-01 (aviso versionado), RF-M9-03 · RF-UX-07 |
| 6 — Sprint 2 | RF-M2-01, RF-M2-02, RF-M2-03, RF-M2-04, RF-M2-05, RF-M2-06, RF-M2-07, RF-M2-09, RF-M2-10 · RF-UX-05 · RF-UX-06 (operaciones pendientes) |
| 7 — Sprint 3 | RF-M3-01, RF-M3-02, RF-M3-03, RF-M3-04, RF-M3-05, RF-M3-06, RF-M3-07, RF-M3-08 · RF-M2-08 · RF-M4-01, RF-M4-02, RF-M4-03, RF-M4-04, RF-M4-05, RF-M4-06, RF-M4-07 · RF-M5-02, RF-M5-03 · RF-M1-07 (P2) · RF-UX-06 (impresora) · Impresión en tres capas [ADR-0018] |
| 8 — Sprint 4 | RF-M6-01, RF-M6-02, RF-M6-03, RF-M6-04 · RF-M7-01, RF-M7-02, RF-M7-03, RF-M7-04, RF-M7-05, RF-M7-06 · RF-M9-01 (enlaces), RF-M9-02, RF-M9-04, RF-M9-05 · RF-M10-01 a RF-M10-21 · RF-UX-02, RF-UX-03, RF-UX-04, RF-UX-10 · RF-M2-11 (P1) |
| 9 — Sprint 5 | Producción, datos reales, aceptación y capacitación · RNF-21 (respaldos), RNF-22 (exportación), RNF-37 (dominio) |
| Todas las fases de código | RNF-01 a RNF-20 y RNF-23 a RNF-36: se verifican en la compuerta de cada fase ([00 §5](00-principios-de-ingenieria.md)) |

### Pruebas de aceptación → fase

Los recorridos E1 a E10 de `docs/calidad/PRUEBAS_DE_ACEPTACION.md` se automatizan en el sprint indicado allí y se repiten completos en el Sprint 5.

## Formato de cada archivo de fase

Todas las fases siguen la misma estructura para que un agente sepa dónde buscar:

1. **Objetivo** — en una o dos frases.
2. **Entra si** — condiciones para empezar.
3. **Alcance** — requerimientos y reglas que cubre.
4. **Fuera de esta fase** — para no adelantarse.
5. **Diseño** — piezas a construir y cómo aplica SOLID.
6. **Entregables** — lo que debe existir al terminar.
7. **Pruebas obligatorias** — casos mínimos; se pueden agregar más, nunca quitar.
8. **Compuerta de salida** — la lista que debe quedar en verde.
9. **Riesgos y pendientes** — qué puede salir mal y qué PD afecta.
