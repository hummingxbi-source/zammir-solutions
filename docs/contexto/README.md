# Contexto de origen

Esta carpeta guarda los documentos fuente tal como los entregó el equipo. **No se editan**: si algo cambia, el cambio se registra en `docs/producto/` o en `docs/decisiones/` y se cita el documento fuente.

| Archivo | Qué es | Estado |
|---|---|---|
| `documento-construccion-v1.txt` | Documento de construcción v1.0 (finales de octubre de 2026), redactado por el agente que construyó la demo | **Incompleto**: llega hasta la §6 (M9). Faltan §7 Facturación y PAC, §8 Impresión, la demo (§12), los pendientes (§15) y el detalle de M10 |

## Cómo citar

En el resto de la documentación se cita así: `[DC §5.6]` = Documento de construcción, sección 5.6. Las decisiones tomadas después en conversación con Juanito se citan con su ADR: `[ADR-0003]`.

## Demo previa

Existe una demo visual (React + Vite, datos inventados, sin servidor) en `HummingX-BI/formularios`, carpeta `demos/zammir-demo`. **No se reutiliza su código** [ADR-0002]. Solo sirve como referencia de lo que el cliente ya vio.
