# ADR-0047: Expediente de la entrega en cinco documentos

- **Estado:** Aceptada
- **Fecha:** 2026-11-25
- **Decide:** Juanito (HummingX BI), a propuesta de Claude
- **Sustituye:** [ADR-0045] punto 8 (expediente de diez documentos) y la letra del anexo de equipo de su punto 7 (pasa de C a D)

## Contexto

El [ADR-0045] fijó un expediente de diez documentos. Al revisarlo, a Juanito le pareció abrumador para Luis. Muchas hojas sueltas se sienten menos serias que pocos documentos bien armados, y varias se firmaban por separado.

## Decisión

El expediente de la entrega tiene **cinco documentos** y un detalle opcional. Todos se entregan en una carpeta con portada, índice y folios, y en PDF:

| Folio | Documento | Qué junta | Se firma |
|---|---|---|---|
| HMX-ZAM-01 | **Contrato de prestación de servicios** | — | Sí |
| HMX-ZAM-02 | **Acta de entrega y aceptación** | Anexos: A, constancia de pruebas de aceptación; B, capacitación (un apartado por sesión); C, entrega de accesos; D, entrega de equipo; E, aviso de privacidad y su acuse | Sí, cada anexo el día que toca |
| HMX-ZAM-03 | **Informe técnico de entrega** | Ficha técnica, calidad y seguridad (con cifras corridas el mismo día), y plan de continuidad | No |
| HMX-ZAM-04 | **Manual de usuario** | — | No |
| HMX-ZAM-05 | **Guías rápidas por rol** | Una hoja para Administrador y otra para Cajero / vendedor, con bienvenida y datos de soporte al reverso | No |
| ✦ | *Constancia de capacitación por persona* (opcional) | Detalle de marca, tipo diploma | Firma HummingX |

- Solo se firman **dos documentos**: el contrato y el acta. Todo lo demás que requiere firma va como anexo del acta.
- Las plantillas viven en el repositorio sin datos reales: el acta en `docs/entrega/ACTA_DE_ENTREGA.md` y las demás en `docs/entrega/plantillas/`.
- Las versiones llenadas van en la carpeta local `privado/`, que git ignora [ADR-0045].
- El contrato se redacta al final.

## Consecuencias

- El plan maestro (§7), el prompt del siguiente agente y el guion de los tres días cambian a cinco documentos.
- El anexo A se firma el sábado. El anexo B, al terminar cada sesión de capacitación. El resto del acta y el contrato, el lunes.
- Las cifras del informe técnico se vuelven a correr el día de la entrega. La plantilla no lleva cifras fijas.

## Alternativas consideradas

- **Diez documentos** [ADR-0045]: se veían abrumadores y obligaban a firmar varias veces.
- **Quitar las constancias de capacitación:** Juanito las conservó como opcionales, porque no son trámite sino un detalle de marca.
