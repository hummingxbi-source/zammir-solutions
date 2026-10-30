# Principios de ingeniería

> Aplica a **todas** las fases de código (4 a 9). Un agente lo lee antes de empezar cualquier sprint.
> Las herramientas concretas marcadas *(propuesta)* se confirman en la Fase 2 con un ADR. Los principios no cambian.

---

## 1. Arquitectura objetivo

### 1.1 Estilo: arquitectura limpia por módulos

El sistema se organiza en **módulos del negocio** (catálogo, cotizaciones, órdenes, mostrador, etc.). Cada módulo tiene las mismas capas, y las dependencias **solo apuntan hacia adentro**:

```
        ┌──────────────────────────────────────────┐
        │  UI (React)            Infraestructura    │   ← capas externas
        │  pantallas, hooks      Supabase, IndexedDB,│
        │                        PDF, impresora, PAC │
        │        │                       │           │
        │        ▼                       ▼           │
        │  ┌──────────────────────────────────────┐  │
        │  │  Aplicación                          │  │
        │  │  casos de uso + puertos (interfaces) │  │
        │  │        │                             │  │
        │  │        ▼                             │  │
        │  │  ┌────────────────────────────────┐  │  │
        │  │  │  Dominio                       │  │  │   ← no importa nada externo
        │  │  │  entidades, reglas, dinero,    │  │  │
        │  │  │  precios, folios, estados      │  │  │
        │  │  └────────────────────────────────┘  │  │
        │  └──────────────────────────────────────┘  │
        └──────────────────────────────────────────┘
```

| Capa | Contiene | Puede importar | Nunca importa |
|---|---|---|---|
| **Dominio** | Entidades, objetos de valor (`Money`, `Folio`, `Measurement`), reglas de negocio puras, máquinas de estado, políticas de permisos | Solo otras piezas del dominio | React, Supabase, Dexie, `Date.now()`, `fetch`, `window` |
| **Aplicación** | Casos de uso (`CreateQuote`, `RegisterDeposit`, `CloseCashShift`) y **puertos**: interfaces que la infraestructura implementa | Dominio | React, Supabase, Dexie, cualquier SDK |
| **Infraestructura** | Adaptadores que implementan puertos: repositorios Supabase e IndexedDB, generador de PDF, impresora, compartir por WhatsApp, PAC | Aplicación (puertos), dominio, SDKs | UI |
| **UI** | Pantallas, componentes, hooks que invocan casos de uso | Aplicación, dominio (tipos y formateo) | Supabase, Dexie directamente |
| **Raíz de composición** | Un solo lugar donde se crean los adaptadores y se inyectan en los casos de uso | Todo | — |

**Esta regla se verifica automáticamente en la integración continua** con una herramienta de reglas de dependencia *(propuesta: dependency-cruiser)*. Si alguien importa Supabase desde el dominio, la integración continua falla.

### 1.2 Estructura del repositorio *(propuesta, se confirma en Fase 2)*

```
apps/
  web/                         PWA en React + Vite
    src/
      modules/<módulo>/ui/     Pantallas y componentes del módulo
      modules/<módulo>/infra/  Adaptadores del módulo
      shared/ui/               Sistema de diseño (botones, campos, tablas)
      shared/infra/            Clientes de Supabase e IndexedDB, sincronización
      composition/             Raíz de composición
packages/
  core/                        Dominio + aplicación, TypeScript puro
    src/
      shared-kernel/           Money, Folio, Clock, IdGenerator, Result
      modules/<módulo>/domain/
      modules/<módulo>/application/
supabase/
  migrations/                  Esquema SQL versionado
  functions/                   Edge Functions (folios definitivos, facturación)
  tests/                       Pruebas de RLS y funciones SQL
docs/
```

**Por qué `packages/core` separado:** la misma lógica de dinero, precios y folios debe correr igual en la tablet y en el servidor. Si vive en un paquete puro, se prueba una sola vez y se usa en los dos lados.

### 1.3 Puertos previstos

Cada puerto es una interfaz pequeña, con un solo propósito:

