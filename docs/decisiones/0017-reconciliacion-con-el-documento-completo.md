# ADR-0017: Reconciliación con el documento de construcción completo

- **Estado:** Aceptada en lo que repite decisiones ya tomadas por Juanito. El calendario queda abierto (PD-34)
- **Fecha:** 2026-10-27
- **Decide:** Juanito

## Contexto

El 27 de octubre llegó el documento de construcción completo (§0 a §17), que resuelve PD-01. El documento lo escribió el agente que hizo la demo, **antes** de varias decisiones que Juanito tomó el 26 de octubre. Algunas recomendaciones del documento chocan con esas decisiones. Hay que dejar por escrito cuál manda, para que ningún agente "corrija" el plan siguiendo el documento.

Regla general: **manda la decisión más reciente de Juanito**, registrada en su ADR. Y por encima de todo, el contrato firmado y su anexo técnico [DC §15].

## Decisión

| # | El documento dice | Manda | Por qué |
|---|---|---|---|
| 1 | Impresora tamaño carta con Mopria para cotizaciones y comprobantes (§8.1, §8.5, RF-M2-06, E10) | **[ADR-0005]: fuera del alcance.** Los PDF carta se generan y se comparten por WhatsApp | Decisión explícita de Juanito; todo se envía por WhatsApp |
| 2 | Reutilizar los tokens de diseño exactos y los componentes de la demo (§11.1, §12.1) | **[ADR-0002]: construir desde cero.** La guía visual general del §12.1 se usa como punto de partida del sistema de diseño nuevo (PD-35) | Juanito decidió no reutilizar la demo; el código no cumple las reglas de dinero ni de folios |
| 3 | Next.js (§11.1) | **[ADR-0003]: React + Vite.** El propio documento permite alternativas justificadas | La parte crítica corre en la tablet sin conexión; el renderizado en servidor no aporta |
| 4 | Probar el PAC en la primera semana (§0 regla 3, §13 Fase 0) | **[ADR-0007]: el PAC real se conecta al final**, con el riesgo aceptado y mitigado. PD-05 se adelanta a "antes del Sprint 4" | Decisión explícita de Juanito |
| 5 | Importes "numéricos con 2 decimales" (§11.3) | **[ADR-0015]: enteros en centavos.** El §5.6 permite cualquiera de las dos | Elimina errores de redondeo |
| 6 | Nombres de tablas en español (`negocio_config`, §11.3) | **[ADR-0009]: código en inglés**, traducido en el glosario | Decisión explícita de Juanito |
| 7 | IVA incluido "por definir" (§5.6, §15 punto 3) | **[ADR-0004]: los precios incluyen IVA** | Confirmado por Juanito |
| 8 | Plan de fases y fechas del §13 | **Abierto (PD-34).** Se conserva el plan de `docs/ROADMAP.md` hasta que Juanito decida | El plan del documento deja una semana de estabilización que el plan actual no tiene |

**Lo que el documento agrega y se adopta tal cual**, sin conflicto:
- M10 completo (§7) → `REQUERIMIENTOS.md` (RF-M10-01 a RF-M10-21) y reglas RN-24 a RN-28.
- Estrategia de impresión de tickets en tres capas (§8.3) y la prueba de concepto (§8.4) → [ADR-0018].
- Funcionamiento sin internet (§9) y requerimientos no funcionales (§10) → `REQUERIMIENTOS_NO_FUNCIONALES.md`.
- Lecciones de experiencia de usuario (§12.2) → RF-UX-01 a RF-UX-10, RN-21 a RN-23.
- Recorridos de aceptación E1 a E10 (§14) → `docs/calidad/PRUEBAS_DE_ACEPTACION.md`, con E10 ajustado por el punto 1.
- Pendientes (§15) → `PENDIENTES.md`, cruzados uno por uno.
- Riesgos (§16) → `RIESGOS.md`.
- Entidades recomendadas (§11.3) → insumo para `docs/arquitectura/MODELO_DE_DATOS.md` (Fase 2).

## Consecuencias

- `docs/contexto/README.md` resume estos conflictos para quien lea el documento fuente.
- Si un agente encuentra en el documento algo que contradice un ADR, sigue el ADR y, si cree que el ADR está mal, lo propone en `PENDIENTES.md`; no lo cambia por su cuenta.
- La arquitectura de la Fase 2 debe absorber lo nuevo de §7 a §11 (lista en `docs/plan/fase-02-arquitectura.md`).
