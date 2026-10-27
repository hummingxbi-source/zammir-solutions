# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado
- Documentación base de la Fase 1: alcance, reglas de negocio, requerimientos, glosario, pendientes, hoja de ruta y guías del repositorio.
- Decisiones ADR-0001 a ADR-0010.
- Plan de construcción en `docs/plan/`: principios de ingeniería, estrategia de pruebas, compuertas de calidad y una guía por cada fase (0 a 9).
- Pendiente PD-25 (medición del metro lineal).
- Fase 2: ADR-0011 (redondeo) y ADR-0012 (sincronización) aceptadas; ADR-0013 (autenticación, aceptada) y ADR-0014 (estructura y herramientas) como propuestas; casos de oro de dinero; borradores de `AUTENTICACION.md` y `ARCHITECTURE.md`.
- Borradores de `MODELO_DE_DATOS.md` (con trazabilidad requerimiento → entidad) y `SINCRONIZACION.md`; ADR-0015 y ADR-0016 como propuestas.
- PD-21 a PD-24 (valores de sesión de administrador y de intentos de PIN).

- Documento de construcción completo (§0 a §17) en `docs/contexto/`; resuelve PD-01.
- M10 completo (RF-M10-01 a RF-M10-21), experiencia de usuario (RF-UX-01 a RF-UX-10) y reglas RN-21 a RN-28.
- `REQUERIMIENTOS_NO_FUNCIONALES.md` (RNF-01 a RNF-37), `RIESGOS.md` (R1 a R15) y `docs/calidad/PRUEBAS_DE_ACEPTACION.md` (E1 a E10).
- ADR-0017 (reconciliación con el documento completo) y ADR-0018 (impresión de tickets en tres capas).
- Pendientes PD-26 a PD-35, incluido el calendario (PD-34).
- Referencia de la demo (`docs/producto/DEMO_REFERENCIA.md`) y revisión de negocio con reglas propuestas (`docs/producto/REVISION_DE_NEGOCIO.md`), con lo que Juanito contó el 27 de octubre. Preguntas para Luis PD-36 a PD-47 y propuestas PP-01 a PP-19 en `PENDIENTES.md`. Riesgos R16 y R17.

- Backlog de la Fase 3 en `docs/backlog/` (143 historias en los sprints S0 a S5, trazabilidad y análisis de capacidad). Borrador a la espera de la aprobación de Juanito.

### Cambiado
- Calendario decidido (PD-34): se mantiene el plan actual de sprints con recortes desde ahora [ADR-0019]. ADR-0014 actualizada: la impresión de tickets ya no está "sin elegir" [ADR-0018].
- ADR-0009 (idioma del código) aceptada; PD-18 resuelto.
- Plan de fases actualizado con el documento completo: prueba de concepto de impresión, M10 en el Sprint 4, entrega en el Sprint 5, feriado del 16 de noviembre y lista de lo que la arquitectura debe absorber (Fase 2).
- `ALCANCE.md`, `GLOSARIO.md`, `PENDIENTES.md` y `SECURITY.md` al día con el documento completo.
