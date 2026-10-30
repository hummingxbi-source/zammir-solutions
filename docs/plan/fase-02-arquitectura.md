# Fase 2 — Arquitectura

- **Tipo:** documentación técnica
- **Fechas:** 26–30 de octubre de 2026
- **Estado:** en curso. Borradores de `ARCHITECTURE`, `AUTENTICACION`, `MODELO_DE_DATOS`, `SINCRONIZACION` y casos de oro; ADR-0011 a ADR-0016

## Objetivo

Convertir los principios de [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md) en decisiones concretas y documentadas, para que la construcción no tenga que inventar nada estructural sobre la marcha.

## Entra si

- Fase 0 cerrada, o al menos PD-18 (idioma del código) resuelto.

## Alcance

Cada punto termina en un documento de `docs/arquitectura/` y, cuando es una decisión, en un ADR.

### 2.1 Estructura y capas
- Confirmar o ajustar la estructura del repositorio (monorepo con `apps/web`, `packages/core`, `supabase/`).
- Cómo se comparte `packages/core` con las Edge Functions de Supabase.
- Reglas de dependencia entre capas y la herramienta que las verifica.
- Herramientas confirmadas: gestor de paquetes, pruebas, lint, validación de esquemas, PDF, IndexedDB, enrutamiento, manejo de estado.
- **Documento:** `ARCHITECTURE.md` con diagramas C4 nivel 1 (contexto), 2 (contenedores) y 3 (componentes del cotizador).

### 2.2 Modelo de datos
- Entidades, relaciones y diccionario de datos de los 10 módulos.
- Cómo se modela el dinero (centavos enteros), las fechas (UTC), la bitácora y las cancelaciones.
- Cómo se congela el precio en cotizaciones y órdenes [RN-03].
- Políticas RLS por rol para cada tabla.
- **Documento:** `MODELO_DE_DATOS.md` con diagrama entidad-relación.

### 2.3 Dinero e impuestos
- Algoritmo exacto de redondeo y desglose de IVA a partir de precios con IVA incluido, y cómo cuadra contra el CFDI [ADR-0004].
- Tabla de casos de oro validada por Juanito.
- **Entregable:** ADR de redondeo + tabla de casos de oro en `docs/calidad/`.

### 2.4 Sincronización sin conexión y folios
- Qué entidades viven en la tablet y cuáles solo en el servidor.
- Diseño de la cola de salida, reintentos, idempotencia y orden de envío.
- Asignación de folios definitivos sin huecos ni duplicados, con concurrencia de dos tablets [RN-16].
- Política de conflictos por tipo de entidad.
- Qué ve el usuario cuando algo está "guardado en la tablet" y cuando ya se "envió".
- **Documento:** `SINCRONIZACION.md` con diagramas de secuencia.

### 2.5 Autenticación
- Administradores con correo y contraseña.
- Registro de dispositivos y su credencial.
- PIN: hash, verificación, intentos fallidos y **cómo funciona sin conexión** (qué se guarda en la tablet y sus riesgos).
- Bloqueo por inactividad y cambio de usuario.
- **Documento:** `AUTENTICACION.md`.

### 2.6 Entornos y despliegue
- Desarrollo local, pruebas (staging) y producción: qué proyecto de Supabase y de Vercel usa cada uno.
- Variables de entorno y `.env.example`.
- Flujo de despliegue y de migraciones de base de datos.
- Respaldos de producción.
- **Documento:** `ENTORNOS.md`.

### 2.7 Estrategia de pruebas
- Confirmar herramientas y umbrales de [`00-principios-de-ingenieria.md` §4](00-principios-de-ingenieria.md).
- Tamaño de pantalla de tablet para pruebas extremo a extremo, según el modelo elegido (PD-16).
- **Documento:** `docs/calidad/TESTING.md`.

### 2.8 Lo que la arquitectura debe absorber del documento completo

Los borradores se escribieron antes de recibir §7 a §17 (marcados ⚠ PD-01). Antes de cerrar la fase, cada punto queda resuelto en el documento indicado:

