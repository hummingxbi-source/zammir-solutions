# Entornos y despliegue

> Borrador de Fase 2 (punto 2.6). Decisiones: [ADR-0003], [ADR-0008], [ADR-0010], [ADR-0014], [ADR-0019]. Requerimientos: RNF-08, RNF-13, RNF-19, RNF-21, RNF-32, RNF-34, RNF-37.
> Lo marcado "por decidir" no se inventa: queda como pendiente.

## 1. Los tres entornos

| | Desarrollo | Pruebas (staging) | Producción |
|---|---|---|---|
| Para qué | Programar y correr pruebas | Probar cada fusión en la tablet real [ADR-0008] | ZAMMIR trabajando con datos reales |
| Aplicación | `vite` local | Vercel, despliegue automático de `main` | Vercel (plan de pago) |
| Base de datos | Supabase local (Docker) | Proyecto de Supabase de pruebas | Proyecto de Supabase de pago, separado |
| PAC | Adaptador simulado | Entorno de pruebas del PAC | PAC en producción (al final) [ADR-0007] |
| Datos | Inventados | Inventados | **Reales; ningún dato de prueba** |
| Dirección | `localhost` | Dominio de prueba de Vercel | Dominio de ZAMMIR (PD-10) |
| Quién entra | Juanito y agentes | Juanito, agentes, Luis en pruebas | Usuarios de ZAMMIR; **ningún agente de IA** [RNF-19] |

Desarrollo y pruebas pueden usar los planes gratuitos; producción usa planes de pago [ADR-0003, PD-20].

## 2. Desarrollo local

- Requisitos: Node, pnpm y Docker (para Supabase local). El README de arranque los detalla y se prueba desde cero [S0-19].
- `pnpm install` → levantar Supabase local → aplicar migraciones → `pnpm dev`.
- Las migraciones se aplican **desde cero** en cada corrida de integración continua.
- **Puertos de Supabase local:** Zammir usa la serie **553xx** (API 55321, base de datos 55322, Studio 55323) para no chocar con otros proyectos de Supabase en la misma máquina, que usan 543xx por defecto. Se definen en `supabase/config.toml`.
- Comandos: `pnpm db:start`, `pnpm db:reset` (aplica las migraciones desde cero) y `pnpm exec supabase test db` (pruebas pgTAP de `supabase/tests/`). La primera vez descarga varios GB de imágenes de Docker.

## 3. Variables de entorno

Todas se documentan en `.env.example` **sin valores**. Los valores viven solo en los paneles de Vercel y Supabase y en los secretos de GitHub Actions. Nunca en el repositorio [CLAUDE.md regla 7].

| Variable | Dónde se usa | ¿Pública? |
|---|---|---|
| `VITE_SUPABASE_URL` | Navegador | Sí |
| `VITE_SUPABASE_ANON_KEY` | Navegador (protegida por RLS) | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo funciones del servidor | **No** |
| `SUPABASE_DB_URL` | Migraciones y funciones con transacción | **No** |
| `BILLING_PROVIDER` | Servidor: `simulated` o el PAC elegido | No |
| `PAC_API_URL`, `PAC_API_KEY` | Servidor, adaptador del PAC | **No** |
| `APP_PUBLIC_URL` | QR y enlaces (debe ser el dominio estable) | Sí |

- La llave de servicio y las del PAC nunca llegan al código del navegador; el escaneo de secretos y la revisión de seguridad del Sprint 5 lo verifican.
- **El CSD de ZAMMIR (`.key` y contraseña) nunca pasa por el código, las variables ni la base:** se sube directo al PAC [RF-M10-02].

## 4. Flujo de despliegue

```
rama de historia ──► Pull Request ──► integración continua (todos los pasos de TESTING.md §4)
                                      └─ vista previa en Vercel + pruebas extremo a extremo
fusión a main ─────► despliegue automático a pruebas (Vercel) ──► migraciones a la base de pruebas
cierre de sprint ──► prueba manual en tablet sobre pruebas
Sprint 5 ──────────► producción: migraciones desde cero, variables, dominio, datos reales
```

- Nadie sube a `main` directamente [CONTRIBUTING].
- **Migraciones:** archivos versionados en `supabase/migrations/`, solo hacia adelante. Una migración que ya se aplicó en pruebas no se edita: se agrega otra.
- Las migraciones a pruebas y a producción las aplica la integración continua o Juanito con la CLI; nunca a mano en el panel.

## 5. Dominio y rutas estables

El dominio de ZAMMIR (HTTPS, DNS en Cloudflare) **no puede cambiar después de imprimir el primer ticket real**, porque los QR apuntan a él [RNF-37, PD-10]. Las rutas públicas (`/factura`) son estables. Mientras tanto, solo se usa el dominio de prueba de Vercel y no se imprime ningún ticket real.

## 6. Respaldos y recuperación

- Respaldos diarios con historial de **al menos 30 días** [RNF-21]. Si la retención del plan de Supabase es menor, exportación nocturna a un almacenamiento externo (por decidir, PD-32).
- **Una restauración completa** en un entorno limpio, hecha y documentada, antes de entregar (E9, S5-06).

## 7. Observabilidad

- Registro de errores de cliente y servidor **sin datos personales** y monitoreo simple de disponibilidad con aviso a Juanito [RNF-34].
- La herramienta concreta queda **por decidir** (historia S4-28); su elección lleva ADR.

## 8. Cuentas y accesos que hacen falta

| Cuenta | Para qué | Quién la crea | Cuándo |
|---|---|---|---|
| GitHub (repositorio privado, Actions) | Código y CI | Juanito | Ya existe |
| Supabase (proyecto de pruebas) | Base de datos de pruebas | Juanito | Antes de S0-05 y S0-06 |
| Vercel (proyecto de pruebas) | Despliegue a pruebas | Juanito | Antes de S0-06 |
| Cloudflare | Dominio y DNS de producción | Juanito / Luis | Antes del Sprint 5 (PD-10) |
| Supabase y Vercel de producción (planes de pago) | Producción | Juanito, con ZAMMIR | Sprint 4 a 5 |
| PAC | Timbrado | Juanito o ZAMMIR (PD-05) | Antes del Sprint 4 |

Los accesos de producción se entregan a Juanito por un canal seguro [DC §13].
