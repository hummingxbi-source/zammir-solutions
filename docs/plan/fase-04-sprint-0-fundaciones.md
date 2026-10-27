# Fase 4 — Sprint 0: Fundaciones

- **Tipo:** código
- **Fechas:** 29 de octubre – 1 de noviembre de 2026
- **Lee antes:** [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md), `docs/arquitectura/` (Fase 2)

## Objetivo

Dejar listo el terreno: un repositorio donde es **imposible** fusionar código que rompa las reglas, una PWA vacía desplegada automáticamente en el entorno de pruebas, la entrada de administradores y el registro de tablets. Y responder la pregunta de mayor riesgo del proyecto: **¿se puede imprimir el ticket desde la tablet?**

## Entra si

- Fase 2 aprobada (estructura, herramientas y entornos decididos).
- Hay al menos una tablet Android disponible para pruebas.
- Hay al menos un modelo de impresora candidato para la prueba técnica (PD-15).

## Alcance

### 4.1 Repositorio y herramientas
- Estructura de carpetas aprobada en Fase 2 (`apps/web`, `packages/core`, `supabase/`).
- TypeScript estricto en todos los paquetes.
- Formato y lint con cero advertencias.
- Reglas de dependencia entre capas, verificadas automáticamente [00 §1.1].
- Pruebas: unitarias, de propiedades, de componentes, extremo a extremo y de mutación configuradas, cada una con un ejemplo real que pasa.
- Umbrales de cobertura configurados según [00 §4.2].
- Escaneo de secretos.
- Plantillas de Pull Request e Issues en `.github/`.

### 4.2 Integración y despliegue continuos
- Pipeline de GitHub Actions con los pasos de [00 §5.1], en ese orden.
- Despliegue automático a **pruebas** (staging) en cada fusión a `main` [ADR-0008].
- Vista previa por Pull Request para las pruebas extremo a extremo.
- Supabase local para desarrollo y para la integración continua; migraciones aplicadas desde cero en cada corrida.
- `.env.example` con todas las variables, sin valores.

### 4.3 Núcleo compartido (`packages/core/src/shared-kernel`)
- `Result` para errores de negocio tipados.
- Puertos `Clock` e `IdGenerator` con su adaptador real y su adaptador fijo para pruebas.
- Tipos base de identificadores (para que el id de un cliente no se pueda pasar donde va el de una orden).
- **No** se implementa todavía `Money`: es del Sprint 1, con su ADR de redondeo.

### 4.4 Aplicación web base
- PWA instalable: manifiesto, ícono, service worker que guarda la aplicación para abrir sin conexión.
- Sistema de diseño base en `shared/ui`: colores y tipografía como variables, botones y campos **grandes para uso táctil**, campo numérico que abre el teclado numérico, mensajes de error y de confirmación.
- Textos de la interfaz centralizados en un solo lugar, con la prueba de palabras prohibidas [GLOSARIO].
- Navegación base con las secciones del sistema (vacías), con los nombres del glosario: Cotizador, Órdenes, Mostrador, Clientes, Catálogo, Cuentas por cobrar, Reportes, Usuarios.
- Indicador visible de "sin conexión" con lenguaje del oficio.

### 4.5 Configuración del negocio
- Tabla de ajustes del negocio con los valores configurables conocidos: tasa de IVA (16%), porcentaje de anticipo (50%), vigencia de cotización (15 días), minutos de bloqueo por inactividad (5), umbral de antigüedad de cuentas por cobrar, y los interruptores P1 y P2 apagados.
- Puerto `FeatureFlags` leyendo esos interruptores.
- Valores [POR DEFINIR] presentes como ajustes vacíos o de prueba, con su `PD` en el comentario de la migración.

### 4.6 Acceso (primera parte de M8)
- Entrada de administradores con correo y contraseña; cierre de sesión por inactividad prolongada [DC §4].
- Registro de una tablet como "dispositivo del mostrador" por un administrador; listar y revocar dispositivos [RF-M8-02].
- Tabla de bitácora y su caso de uso de registro, usada desde ya por el registro y la revocación de dispositivos [RN-19].
- Políticas RLS de estas tablas.

