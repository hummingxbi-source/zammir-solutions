# Cómo se trabaja en este repositorio

> Aplica a personas y a agentes de IA. Las convenciones de código (estructura de carpetas, nombres, linter) se agregan en la Fase 2.

## Ramas

- `main` es la rama estable. **Nadie sube cambios directo a `main`**: todo entra por Pull Request.
- Cada cambio vive en una rama corta, creada desde `main`:

| Prefijo | Para | Ejemplo |
|---|---|---|
| `feat/` | Función nueva | `feat/m2-pdf-cotizacion` |
| `fix/` | Corrección | `fix/m4-diferencia-corte` |
| `docs/` | Documentación | `docs/adr-0011-redondeo` |
| `refactor/` | Cambio interno sin cambiar el comportamiento | `refactor/modulo-dinero` |
| `chore/` | Configuración, dependencias, CI | `chore/ci-pruebas` |
| `spike/` | Prueba técnica desechable | `spike/impresion-termica` |

- Ramas cortas: idealmente se fusionan el mismo día o al siguiente.
- Al fusionar se usa *squash merge* para que `main` tenga un commit por cambio.

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), en español:

```
<tipo>(<módulo>): <qué cambia, en presente>

<por qué, si no es obvio>
```

- Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- Módulo: `m1` a `m10`, `dominio`, `sync`, `auth`, `ui`, `infra`, o se omite.
- Ejemplos: `feat(m2): genera el PDF de la cotización en el dispositivo`, `fix(dominio): redondea el IVA por documento [ADR-0011]`.

## Pull Requests

Aunque solo haya un desarrollador, todo pasa por PR: así corre la integración continua y queda la historia de cada cambio.

Cada PR incluye:
- Qué cambia y por qué.
- Requerimiento, regla o ADR que atiende (`RF-M2-05`, `RN-07`, `ADR-0004`).
- Cómo se probó.
- Capturas si cambia la interfaz, **con datos inventados**.

Revisión: Juanito revisa; se puede pedir una revisión adicional a un agente de IA. Un PR no se fusiona con la integración continua en rojo.

## Definition of Ready

Una historia entra a un sprint solo si:
- Tiene criterios de aceptación verificables.
- Cita sus requerimientos y reglas.
- No depende de un pendiente bloqueante de `PENDIENTES.md`, o el pendiente tiene un valor configurable acordado.

## Definition of Done

Una historia está terminada cuando:
- [ ] Cumple todos sus criterios de aceptación.
- [ ] Tiene pruebas automáticas en lo que toca dinero, folios, permisos o reglas de negocio.
- [ ] Pasa linter, revisión de tipos y pruebas en la integración continua.
- [ ] Está desplegada en el entorno de pruebas y se probó en la tablet si es una pantalla de tablet.
- [ ] La interfaz usa el vocabulario del glosario, sin palabras prohibidas.
- [ ] Si hubo una decisión, tiene su ADR. Si cambió una regla o un requerimiento, se actualizó su documento.
- [ ] No incluye secretos ni datos reales.

## Ceremonias (Scrum en solitario)

| Ceremonia | Cuándo | Qué |
|---|---|---|
| Planeación | Lunes | Elegir historias del backlog para la semana |
| Revisión | Viernes o fin del sprint | Demo del avance a Luis cuando aplique |
| Retrospectiva | Al cerrar el sprint | Qué funcionó, qué no, qué cambia; 15 minutos |
