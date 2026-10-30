# Sistema ZAMMIR

Sistema de gestión para **Soluciones en Vidrio y Aluminio ZAMMIR**: cotizador en tablet que funciona sin internet, órdenes de trabajo, mostrador con corte de caja, clientes, cuentas por cobrar, reportes y facturación CFDI.

Desarrollado por **HummingX BI**. Repositorio privado y confidencial.

## Estado

**Fase 1: documentación base.** Todavía no hay código. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Mapa del repositorio

```
.
├── CLAUDE.md              Instrucciones para agentes de IA (AGENTS.md apunta aquí)
├── DECISIONES.md          Índice de decisiones (ADR)
├── CONTRIBUTING.md        Cómo se trabaja: ramas, commits, revisión, Definition of Done
├── SECURITY.md            Secretos, datos personales y permisos
├── CHANGELOG.md           Cambios por versión
└── docs/
    ├── ROADMAP.md         Fases y sprints (resumen)
    ├── plan/              Plan de construcción: principios, pruebas y una guía por fase
    ├── contexto/          Documentos fuente originales (no se editan)
    ├── producto/          Alcance, reglas de negocio, requerimientos, glosario, pendientes
    ├── decisiones/        Un archivo por decisión (ADR)
    ├── arquitectura/      Arquitectura y modelo de datos (Fase 2)
    └── calidad/           Estrategia de pruebas (Fase 2)
```

## Stack

React + Vite + TypeScript (PWA), Supabase y Vercel. Ver [ADR-0003](docs/decisiones/0003-stack-base.md).

## Cómo levantarlo en local

Se documenta al terminar el Sprint 0.