### 4.7 Prueba técnica de impresión [ADR-0008]
En rama `spike/impresion-termica`, código desechable:
1. Listar los métodos posibles desde una PWA en Android para el modelo candidato (por ejemplo: Bluetooth desde el navegador, red local, aplicación puente instalada en la tablet). ⚠ PD-01: si la §8 del documento fuente describe un método, se prueba ese primero.
2. Imprimir desde la tablet real un ticket de prueba de 80 mm con texto con acentos y ñ, un total con centavos y un código QR.
3. Medir: ¿funciona sin internet? ¿cuánto tarda? ¿qué pasa si la impresora está apagada o sin papel?
4. Resultado en un ADR nuevo: método elegido, modelo de impresora recomendado, limitaciones. Juanito compra la impresora con base en ese ADR.

## Fuera de esta fase

- Dinero, precios, catálogo, PIN de empleados (Sprint 1).
- La implementación final del puerto `TicketPrinter` (Sprint 3); aquí solo se decide el método.

## Diseño

- **D:** la raíz de composición existe desde el primer día, aunque solo conecte `Clock`, `IdGenerator`, `FeatureFlags` y el repositorio de dispositivos.
- **L:** el patrón de pruebas de contrato se estrena con el repositorio de dispositivos (memoria y Supabase pasan la misma batería).
- **S:** casos de uso separados: `RegisterDevice`, `RevokeDevice`, `ListDevices`, `RecordAuditEntry`.

## Entregables

- Repositorio con estructura, herramientas y pipeline funcionando.
- Aplicación base desplegada en el entorno de pruebas e instalable en la tablet.
- Entrada de administradores y registro de dispositivos funcionando.
- ADR del resultado de la prueba de impresión.
- `README.md` con "Cómo levantarlo en local" probado desde cero.

## Pruebas obligatorias

**La compuerta se prueba a sí misma**
- [ ] Un Pull Request de prueba con un error de tipos, otro con una advertencia de lint, otro con una importación prohibida entre capas y otro con una prueba en rojo: **los cuatro deben quedar bloqueados** por la integración continua. Se documenta con capturas en el Pull Request de cierre y luego se cierran sin fusionar.
- [ ] Un Pull Request con un secreto falso debe ser bloqueado por el escaneo.

**Núcleo compartido**
- [ ] `Result`: éxito, error, encadenamiento.
- [ ] Reloj fijo devuelve siempre la misma hora; reloj real avanza.
- [ ] Generador fijo es determinista; generador real no repite en 10,000 llamadas.
- [ ] Los identificadores tipados no son intercambiables (prueba de tipos que debe fallar al compilar).

**Configuración del negocio**
- [ ] Los ajustes por defecto se crean con la migración inicial.
- [ ] Solo un administrador puede cambiar un ajuste (RLS).
- [ ] Con P1 y P2 apagados, sus rutas no aparecen en la navegación.

**Dispositivos y bitácora**
- [ ] Batería de contrato del repositorio de dispositivos: memoria y Supabase.
- [ ] Registrar, listar y revocar dispositivos genera su entrada de bitácora con usuario, fecha, valor anterior y nuevo.
- [ ] Un cajero no puede registrar ni revocar dispositivos (caso de uso y RLS).
- [ ] Un dispositivo revocado ya no puede operar.
- [ ] La bitácora no se puede modificar ni borrar desde ningún rol (RLS).

**Aplicación**
- [ ] Prueba de vocabulario: falla si algún texto contiene una palabra prohibida. Se prueba que efectivamente falla agregando una temporalmente.
- [ ] Extremo a extremo con tamaño de tablet: la aplicación carga, el manifiesto es válido, el administrador entra y registra la tablet.
- [ ] Extremo a extremo: con la aplicación ya cargada, se corta la red y la aplicación vuelve a abrir mostrando el indicador de sin conexión.
- [ ] Accesibilidad sin violaciones graves en las pantallas existentes.

**Manual en tablet**
- [ ] Instalar la PWA desde el entorno de pruebas.
- [ ] Abrirla en modo avión.
- [ ] Botones y campos cómodos con el dedo, en vertical y horizontal.

## Compuerta de salida

- [ ] Compuerta común de [00 §5.2] en verde.
- [ ] Los cinco Pull Requests de prueba de la compuerta quedaron bloqueados.
- [ ] Un clon nuevo del repositorio se levanta en local siguiendo solo el README.
- [ ] ADR de impresión aceptado por Juanito.

## Riesgos y pendientes

- **Si ningún método de impresión funciona desde la PWA**, se detiene el sprint y se decide con Juanito antes de seguir: es un cambio de arquitectura o de equipo.
- PD-15 (impresora), PD-16 (tablet), ⚠ PD-01 (§8).
