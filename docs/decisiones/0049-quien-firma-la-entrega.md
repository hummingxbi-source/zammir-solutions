# ADR-0049: Quién firma los documentos de la entrega

- **Estado:** Aceptada
- **Fecha:** 2026-11-28
- **Decide:** Juanito (HummingX BI)
- **Sustituye:** [ADR-0045] punto 2, en lo de "por HummingX firman sus tres socios"

## Contexto

El [ADR-0045] decía que por HummingX BI firmaban sus tres socios, y las plantillas del acta dejaban un renglón para "Luis" por ZAMMIR y tres para HummingX. Al revisar el expediente con el formato nuevo, Juanito definió quiénes representan a cada parte.

## Decisión

1. **Por ZAMMIR firman sus dos administradores:** Luis y Ricardo.
2. **Por HummingX BI firman dos socios:** los mismos que imparten la capacitación.
3. Firman el **acta de entrega** (sección 8 y anexos A, C, D y E), la **minuta** de los documentos internos y, cuando se redacte, el **contrato**. En la capacitación (anexo B), cada administrador firma su sesión como quien recibe, y los dos de HummingX como quienes imparten. La sesión del mostrador la firma la persona capacitada.
4. Los **nombres completos** solo van en las versiones llenadas de la carpeta `privado/`, que git ignora. Las plantillas del repositorio usan marcadores: `[Representante 1 de ZAMMIR]`, `[Representante 2 de ZAMMIR]`, `[Representante 1 de HummingX BI]` y `[Representante 2 de HummingX BI]` [ADR-0010, CLAUDE.md regla 7].

## Consecuencias

- Cada hoja de firmas lleva dos renglones por parte.
- El plan maestro, el README de las plantillas y el prompt del siguiente agente dicen quién firma según esta decisión.
