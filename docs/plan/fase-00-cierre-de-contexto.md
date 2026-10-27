# Fase 0 — Cierre de contexto

- **Tipo:** documentación
- **Fechas:** 26–27 de octubre de 2026
- **Estado:** en curso

## Objetivo

Que no quede ninguna pregunta abierta sin registrar: todo lo que falta saber está en `PENDIENTES.md` con responsable, fecha y qué se usa mientras tanto.

## Entra si

- Se recibió el documento de construcción, aunque esté incompleto. ✅

## Alcance

1. Recibir las secciones faltantes del documento de construcción (PD-01): §7 Facturación y PAC, §8 Impresión, §12 Demo, §15 Pendientes y detalle de M10.
2. Guardarlas en `docs/contexto/` sin editar.
3. Extraer lo nuevo hacia los documentos de producto:
   - M10 completo en `REQUERIMIENTOS.md`.
   - Reglas nuevas en `REGLAS_DE_NEGOCIO.md` con el siguiente número `RN-XX`.
   - Términos nuevos en `GLOSARIO.md`.
   - La lista de §15 cruzada contra `PENDIENTES.md`: lo que ya esté se marca con su fuente; lo nuevo se agrega.
4. Si la §8 describe el método de impresión esperado, actualizar el plan de la prueba de impresión del Sprint 0.
5. Confirmar con Juanito los pendientes que bloquean la Fase 2: PD-18 (idioma del código).

## Fuera de esta fase

- Decisiones de arquitectura (Fase 2).
- Cualquier código.

## Entregables

- `docs/contexto/` con el documento completo.
- `REQUERIMIENTOS.md` con M10 completo.
- `PENDIENTES.md` revisado contra la §15.
- ADRs nuevos si el documento trae decisiones.

## Verificación

No lleva pruebas automáticas. Se verifica con esta revisión cruzada:

- [ ] Cada `[POR DEFINIR]` del documento fuente aparece en `PENDIENTES.md`.
- [ ] Cada requerimiento del documento fuente aparece en `REQUERIMIENTOS.md` con su identificador original.
- [ ] Ninguna regla o requerimiento de `docs/producto/` carece de fuente (`[DC §x]` o `[ADR-xxxx]`).
- [ ] Las referencias cruzadas (`RN-`, `RF-`, `ADR-`, `PD-`) apuntan a algo que existe. Se puede comprobar con una búsqueda de texto.

## Compuerta de salida

- [ ] Documento fuente completo guardado.
- [ ] Revisión cruzada completa.
- [ ] Juanito confirmó la lista de pendientes.

## Riesgos y pendientes

- Si las secciones faltantes cambian algo ya documentado, gana la decisión más reciente de Juanito y se registra como ADR.
- PD-01, PD-18.
