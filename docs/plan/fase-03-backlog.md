# Fase 3 — Backlog

- **Tipo:** planeación
- **Fechas:** 30–31 de octubre de 2026

## Objetivo

Convertir los requerimientos en historias de usuario listas para construir, ordenadas por sprint.

## Entra si

- Fase 2 aprobada.
- Calendario decidido (PD-34): opción A [ADR-0019].

## Alcance

1. **Épicas:** una por módulo (M1 a M10), más épicas técnicas: fundaciones, sincronización, autenticación, sistema de diseño.
2. **Historias:** cada requerimiento `RF-Mx-yy` se descompone en una o más historias. Formato:

   ```
   Como <cajero | administrador | cliente final>
   quiero <acción>
   para <beneficio>

   Requerimientos: RF-M2-02
   Reglas: RN-02, RN-04, RN-05
   Pendientes que afectan: PD-02 (se usa regla básica)

   Criterios de aceptación:
   - Dado <contexto>, cuando <acción>, entonces <resultado verificable>.
   ```

3. **Criterios de aceptación** verificables. Cada uno se volverá al menos una prueba.
4. **Estimación** en puntos o tallas, y comparación contra la capacidad de una sola persona por semana.
5. **Asignación a sprints** según los archivos de fase 4 a 9. Si no cabe, se avisa a Juanito **antes** de empezar, no a mitad del sprint.
6. Registro en GitHub: Issues con etiquetas de módulo y sprint, y un tablero de GitHub Projects.

## Fuera de esta fase

- Código.

## Compuerta de salida

- [ ] Cada `RF` de M1 a M10 y cada `RF-UX` está cubierto por al menos una historia. Tabla de trazabilidad RF → historias.
- [ ] Cada recorrido E1 a E10 tiene su historia de prueba de aceptación en el sprint indicado en `PRUEBAS_DE_ACEPTACION.md`.
- [ ] Cada historia cumple la Definition of Ready de `CONTRIBUTING.md`.
- [ ] La carga de cada sprint no excede la capacidad estimada, o Juanito aprobó el riesgo.
- [ ] Las historias de P1 y P2 están identificadas y al final de su sprint, por si hay que moverlas.

## Riesgos y pendientes

- El calendario tiene como mucho un sprint de colchón (ver `docs/ROADMAP.md`). Esta fase es el momento de detectar si no cabe.
- El calendario decidido (opción A, [ADR-0019]) define en qué sprint cae cada historia. P1, P2 y el recorrido guiado no entran al backlog de la entrega salvo que Luis los active.