| Puerto | Para qué | Adaptadores previstos |
|---|---|---|
| `Clock` | Hora actual | Reloj del sistema; reloj fijo en pruebas |
| `IdGenerator` | Identificadores únicos | UUID; secuencia fija en pruebas |
| `<Entidad>Repository` (uno por agregado) | Guardar y leer | IndexedDB (tablet), Supabase (servidor), memoria (pruebas) |
| `SyncOutbox` | Cola de cambios pendientes de enviar | IndexedDB |
| `FolioAllocator` | Folio temporal en dispositivo y definitivo en servidor | Serie local por dispositivo; función SQL en servidor |
| `DocumentRenderer` | Generar PDF de cotización y comprobante | Librería PDF en el dispositivo |
| `TicketPrinter` | Imprimir ticket de 80 mm | Según resultado de la prueba de impresión [ADR-0008]; impresora falsa en pruebas |
| `ShareService` | Compartir PDF o abrir WhatsApp | Menú de compartir del dispositivo; enlace de WhatsApp |
| `BillingProvider` | Timbrar, cancelar y consultar CFDI | Simulado; PAC elegido [ADR-0007] |
| `PinHasher` | Verificar PIN | Algoritmo de hash definido en Fase 2 |
| `FeatureFlags` | Interruptores P1 y P2 | Configuración del negocio |

---

## 2. SOLID aplicado a este proyecto

SOLID no se cumple "en general": se cumple en piezas concretas. Estas son las que importan aquí.

### S — Responsabilidad única

Cada pieza tiene **una sola razón para cambiar**.

| ✅ Así | ❌ No así |
|---|---|
| `CreateQuote` solo crea cotizaciones; `SendQuoteByWhatsApp` solo comparte | Un `QuoteService` con 30 métodos |
| La pantalla del cotizador muestra y captura; el cálculo vive en el dominio | Calcular m² e IVA dentro de un componente de React (el error de la demo) |
| `TaxCalculator` desglosa IVA; `Money` suma y redondea | Una función que desglosa IVA, formatea y guarda |

### O — Abierto a extensión, cerrado a modificación

Se agregan comportamientos nuevos **sin tocar** el código que ya funciona.

- **Reglas de precio** [ADR-0006]: cada tipo de regla es una estrategia con la misma interfaz. Una regla nueva es un archivo nuevo más su registro, no un `if` más en una función existente.
- **Reportes**: cada reporte es una definición independiente.
- **Estados de documentos**: las transiciones permitidas viven en una tabla de la máquina de estados, no repartidas en la interfaz.

### L — Sustitución de Liskov

Cualquier implementación de un puerto debe poder reemplazar a otra **sin que el sistema lo note**.

- Cada puerto tiene una **batería de pruebas de contrato** que corre contra **todos** sus adaptadores. Ejemplo: el repositorio en memoria, el de IndexedDB y el de Supabase pasan exactamente las mismas pruebas.
- El `BillingProvider` simulado y el del PAC real pasan las mismas pruebas de contrato. Así, cambiar al PAC real al final [ADR-0007] no rompe nada.

### I — Segregación de interfaces

Interfaces pequeñas y específicas.

- `QuoteRepository` tiene solo lo que los casos de uso de cotizaciones necesitan. No existe un `Database` genérico con todo.
- Lectura y escritura se separan cuando los consumidores son distintos (por ejemplo, reportes solo leen).

### D — Inversión de dependencias

El dominio y la aplicación dependen de **interfaces**, nunca de implementaciones.

- Los casos de uso reciben sus puertos por constructor o parámetro.
- Solo la raíz de composición sabe que existen Supabase, IndexedDB o el PAC.
- Consecuencia práctica: **todo caso de uso se prueba sin base de datos, sin red y sin navegador.**

---

## 3. Código limpio: reglas concretas

1. **TypeScript estricto** (`strict: true`, `noUncheckedIndexedAccess`). Prohibido `any`, `as` sin justificar y el operador `!`.
2. **Nombres del glosario.** Ningún concepto del negocio tiene un nombre que no esté en `GLOSARIO.md`. Si hace falta uno nuevo, se agrega primero al glosario.
3. **Sin números mágicos.** El 16%, el 50% de anticipo, los 15 días de vigencia y los 5 minutos de bloqueo son configuración, no literales.
4. **Funciones puras en el dominio.** Mismo resultado para las mismas entradas. La hora y los identificadores llegan por `Clock` e `IdGenerator`.
5. **Errores de negocio como valores**, no como excepciones: el dominio regresa un `Result` con un error tipado (por ejemplo, `DeliveryWithBalanceRequiresAdmin`). Las excepciones son solo para fallas técnicas.
6. **Inmutabilidad.** Las entidades no se mutan desde fuera; los cambios pasan por métodos que validan reglas.
7. **Funciones cortas y archivos enfocados.** Si una función necesita un comentario para explicar qué hace por bloques, se divide.
8. **Comentarios solo para el porqué**, no para el qué. Cita la regla cuando no es obvia: `// RN-16: ...`.
9. **Validación en la frontera.** Todo lo que entra (formularios, respuestas del servidor, CSV) se valida con un esquema antes de llegar al dominio *(propuesta: Zod)*.
10. **Textos de la interfaz centralizados**, no regados en componentes. Esto permite la prueba automática de palabras prohibidas.
11. **Sin código muerto ni `TODO` huérfanos.** Un `TODO` solo se permite si cita un pendiente: `// TODO(PD-06): duración real de garantía`.
12. **Formato y lint automáticos** *(propuesta: ESLint + Prettier)*, con cero advertencias.

