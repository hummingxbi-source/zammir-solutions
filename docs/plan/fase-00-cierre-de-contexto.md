# Fase 0 — Cierre de contexto

- **Tipo:** documentación
- **Fechas:** 26–27 de octubre de 2026
- **Estado:** lista para cerrar. Falta que Juanito confirme la lista de pendientes y decida el calendario (PD-34)

## Objetivo

Que no quede ninguna pregunta abierta sin registrar: todo lo que falta saber está en `PENDIENTES.md` con responsable, fecha y qué se usa mientras tanto.

## Entra si

- Se recibió el documento de construcción. ✅ Completo desde el 27 de octubre.

## Alcance y resultado

| # | Tarea | Resultado |
|---|---|---|
| 1 | Recibir las secciones faltantes (PD-01) | ✅ Recibidas §7 a §17; PD-01 resuelto (PR-05) |
| 2 | Guardarlas en `docs/contexto/` sin editar | ✅ `documento-construccion-v1.txt` completo; diferencias con la copia cortada en `docs/contexto/README.md` |
| 3 | Extraer lo nuevo hacia los documentos de producto | ✅ M10 (RF-M10-01 a 21) y experiencia de usuario (RF-UX-01 a 10) en `REQUERIMIENTOS.md`; RN-21 a RN-28; `REQUERIMIENTOS_NO_FUNCIONALES.md` (RNF-01 a 37); `RIESGOS.md`; glosario; `SECURITY.md` |
| 4 | Cruzar la §15 contra `PENDIENTES.md` | ✅ Los 18 puntos tienen su PD o su resolución; nuevos PD-26 a PD-35 |
| 5 | Registrar los choques entre el documento y las decisiones ya tomadas | ✅ [ADR-0017] |
| 6 | Actualizar el plan de la prueba de impresión con la §8 | ✅ [ADR-0018] y Sprint 0 |
| 7 | Confirmar PD-18 (idioma del código) | ✅ Resuelto (PR-04) [ADR-0009] |

## Verificación

- [x] Cada `[POR DEFINIR]` del documento fuente aparece en `PENDIENTES.md`.
- [x] Cada requerimiento del documento fuente aparece en `REQUERIMIENTOS.md` o `REQUERIMIENTOS_NO_FUNCIONALES.md` con su fuente.
- [x] Ninguna regla o requerimiento carece de fuente (`[DC §x]` o `[ADR-xxxx]`).
- [x] Las referencias cruzadas (`RN-`, `RF-`, `RNF-`, `ADR-`, `PD-`) apuntan a algo que existe. Comprobado con una búsqueda de texto automática.

## Compuerta de salida

- [x] Documento fuente completo guardado.
- [x] Revisión cruzada completa.
- [ ] Juanito confirmó la lista de pendientes.
- [ ] Juanito decidió el calendario (PD-34), porque cambia el backlog de la Fase 3.

## Riesgos y pendientes

- Si algo del documento contradice el contrato firmado, manda lo firmado [DC §15].
- PD-34 (calendario).
