# ADR-0019: Calendario — se mantiene el plan actual de sprints, con recortes desde ahora

- **Estado:** Aceptada
- **Fecha:** 2026-10-27
- **Decide:** Juanito
- **Resuelve:** PD-34. Completa el punto 8 de [ADR-0017], que dejaba el calendario abierto

## Contexto

El plan de `docs/ROADMAP.md` y el plan del documento de construcción [DC §13] no coinciden. La diferencia importante es que el documento deja una semana completa de estabilización y entrega (23 nov – 1 dic) y el plan actual deja dos días (30 nov – 1 dic). Las dos opciones y sus argumentos están en `docs/ROADMAP.md`.

## Decisión

Se adopta la **opción A: mantener el plan actual de sprints (S0 a S5) y recortar desde ahora.**

- **Fuera de la entrega** (pasan a "después de la entrega") salvo que Luis los active y Juanito lo apruebe: **P1** (portal de seguimiento), **P2** (existencias de piezas estándar) y el **recorrido guiado con globos de ayuda** [RF-UX-04].
- **Se conservan** en el Sprint 4: la pantalla de "Primeros pasos" y el botón "¿Por dónde empiezo?" [RF-UX-02, RF-UX-03].
- La producción vacía, el dominio y los manuales se preparan **durante el Sprint 4**, para que el Sprint 5 solo cargue datos reales, pruebe y capacite.
- La entrega se acuerda para el **final de la ventana (1 de diciembre)**. Hay que avisarle a Luis desde ahora.

## Consecuencias

- No hay colchón. Si el cliente se atrasa con el catálogo, los datos fiscales, el equipo o el PAC, la fecha se recorre [R3, R15].
- La regla de avance se mantiene: si no alcanza, se recorta alcance con aprobación de Juanito, nunca calidad [CLAUDE.md regla 11].
- La Fase 3 (backlog) puede empezar: cada historia cae en el sprint que ya tiene `docs/ROADMAP.md`.
- Si Luis activa P1 o P2, se decide qué se mueve para que quepan.