---

## 4. Estrategia de pruebas

> La meta no es un número de pruebas: es que **ningún error de dinero, folios, permisos o reglas llegue a manos de Luis**. Si para eso hacen falta 900 pruebas, se hacen 900.

### 4.1 Niveles

| Nivel | Qué prueba | Herramienta *(propuesta)* | Dónde vive | Velocidad |
|---|---|---|---|---|
| **Unitarias del dominio** | Dinero, IVA, redondeo, reglas de precio, folios, máquinas de estado, políticas de permisos, cálculo de corte, periodos de reportes | Vitest | `packages/core/**/*.test.ts` | Milisegundos |
| **Basadas en propiedades** | Invariantes que deben cumplirse con *cualquier* entrada: "subtotal + IVA = total", "nunca hay huecos en folios" | fast-check | Junto a las unitarias | Segundos |
| **Casos de uso** | Cada caso de uso con puertos falsos en memoria: reglas, permisos, bitácora, errores | Vitest | `packages/core/**/application/*.test.ts` | Milisegundos |
| **Contrato de puertos** | La misma batería contra todos los adaptadores de un puerto | Vitest | `packages/core/**/contracts/` y se invoca desde cada adaptador | Segundos |
| **Integración con base de datos** | Migraciones, funciones SQL, **políticas RLS por rol**, folios definitivos con concurrencia | Supabase local + pgTAP o pruebas con clientes por rol | `supabase/tests/` | Segundos |
| **Sincronización** | Sin conexión, reconexión, dos tablets, reintentos, operaciones duplicadas | Vitest con IndexedDB simulada + servidor local | `apps/web/src/shared/infra/sync/*.test.ts` | Segundos |
| **Componentes** | Pantallas críticas: el cotizador muestra el cálculo, el cobro calcula cambio, botones deshabilitados según permiso | Testing Library | Junto a cada componente | Segundos |
| **Extremo a extremo** | Flujos completos en navegador con tamaño de tablet, incluido modo sin conexión | Playwright | `apps/web/e2e/` | Minutos |
| **Mutación** | Que las pruebas del dominio realmente detecten errores: se introducen cambios al código y las pruebas deben fallar | Stryker | Sobre `packages/core` | Minutos |
| **Accesibilidad** | Contraste, etiquetas, tamaño de objetivos táctiles | axe-core dentro de Playwright | `apps/web/e2e/` | — |
| **Vocabulario** | Ningún texto de la interfaz contiene palabras prohibidas del glosario | Prueba que recorre los textos centralizados | `apps/web/src/shared/i18n/*.test.ts` | Milisegundos |

### 4.2 Umbrales mínimos

| Área | Cobertura de líneas | Cobertura de ramas | Puntuación de mutación |
|---|---|---|---|
| Dinero, IVA, redondeo, reglas de precio, folios | 100% | 100% | ≥ 90% |
| Resto del dominio | ≥ 95% | ≥ 90% | ≥ 80% |
| Casos de uso | ≥ 95% | ≥ 90% | — |
| Adaptadores de infraestructura | Cubiertos por pruebas de contrato | — | — |
| Todo el repositorio | ≥ 85% | — | — |

La cobertura es un **piso**, no la meta. Una prueba que ejecuta código sin verificar nada no cuenta: por eso existe la prueba de mutación.

### 4.3 Reglas para escribir pruebas

