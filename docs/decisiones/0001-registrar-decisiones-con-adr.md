# ADR-0001: Registrar las decisiones como ADR

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

El documento de construcción pide un `DECISIONES.md` con cada decisión técnica o de negocio, su fecha y su motivo [DC §0 regla 4]. Un solo archivo largo se vuelve difícil de leer y de citar, y genera conflictos al editarlo.

## Decisión

- Cada decisión vive en su propio archivo en `docs/decisiones/`, numerado (`0001-...md`), con la plantilla `0000-plantilla.md`.
- `DECISIONES.md`, en la raíz, es el índice: una línea por decisión con número, título, estado y fecha.
- Una decisión aceptada no se edita: si cambia, se escribe una nueva que la reemplaza y la anterior se marca "Reemplazada por ADR-YYYY".

## Consecuencias

- El código, las pruebas y los documentos citan decisiones como `[ADR-0004]`.
- Los agentes de IA consultan el índice antes de proponer algo que ya se decidió.
