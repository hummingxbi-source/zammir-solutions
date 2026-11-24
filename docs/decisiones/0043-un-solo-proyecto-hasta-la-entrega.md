# ADR-0043: Un solo proyecto de Supabase y de Vercel; se prueba en producción y se recrea vacío en la entrega

- **Estado:** Aceptada
- **Fecha:** 2026-11-23
- **Decide:** Juanito (HummingX BI)
- **Modifica:** [ADR-0038] (la línea "pruebas, igual": ya no hay dos entornos en la nube) y el plan de producción de dos proyectos
- **Resuelve:** PD-10 (dominio)

## Contexto

El plan de producción preveía dos proyectos en la nube, uno de **pruebas** y otro de **producción**, cada uno con su Supabase y su Vercel. El plan gratuito de Supabase admite **dos proyectos activos por cuenta**, y la cuenta de HummingX ya usa uno para otro cliente que está en operación y no se toca. Para ZAMMIR queda **un solo proyecto**: `zammir-pruebas`.

Juanito quiere además probar en el entorno real, con la tablet y el dominio definitivo, antes de entregar. Hasta la entrega solo hay datos inventados, que se pueden alterar libremente.

## Decisión

1. **Un solo entorno en la nube hasta la entrega:**
   - Supabase `zammir-pruebas`, en la organización de HummingX y en plan gratuito.
   - Vercel `zammir-pruebas`, con rama de producción `main`, que se despliega sola al fusionar.
   - Dominio **`zammir-solutions.com`**, comprado en Cloudflare con renovación automática. La aplicación vive en **`https://sistema.zammir-solutions.com`** (`CNAME` a Vercel, solo DNS).
2. **Se prueba en producción con datos inventados.** Cada cambio pasa antes por las pruebas automáticas, la vista previa de Vercel del PR y Supabase local. Ya no existe la rama `produccion` ni el proyecto `zammir-produccion`.
3. **En la entrega, el proyecto de Supabase se borra y se crea uno nuevo vacío.** No se vacían tablas a mano: la bitácora, el historial de precios y los documentos legales están protegidos contra borrado a propósito [RN-18], y esa protección no se desactiva. Al recrearlo cambian las llaves, así que:
   - se ponen de nuevo los secretos en GitHub y las variables `VITE_*` en Vercel;
   - se despliega la base con el flujo *Desplegar a Supabase*;
   - se crean el administrador y las personas reales, y se reconectan las tablets con códigos nuevos.
   El dominio y el proyecto de Vercel no cambian.
4. **Entornos de GitHub:** hasta la entrega, `pruebas` guarda los secretos del único proyecto. El respaldo nocturno lee los suyos del entorno `produccion` y apunta a ese mismo proyecto. En la entrega, los secretos del proyecto nuevo van a `produccion`, con **Required reviewers**, y `pruebas` se vacía.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| **Después de la entrega no queda un entorno de pruebas en la nube.** | Los cambios se prueban en Supabase local y en la integración continua (pruebas de integración y extremo a extremo con la base local). Si hace falta un entorno de pruebas en la nube, se libera un proyecto o se pasa a un plan de pago, y se actualiza este ADR. |
| **Las vistas previas de Vercel escriben en la misma base.** Antes de la entrega da igual; después escribirían en los datos reales. | En la entrega, las variables `VITE_*` se definen **solo para *Production*** en Vercel. Una vista previa sin llaves no se conecta a nada. Está en la lista de la entrega. |
| **Datos de prueba que se cuelan a la entrega.** | El proyecto se recrea vacío. No se reutiliza ni se copia nada del proyecto de pruebas. |
| **Pausa del plan gratuito** tras 7 días sin actividad [ADR-0038]. | Igual que en [ADR-0038]: se reactiva desde el panel sin perder datos. |

## Alternativas consideradas

- **Dos proyectos gratuitos:** no caben en la cuenta sin tocar el proyecto del otro cliente.
- **Otra cuenta de Supabase solo para ZAMMIR:** divide los accesos y no evita recrear el proyecto en la entrega.
- **Supabase de pago para producción:** descartado por costo [ADR-0038].

## Consecuencias

- [`PLAN_DE_PRODUCCION.md`](../operacion/PLAN_DE_PRODUCCION.md) y [`PUESTA_EN_PRODUCCION.md`](../operacion/PUESTA_EN_PRODUCCION.md) describen un solo proyecto y los pasos de la entrega.
- PD-10 queda resuelto. S4-26 y S5-01 quedan hechas en dominio y variables; "producción vacía" se cumple al recrear el proyecto en la entrega.
- Como los documentos ya no llevan QR mientras la facturación esté en pausa [ADR-0039], el dominio todavía no está impreso en ningún lado.