1. **Pruebas primero** en dominio y casos de uso: rojo → verde → refactor.
2. **Cada criterio de aceptación tiene al menos una prueba** que lo nombra.
3. **Cada error encontrado se reproduce con una prueba antes de corregirse.** La prueba se queda para siempre.
4. **Deterministas.** Reloj fijo, identificadores fijos, sin depender de la hora real ni del orden de ejecución. Una prueba que falla "a veces" se arregla de inmediato; no se reintenta hasta que pase.
5. **Datos inventados** con constructores de datos de prueba (`aQuote().withLine(...)`). Nunca datos reales [ADR-0010].
6. **Nombres que se leen como reglas**, en español: `it('rechaza entregar con saldo pendiente si no es administrador')`.
7. **Tabla de casos de oro para dinero.** Un conjunto de cálculos hechos a mano y validados por Juanito (medidas, cantidades, IVA, redondeo). Son la referencia de verdad; si el código y la tabla no coinciden, gana la tabla hasta que Juanito diga otra cosa.
8. **Prohibido** `it.skip`, `it.only`, `describe.skip` o bajar umbrales para que pase la integración continua.
9. **Zona horaria en pruebas:** se corren con zonas horarias distintas a la de México para detectar errores de "día" y "semana" [RN-17].

### 4.4 Pruebas manuales en tablet

Lo que no se puede automatizar se verifica a mano **cada sprint** en la tablet real, sobre el entorno de pruebas, con una lista firmada en el Pull Request de cierre del sprint: instalación de la PWA, modo sin conexión real (modo avión), impresión del ticket, compartir por WhatsApp, rotación vertical y horizontal, teclado numérico.

---

## 5. Compuerta de calidad

### 5.1 En cada Pull Request (integración continua)

La integración continua corre en este orden y **se detiene en el primer fallo**:

1. Instalación limpia de dependencias.
2. Formato y lint: **cero errores y cero advertencias**.
3. Revisión de tipos estricta.
4. Reglas de dependencia entre capas.
5. Pruebas unitarias, de propiedades, de casos de uso y de contrato.
6. Umbrales de cobertura.
7. Pruebas de integración contra Supabase local (migraciones desde cero + RLS).
8. Construcción de producción.
9. Despliegue de vista previa y pruebas extremo a extremo contra ella.
10. Escaneo de secretos *(propuesta: gitleaks)*.

La prueba de mutación corre en cada Pull Request que toque `packages/core` y, completa, al cierre de cada sprint.

### 5.2 Al cierre de cada fase de código

Además de todo lo anterior:

- [ ] Todas las historias del sprint cumplen la Definition of Done de `CONTRIBUTING.md`.
- [ ] Prueba de mutación completa con los umbrales del punto 4.2.
- [ ] La rama principal está desplegada en el entorno de pruebas y funciona.
- [ ] Lista de pruebas manuales en tablet completa y firmada.
- [ ] Documentación al día: requerimientos, reglas, glosario, ADRs, `PENDIENTES.md`, `CHANGELOG.md`.
- [ ] Revisión del sprint hecha (demo a Luis cuando aplique) y retrospectiva registrada.
- [ ] La compuerta específica de la fase, en su propio archivo, en verde.

**Si un solo punto queda en rojo, la fase no se cierra.**

---

## 6. Sin conexión: principios que aplican a todos los módulos

Se detallan en `docs/arquitectura/SINCRONIZACION.md` (Fase 2). Mientras tanto, ningún sprint los contradice:

1. **La tablet trabaja primero en local.** Toda captura (cotización, venta, pago) se guarda en IndexedDB y se encola para enviarse.
2. **Identificadores generados en el dispositivo** (UUID), para que un registro creado sin conexión tenga identidad desde el inicio.
3. **Operaciones idempotentes en el servidor.** Recibir dos veces la misma operación no duplica nada.
4. **Folios temporales en el dispositivo, definitivos en el servidor** [RN-16]. El folio definitivo se asigna dentro de la misma transacción que guarda el documento, para que no queden huecos.
5. **Lo contable se agrega, no se sobrescribe.** Pagos, ventas y cambios de estado son eventos que se suman; eso elimina la mayoría de los conflictos.
6. **Lo que requiere servidor se dice claramente.** Facturar, reportes consolidados y administración de usuarios necesitan conexión; la interfaz lo explica con palabras del oficio, sin jerga [GLOSARIO].

---

## 7. Disciplina de trabajo para agentes

- Una historia por rama y por Pull Request. Pull Requests pequeños.
- Antes de codificar, leer las reglas y requerimientos que cita la historia.
- Nunca resolver un `[POR DEFINIR]` con un valor inventado: configurable + `TODO(PD-xx)`.
- Si un requerimiento parece contradecir una regla, **detenerse y preguntar**. No elegir por cuenta propia.
- Si se toma una decisión técnica no trivial, escribir su ADR en el mismo Pull Request.
- Al terminar, reportar con datos: pruebas agregadas, cobertura, puntuación de mutación, qué quedó pendiente y por qué.
