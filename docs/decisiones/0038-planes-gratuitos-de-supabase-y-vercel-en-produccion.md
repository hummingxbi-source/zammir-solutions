# ADR-0038: Producción en los planes gratuitos de Supabase y Vercel; dominio y proveedor de facturas contratados

- **Estado:** Aceptada
- **Fecha:** 2026-11-14
- **Decide:** Juanito
- **Modifica:** [ADR-0003] (solo la línea "producción usa planes de pago"); concreta PD-20 y PD-32

## Contexto

[ADR-0003] dejó dicho que desarrollo y pruebas podían usar los planes gratuitos y que **producción usaría planes de pago**, por dos límites de los planes gratuitos:

- **Vercel (Hobby):** solo admite uso personal no comercial; el uso comercial requiere Pro. Fuente: [Fair Use Guidelines](https://vercel.com/docs/v2/platform/fair-use-policy).
- **Supabase (Free):** pausa los proyectos con poca actividad en 7 días. Fuente: [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing). Además, según el comparativo que se hizo para esta puesta en producción, el plan gratuito **no incluye** los respaldos diarios de la plataforma (a confirmar en el panel antes de operar).

El 14 de noviembre de 2026 Juanito decidió usar **los planes normales (gratuitos) de Supabase y de Vercel** también en producción, y **comprar** el dominio de ZAMMIR y contratar el proveedor de facturas (PAC).

## Decisión

1. **Producción** usa Supabase en plan gratuito y Vercel en plan Hobby. Pruebas, igual.
2. **Se contratan** el **dominio** de ZAMMIR (PD-10) y el **proveedor de timbrado** (PD-05).
3. **Costo de hosting para el contrato (PD-20):** $0 de Supabase y de Vercel; el costo recurrente es el dominio (anual) y el PAC (anual, más folios). Lo confirma Juanito en cada portal antes de firmar.
4. **La decisión es de Juanito, con los riesgos de abajo a la vista.** Se registra aquí para que el contrato y la guía de operación digan lo mismo.

## Riesgos conocidos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| **Términos de Vercel Hobby** (uso no comercial): puede haber una advertencia o la suspensión del proyecto. | La aplicación se puede volver a desplegar en minutos. Pasar a Pro es **un cambio de plan en el panel, sin tocar código**. Se revisa al primer aviso de Vercel y antes de la entrega. Alternativa si se quiere seguir sin costo: un hospedaje estático gratuito que admita uso comercial (por ejemplo, Cloudflare Pages, a verificar sus términos), porque el sistema es una aplicación estática. |
| **Supabase pausa el proyecto** tras 7 días sin actividad. | La copia nocturna se conecta a la base cada noche (a confirmar que Supabase lo cuenta como actividad) y el monitoreo de `salud` (PP-32) la despierta si hace falta. Un proyecto pausado se reactiva desde el panel sin perder datos. |
| **Sin respaldos de la plataforma.** | El **respaldo nocturno cifrado** (`respaldo-nocturno.yml`) pasa de ser un complemento a ser **la única copia**. Se vuelve obligatorio: activarlo con los secretos de producción y **ensayar la restauración** antes de operar con datos reales [S5-06, RNF-21]. |
| **Límites de recursos del plan gratuito** (tamaño de la base, solicitudes, funciones). | La operación de una sola vidriería queda lejos de los límites hoy; se vigila el uso en el panel y se anota la fecha de revisión en la guía de operación. |

## Alternativas consideradas

- **Planes de pago (Supabase Pro ≈ 25 USD al mes, Vercel Pro ≈ 20 USD al mes):** es lo que dejó [ADR-0003]. Da respaldos de la plataforma, sin pausas y con uso comercial permitido. Descartada por costo, por decisión de Juanito; sigue siendo el camino de subida si algún riesgo se materializa.

## Consecuencias

- La guía [`PUESTA_EN_PRODUCCION.md`](../operacion/PUESTA_EN_PRODUCCION.md) y el comentario del flujo de respaldo dejan de decir "plan Pro".
- PD-20 queda resuelta en lo que corresponde a hosting; PD-32 pasa a depender solo del respaldo nocturno propio.
- Si el negocio crece o Vercel lo exige, se actualiza este ADR y se cambia de plan.
