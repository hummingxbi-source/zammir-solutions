# Medición del Sprint 0

> Opción D de `CAPACIDAD.md`: medir las primeras historias reales para calibrar las tallas antes de decidir recortes o fecha.
> **Estado:** plantilla. Se llena durante el Sprint 0.

## Qué se mide

Por cada historia de calibración:

| Dato | Cómo se obtiene |
|---|---|
| Estimado (h) | La talla del backlog |
| Tiempo de reloj, del primer commit a la fusión | Marcas de tiempo de git y del Pull Request (objetivas) |
| Horas con Juanito presente | Las declara Juanito al cerrar cada historia |
| Horas de revisión de Juanito | Las declara Juanito |
| Intentos de integración continua hasta el verde | Historial del Pull Request |
| Notas | Qué costó más de lo esperado y por qué |

Con eso se calcula, por talla, la razón **real / estimado**, y se recalcula `CAPACIDAD.md`.

## Reglas de la medición

1. **No se baja la calidad para ir más rápido.** Las compuertas, los umbrales y las pruebas se mantienen [CLAUDE.md regla 11]. Si una historia "sale rápido" porque se omitió algo, no cuenta como dato.
2. Se mide solo lo terminado: pasó la integración continua y cumple todos sus criterios.
3. Las historias con hardware (S0-09, S0-16, S0-18) se miden aparte: dependen de la tablet y la impresora.
4. No se inventa un umbral de "aceptable". Se reportan los números y Juanito decide.

## Historias de calibración (en este orden)

| Historia | Talla | Estimado (h) | Reloj | Con Juanito (h) | Revisión (h) | Intentos CI | Real / estimado | Notas |
|---|---|---|---|---|---|---|---|---|
| S0-02 Lint, formato y reglas de capas | S | 2 | | | | | | |
| S0-01 Estructura y TypeScript estricto | M | 4 | | | | | | |
| S0-05 Supabase local y migraciones | M | 4 | | | | | | |
| S0-03 Herramientas de prueba y umbrales | L | 8 | | | | | | |
| S0-04 Integración continua | L | 8 | | | | | | |
| S0-06 Despliegue a pruebas | M | 4 | | | | | | |
| **Total** | | **30** | | | | | | |

## Resultado

Al terminar la tabla:
1. Se calcula la razón real / estimado por talla.
2. Se recalculan las horas de los sprints y se actualiza `CAPACIDAD.md`.
3. Se presenta a Juanito con las opciones B (recortar), C (mover la fecha) o una combinación, para que decida y, si afecta el contrato, hable con Luis.
