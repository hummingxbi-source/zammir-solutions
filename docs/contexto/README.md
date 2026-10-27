# Contexto de origen

Esta carpeta guarda los documentos fuente tal como los entregó el equipo. **No se editan**: si algo cambia, el cambio se registra en `docs/producto/` o en `docs/decisiones/` y se cita el documento fuente.

| Archivo | Qué es | Estado |
|---|---|---|
| `documento-construccion-v1.txt` | Documento de construcción v1.0 (finales de octubre de 2026), redactado por el agente que construyó la demo. Secciones §0 a §17 | **Completo** desde el 27 de octubre de 2026 (PD-01 resuelto). El 26 de octubre se había recibido una copia cortada en la §6 |

## Diferencias entre la copia cortada y la completa

En las secciones que ya estaban, la copia completa cambia tres frases:

| Sección | Antes | Ahora |
|---|---|---|
| §1.3 | El cliente "está respondiendo" el cuestionario de acuerdos | El cuestionario "se le envía" para obtener datos fiscales, firmantes, fechas y preferencias |
| §3.2 P1 | El cliente "quiere verlo antes de decidir" | Se le pregunta en el cuestionario de acuerdos y **Juanito todavía no aprueba el diseño del portal de la demo** |
| §4 | Son 3 empleados "y uno de ellos también instala" | Son 3 empleados que cobran "y ellos mismos instalan" |

## Partes del documento que ya no aplican

Algunas recomendaciones del documento fueron sustituidas por decisiones posteriores de Juanito. La lista completa, con su motivo, está en [ADR-0017](../decisiones/0017-reconciliacion-con-el-documento-completo.md). En resumen: no se imprime en tamaño carta (§8.1, §8.5), no se reutiliza la demo (§12.1), el stack es Vite y no Next.js (§11.1) y el PAC real se conecta al final (§0 regla 3, §13).

**Si el documento contradice al contrato firmado o a su anexo técnico, manda lo firmado** y se avisa a Juanito [DC §15].

## Cómo citar

En el resto de la documentación se cita así: `[DC §5.6]` = Documento de construcción, sección 5.6. Las decisiones tomadas después se citan con su ADR: `[ADR-0003]`.

## Demo previa

Existe una demo visual (React + Vite, datos inventados, sin servidor) en `HummingX-BI/formularios`, carpeta `demos/zammir-demo`. **No se reutiliza su código** [ADR-0002]. Solo sirve como referencia de lo que el cliente ya vio. Todo lo que aparece en ella es ficticio: nombres, precios, códigos, folios `OT-2024-xxx` y la garantía de 6 meses [DC §12.1].
