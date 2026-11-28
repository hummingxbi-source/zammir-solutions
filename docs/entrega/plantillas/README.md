# Plantillas del expediente de entrega

> El expediente que recibe ZAMMIR son **cinco documentos** y un detalle opcional [ADR-0047]. Todos van en una carpeta con portada, índice y folios, y en PDF.
> Aquí viven las **plantillas sin datos reales**. La versión llenada (nombres completos, montos, números de serie, datos de soporte y firmas) se prepara en la carpeta local `privado/`, que git ignora, y se exporta a PDF desde ahí [CLAUDE.md regla 7, ADR-0045].

| Folio | Documento | Plantilla | Se firma | Cuándo |
|---|---|---|---|---|
| HMX-ZAM-01 | Contrato de prestación de servicios | *(se redacta al final; lo revisa un abogado)* | Luis y Ricardo, y dos socios de HummingX [ADR-0049] | Lunes 30 |
| HMX-ZAM-02 | Acta de entrega y aceptación, con anexos A a E | [`../ACTA_DE_ENTREGA.md`](../ACTA_DE_ENTREGA.md) | Luis y Ricardo, y dos socios de HummingX [ADR-0049]; cada anexo, el día que toca | Anexo A: sábado 28 · Anexo B: en cada sesión · Resto: lunes 30 |
| HMX-ZAM-03 | Informe técnico de entrega | [`INFORME_TECNICO_DE_ENTREGA.md`](INFORME_TECNICO_DE_ENTREGA.md) | No | Cifras corridas el mismo día |
| HMX-ZAM-04 | Manual de usuario | [`../../manuales/MANUAL_DE_USUARIO.md`](../../manuales/MANUAL_DE_USUARIO.md) | No | — |
| HMX-ZAM-05 | Guías rápidas por rol | [`GUIAS_RAPIDAS.md`](GUIAS_RAPIDAS.md) | No | Se plastifican |
| ✦ | Constancia de capacitación por persona (opcional) | [`CONSTANCIA_DE_CAPACITACION.md`](CONSTANCIA_DE_CAPACITACION.md) | HummingX | Lunes 30 |

**Anexos del acta (HMX-ZAM-02):** A, constancia de pruebas de aceptación · B, capacitación · C, entrega de accesos · D, entrega de equipo · E, aviso de privacidad y su acuse.

**Internos, no se entregan:** el orden del día, la minuta de cada día y la hoja de hallazgos ([`INTERNOS_DE_LA_ENTREGA.md`](INTERNOS_DE_LA_ENTREGA.md)), el manual de soporte y la guía de operación.