| # | Qué | Fuente | Dónde |
|---|---|---|---|
| 1 | Quitar las marcas ⚠ PD-01 y completar la facturación: tabla `invoices` con estado "en proceso", reintentos, referencia del PAC, rutas de XML y PDF, quién la pidió (administrador o público); tabla de solicitudes de autofactura con intentos y resultado | [DC §7.5, §7.6, §11.3], RF-M10-* | `MODELO_DE_DATOS.md`, `ARCHITECTURE.md` |
| 2 | Contrato de `BillingProvider` con las cuatro operaciones (timbrar, cancelar, consultar, descargar XML y PDF); el CSD nunca pasa por nuestros sistemas | RF-M10-01, RF-M10-02 | `ARCHITECTURE.md` |
| 3 | Portal `/factura`: función pública en el servidor, límite de intentos por IP y por folio, verificación contra automatización, sin revelar si un folio existe; longitud del código de verificación | RF-M10-09 a RF-M10-11, RNF-12 | `ARCHITECTURE.md`, `AUTENTICACION.md` |
| 4 | Plazo de autofacturación en un solo lugar de configuración | RN-26 | `MODELO_DE_DATOS.md` (`business_settings`) |
| 5 | Ajuste "tratamiento de anticipos" y contador de timbres con aviso al 80% | RN-27, RF-M10-20 | `MODELO_DE_DATOS.md` |
| 6 | Verificar ADR-0011 contra el CFDI 4.0: el riesgo del centavo sigue abierto hasta el entorno de pruebas del PAC | [ADR-0011], R12 | `ADR-0011` |
| 7 | `TicketPrinter` con los tres adaptadores de [ADR-0018]; quitar "sin elegir" de [ADR-0014] | [DC §8.3] | `ARCHITECTURE.md`, `ADR-0014` |
| 8 | Conflictos: **las órdenes también se resuelven por campo** (gana el último cambio, con bitácora) en sus datos editables (responsables, fecha estimada, notas). Hoy `SINCRONIZACION.md` §6 solo lo dice de clientes | RNF-05 [DC §9] | `SINCRONIZACION.md` |
| 9 | Datos mínimos en la tablet: no guardar los datos fiscales de todos los clientes; depurar lo antiguo ya sincronizado | RNF-06 [DC §9] | `SINCRONIZACION.md` §7 |
| 10 | Respaldos diarios con 30 días; exportación nocturna si el plan de Supabase retiene menos; restauración probada | RNF-21, PD-32 | `ENTORNOS.md` |
| 11 | Cloudflare para dominio y DNS; rutas públicas estables por los QR; Render solo si hace falta | RNF-37 [DC §11.1, §11.2] | `ENTORNOS.md` |
| 12 | Registro de errores sin datos personales y monitoreo de disponibilidad | RNF-34 | `ENTORNOS.md` |
| 13 | Exportación de datos del cliente en CSV, JSON y PDF | RNF-22 | `ARCHITECTURE.md` |
| 14 | Comparar `MODELO_DE_DATOS.md` contra las entidades recomendadas en §11.3 y justificar diferencias | [DC §11.3] | `MODELO_DE_DATOS.md` |
| 15 | Ampliar la tabla de trazabilidad a RF-M10-*, RF-UX-* y RNF-* y la de reglas a RN-01 a RN-28 | — | `MODELO_DE_DATOS.md`, `ARCHITECTURE.md` |

## Fuera de esta fase

- Código de producción. Se permite código desechable para validar una decisión, en una rama `spike/`.

## Compuerta de salida

- [ ] Todos los documentos de `docs/arquitectura/` escritos y enlazados desde su README.
- [ ] Un ADR por cada decisión técnica tomada, en el índice de `DECISIONES.md`.
- [ ] El modelo de datos cubre cada requerimiento de M1 a M10. Se verifica con una tabla de trazabilidad requerimiento → entidad.
- [ ] Cada regla de negocio RN-01 a RN-28 tiene un lugar definido en la arquitectura: qué capa y qué pieza la implementa.
- [ ] Los 15 puntos de la sección 2.8 resueltos.
- [ ] Ninguna marca ⚠ PD-01 queda en `docs/arquitectura/`.
- [ ] Tabla de casos de oro de dinero validada por Juanito.
- [ ] Juanito aprobó la arquitectura.

## Riesgos y pendientes

- El PIN sin conexión es el punto más delicado de seguridad: hay que elegir entre comodidad y riesgo y dejarlo por escrito.
- PD-01 resuelto: la §7 y la §8 ya llegaron; su efecto está en la sección 2.8.
- PD-34 (calendario) puede mover el orden de los sprints, no la arquitectura.
- PD-16 afecta el tamaño de pantalla de pruebas.
