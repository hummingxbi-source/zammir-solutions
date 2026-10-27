# ADR-0003: Stack base — React + Vite + TypeScript, Supabase y Vercel

- **Estado:** Aceptada en lo general. Los detalles (librerías, motor de sincronización, estructura) se deciden en la Fase 2 con ADRs propios.
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

- Solo Juanito codifica, con apoyo de agentes de IA. Él domina Supabase y Vercel.
- El sistema debe funcionar sin internet en tablets Android para cotizar y vender [DC §3.1].
- El documento de construcción ya recomienda Supabase Auth [DC §4].

## Decisión

| Capa | Elección |
|---|---|
| Frontend | React + Vite + TypeScript en modo estricto, como PWA (aplicación de una sola página) |
| Datos en la tablet | IndexedDB, con una cola de sincronización hacia el servidor (librería a decidir en Fase 2) |
| Backend | Supabase: Postgres con seguridad a nivel de fila (RLS), Auth y Edge Functions para lo que debe pasar en servidor (folios definitivos, facturación) |
| Hosting | Vercel |

**Por qué no Next.js:** la parte crítica corre en la tablet sin conexión. El renderizado en servidor no aporta ahí y complica el modo offline.

**Por qué TypeScript estricto:** protege dinero, folios y permisos, y ayuda a los agentes de IA a no romper contratos entre capas.

## Consecuencias

**Costos de producción**, a trasladar en el contrato (PD-20):
- El plan gratuito de Vercel solo admite uso personal no comercial; el uso comercial requiere Pro o Enterprise. Fuente: [Vercel, Fair Use Guidelines](https://vercel.com/docs/v2/platform/fair-use-policy).
- El plan gratuito de Supabase pausa proyectos con poca actividad en 7 días; los planes de pago no se pausan. Fuente: [Supabase, Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- Desarrollo y pruebas pueden usar los planes gratuitos; producción usa planes de pago.

**Riesgo:** dependencia de proveedores. Se mitiga manteniendo la lógica del negocio fuera de Supabase y de React (ver arquitectura, Fase 2).

## Alternativas consideradas

- **Next.js en Vercel:** descartado por lo dicho arriba.
- **Backend propio (Node/NestJS) con Postgres administrado:** más control, pero más trabajo para un solo desarrollador con 5 semanas.
