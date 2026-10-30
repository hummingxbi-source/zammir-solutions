# Sistema ZAMMIR

Sistema de gestión para **Soluciones en Vidrio y Aluminio ZAMMIR**: cotizador en tablet que funciona sin internet, órdenes de trabajo, mostrador con corte de caja, clientes, cuentas por cobrar, reportes y facturación CFDI.

Desarrollado por **HummingX BI**. Repositorio privado y confidencial.

## Estado

**Fase 4, Sprint 0: cimientos.** Ya hay código: monorepo, integración continua, Supabase local, navegación, entrada de administradores, bitácora, dispositivos y PWA. Todavía no hay cotizador. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md) y [`docs/backlog/`](docs/backlog/).

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
    ├── producto/          Alcance, reglas, requerimientos (funcionales y no funcionales), glosario, pendientes, riesgos
    ├── decisiones/        Un archivo por decisión (ADR)
    ├── arquitectura/      Arquitectura y modelo de datos (Fase 2)
    └── calidad/           Casos de oro de dinero, pruebas de aceptación E1 a E10 y estrategia de pruebas
```

## Stack

React + Vite + TypeScript (PWA), Supabase y Vercel. Ver [ADR-0003](docs/decisiones/0003-stack-base.md).

## Cómo levantarlo en local

### Qué necesitas instalado

- **Node 24** (`.nvmrc`) y **Docker Desktop** encendido (Supabase local corre en contenedores).
- Git.

### Pasos

```bash
git clone https://github.com/hummingxbi-source/zammir-solutions.git
cd zammir-solutions
corepack enable                 # activa pnpm 12 (lo fija package.json)
pnpm install
cp .env.example .env            # en Windows PowerShell: Copy-Item .env.example .env
pnpm db:start                   # Supabase local; la primera vez descarga imágenes
pnpm funciones:empaquetar       # empaqueta packages/core para las funciones de servidor
```

`pnpm db:start` imprime las direcciones y llaves **locales**. Copia al `.env` la URL (`API URL`) en `VITE_SUPABASE_URL` y la llave `anon` en `VITE_SUPABASE_ANON_KEY`. Son llaves de desarrollo que solo sirven en tu computadora; nunca pongas llaves de pruebas ni de producción en este archivo si lo vas a compartir (el `.env` no se sube a git).

```bash
pnpm dev                        # la aplicación en http://localhost:5173
```

Sin las variables `VITE_*` la aplicación abre igual, pero sin servidor: las secciones de administrador piden entrar y no hay con quién.

### Crear un administrador local

Con Supabase local encendido, abre Studio en <http://127.0.0.1:55323> → Authentication → Add user. En *Raw app meta data* del usuario escribe `{"rol": "ADMIN"}`. Con ese correo y contraseña entras en la aplicación.

### Comandos útiles

| Comando | Qué hace |
|---|---|
| `pnpm test` | Pruebas unitarias y de componentes |
| `pnpm test:db` | Pruebas de la base de datos (pgTAP) |
| `pnpm test:integracion` | Pruebas contra Supabase local y las funciones de servidor |
| `pnpm test:e2e` | Pruebas de extremo a extremo con tamaño de tablet (Playwright) |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm check:deps` | Revisiones de calidad |
| `pnpm db:reset` | Recrea la base local desde las migraciones |
| `pnpm db:stop` | Apaga Supabase local |

El orden completo de la compuerta de calidad está en [`.github/workflows/ci.yml`](.github/workflows/ci.yml) y en [`docs/plan/00-principios-de-ingenieria.md`](docs/plan/00-principios-de-ingenieria.md).
