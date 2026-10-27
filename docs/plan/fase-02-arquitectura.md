# Fase 2 — Arquitectura

- **Tipo:** documentación técnica
- **Fechas:** 28–30 de octubre de 2026

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

## Fuera de esta fase

- Código de producción. Se permite código desechable para validar una decisión, en una rama `spike/`.

## Compuerta de salida

- [ ] Todos los documentos de `docs/arquitectura/` escritos y enlazados desde su README.
- [ ] Un ADR por cada decisión técnica tomada, en el índice de `DECISIONES.md`.
- [ ] El modelo de datos cubre cada requerimiento de M1 a M9 y lo conocido de M10. Se verifica con una tabla de trazabilidad requerimiento → entidad.
- [ ] Cada regla de negocio RN-01 a RN-20 tiene un lugar definido en la arquitectura: qué capa y qué pieza la implementa.
- [ ] Tabla de casos de oro de dinero validada por Juanito.
- [ ] Juanito aprobó la arquitectura.

## Riesgos y pendientes

- El PIN sin conexión es el punto más delicado de seguridad: hay que elegir entre comodidad y riesgo y dejarlo por escrito.
- ⚠ PD-01: la §7 y la §8 pueden cambiar decisiones de facturación e impresión.
- PD-16 afecta el tamaño de pantalla de pruebas.
