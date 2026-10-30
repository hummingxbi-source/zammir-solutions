# Sprint 0 — Fundaciones (29 oct – 1 nov)

> Plan: [`docs/plan/fase-04-sprint-0-fundaciones.md`](../plan/fase-04-sprint-0-fundaciones.md). Formato y tallas: [`README.md`](README.md).
> **Objetivo:** un repositorio donde es imposible fusionar código que rompa las reglas, una PWA vacía desplegada a pruebas, entrada de administradores, registro de tablets y la respuesta a **¿se puede imprimir el ticket desde la tablet?**
> **Entra si:** Fase 2 aprobada (ver `CAPACIDAD.md` sobre el cruce con el cierre de la Fase 2), una tablet Android disponible y un modelo de impresora candidato (PD-15).

### S0-01 · Estructura del repositorio y TypeScript estricto · M · 4 h
Como Juanito (desarrollador)
quiero el monorepo con `apps/web`, `packages/core` y `supabase/` configurado con TypeScript estricto
para que todo el código nazca con las mismas reglas.
- **Requerimientos:** RNF-32, RNF-33 · **Reglas:** CLAUDE.md regla 3 · **Decisión:** ADR-0014
- **Criterios de aceptación:**
  - Dado un clon nuevo, cuando se instalan las dependencias, entonces el comando de construcción termina sin errores en todos los paquetes.
  - Dado `strict` y `noUncheckedIndexedAccess`, cuando se escribe un `any` o el operador `!`, entonces la revisión de tipos o el lint lo rechaza.

### S0-02 · Lint, formato y reglas de dependencia entre capas · S · 2 h
Como Juanito (desarrollador)
quiero lint con cero advertencias y una herramienta que verifique las capas
para que el dominio nunca importe React ni Supabase.
- **Requerimientos:** RNF-33 · **Reglas:** `00-principios` §1.1 y §3
- **Criterios de aceptación:**
  - Dado el dominio, cuando importa `supabase-js`, `dexie` o React, entonces la verificación de dependencias falla.
  - Dado cualquier advertencia de lint, cuando corre la verificación, entonces falla (cero advertencias).

### S0-03 · Herramientas de prueba y umbrales · L · 8 h
Como Juanito (desarrollador)
quiero configuradas las pruebas unitarias, de propiedades, de componentes, extremo a extremo y de mutación, cada una con un ejemplo que pasa
para tener la red de seguridad desde el primer día.
- **Requerimientos:** RNF-33 · **Reglas:** `00-principios` §4 · **Decisión:** ADR-0014
- **Criterios de aceptación:**
  - Dado cada tipo de prueba, cuando se ejecuta su comando, entonces corre un ejemplo real y pasa.
  - Dado un umbral de cobertura configurado según `00-principios` §4.2, cuando la cobertura baja, entonces el comando falla.
  - Dado `it.skip` o `it.only`, cuando se ejecuta el lint, entonces falla.
  - Dado un navegador con tamaño de tablet, cuando corre una prueba extremo a extremo de ejemplo, entonces carga la aplicación.
  - Dadas pruebas con zonas horarias distintas a México, cuando corren, entonces el ejemplo pasa en todas [`00-principios` §4.3].

### S0-04 · Integración continua en el orden de la compuerta · L · 8 h
Como Juanito (desarrollador)
quiero un pipeline que corra los pasos de `00-principios` §5.1 y se detenga en el primer fallo
para que nada roto llegue a `main`.
- **Requerimientos:** RNF-13, RNF-33 · **Reglas:** `00-principios` §5.1 · **Decisión:** ADR-0010
- **Criterios de aceptación:**
  - Dado un Pull Request, cuando corre la integración continua, entonces ejecuta en orden: instalación limpia, lint, tipos, capas, pruebas, cobertura, base de datos, construcción, vista previa y escaneo de secretos.
  - Dado un paso en rojo, cuando falla, entonces los siguientes no corren y el Pull Request queda bloqueado.
  - Dado un secreto falso en el código, cuando corre el escaneo, entonces falla.
  - Dadas las plantillas de Pull Request e Issues en `.github/`, cuando se abre uno nuevo, entonces aparecen los campos de requerimiento, regla, cómo se probó y capturas con datos inventados.

### S0-05 · Supabase local, migraciones desde cero y variables · M · 4 h
Como Juanito (desarrollador)
quiero Supabase local y migraciones versionadas que se aplican desde cero en cada corrida
para probar la base y sus políticas sin tocar la nube.
- **Requerimientos:** RNF-10, RNF-13, RNF-32 · **Reglas:** RN-18
- **Criterios de aceptación:**
  - Dada una base vacía, cuando se aplican todas las migraciones, entonces terminan sin errores.
  - Dado `.env.example`, cuando se compara con las variables que usa el código, entonces están todas y ninguna trae valor real.
  - Dado el clon nuevo, cuando se sigue el README, entonces se levanta Supabase local.

### S0-06 · Despliegue automático a pruebas y vista previa por Pull Request · M · 4 h
Como Juanito (desarrollador)
quiero que cada fusión a `main` se despliegue al entorno de pruebas y cada Pull Request tenga su vista previa
para probar en la tablet real desde el primer día.
- **Requerimientos:** RNF-08, RNF-13 · **Reglas:** ADR-0008 · **Pendientes:** PD-10 (dominio de prueba de Vercel mientras tanto)
- **Criterios de aceptación:**
  - Dada una fusión a `main`, cuando termina la integración continua, entonces la versión nueva está en el entorno de pruebas por HTTPS.
  - Dado un Pull Request, cuando termina la construcción, entonces existe una dirección de vista previa y las pruebas extremo a extremo corren contra ella.

### S0-07 · La compuerta se prueba a sí misma · S · 2 h
Como Juanito (desarrollador)
quiero demostrar que cuatro tipos de error y un secreto quedan bloqueados
para confiar en que la compuerta funciona.
- **Reglas:** CLAUDE.md regla 11 · **Plan:** fase 4, "La compuerta se prueba a sí misma"
- **Criterios de aceptación:**
  - Dados cuatro Pull Requests (error de tipos, advertencia de lint, importación prohibida entre capas, prueba en rojo), cuando corre la integración continua, entonces los cuatro quedan bloqueados.
  - Dado un Pull Request con un secreto falso, cuando corre el escaneo, entonces queda bloqueado.
  - Dadas las capturas, cuando se documentan en el Pull Request de cierre, entonces los cinco Pull Requests de prueba se cierran sin fusionar.

### S0-08 · Núcleo compartido y raíz de composición · M · 4 h
Como Juanito (desarrollador)
quiero `Result`, `Clock`, `IdGenerator`, identificadores tipados y la raíz de composición
para que el dominio sea determinista y probable sin red ni navegador.
- **Reglas:** `00-principios` §3.4 y §3.5 · **Decisión:** ADR-0014
- **Criterios de aceptación:**
  - Dado `Result`, cuando se encadenan éxito y error, entonces se propagan con su tipo de error.
  - Dado el reloj fijo, cuando se pide la hora, entonces devuelve siempre la misma; el real avanza.
  - Dado el generador real, cuando se piden 10 000 identificadores, entonces no se repite ninguno; el fijo es determinista.
  - Dados un id de cliente y uno de orden, cuando se pasa uno donde va el otro, entonces no compila (prueba de tipos).

### S0-09 · PWA instalable que abre sin conexión · L · 8 h  · `tablet`
Como cajero
quiero instalar la aplicación en la tablet y abrirla aunque no haya internet
para poder trabajar en la obra.
- **Requerimientos:** RNF-01, RNF-02, RNF-31, RF-UX-06 (conexión) · **Decisión:** ADR-0003, ADR-0008
- **Criterios de aceptación:**
  - Dado el entorno de pruebas, cuando se abre en Chrome de la tablet, entonces se puede instalar y su manifiesto es válido.
  - Dada la aplicación ya cargada, cuando se corta la red y se vuelve a abrir, entonces carga y muestra el indicador de sin conexión con lenguaje del oficio.
  - *(manual)* Instalar desde el entorno de pruebas y abrirla en modo avión en la tablet real.

### S0-10 · Sistema de diseño base · L · 8 h  · `tablet`
Como cajero
quiero botones y campos grandes que se usen bien con el dedo y un campo numérico con teclado numérico
para capturar medidas y montos sin errores.
- **Requerimientos:** RNF-28, RNF-29, RNF-30, RF-UX-07, RF-UX-08, RF-UX-09 · **Reglas:** RN-22, RN-23 · **Pendientes:** PD-35 (identidad provisional según la guía del documento)
- **Criterios de aceptación:**
  - Dado cualquier botón o campo, cuando se mide, entonces el objetivo táctil es de al menos 44 px y el texto de al menos 16 px.
  - Dado un campo numérico, cuando se toca, entonces abre el teclado numérico.
  - Dados los formatos, cuando se aplican, entonces dan `$1,234.50`, `27 oct 2026` y teléfono de 10 dígitos.
  - Dado un usuario con "reducir movimiento", cuando se muestra una animación, entonces no se anima.
  - Dada una acción destructiva, cuando se intenta, entonces pide confirmación; un error muestra qué hacer.
  - Dadas las pantallas existentes, cuando corre la revisión de accesibilidad, entonces no hay violaciones graves.

### S0-11 · Textos centralizados y prueba de vocabulario · S · 2 h
Como Juanito (desarrollador)
quiero todos los textos de la interfaz en un solo lugar con una prueba de palabras prohibidas
para que "checkout", "carrito" o "Punto de Venta" nunca lleguen a la pantalla.
- **Reglas:** CLAUDE.md regla 6, GLOSARIO
- **Criterios de aceptación:**
  - Dado un texto con una palabra prohibida del glosario, cuando corre la prueba, entonces falla.
  - Dada la prueba, cuando se agrega una palabra prohibida temporalmente, entonces falla (se verifica que sí detecta).

### S0-12 · Navegación base y panel de inicio con accesos · M · 4 h
Como administrador
quiero ver las secciones en el orden del trabajo, con un panel de inicio aparte
para saber por dónde empezar.
- **Requerimientos:** RF-UX-01 · **Pendientes:** PD-31 (contenido del panel de inicio por rol: mientras tanto, accesos sin cifras)
- **Criterios de aceptación:**
  - Dado el menú, cuando se muestra, entonces el orden es Catálogo, Cotizador, Órdenes de trabajo, Mostrador y Reportes, con numeración discreta y marca de visitadas.
  - Dado el logo, cuando se toca, entonces abre el panel de inicio; Clientes, Cuentas por cobrar, Usuarios y configuración quedan en un menú secundario.
  - Dado P1 y P2 apagados, cuando se navega, entonces sus rutas no aparecen.

### S0-13 · Configuración del negocio e interruptores · M · 4 h
Como administrador
quiero que los porcentajes, plazos y interruptores estén en una tabla de ajustes
para cambiarlos sin pedir un cambio de código.
- **Requerimientos:** RNF-36 · **Reglas:** RN-06, RN-08, RN-12, RN-26, RN-27 · **Pendientes:** PD-21, PD-22, PD-33 (valores configurables, con su PD en la migración); ADR-0015
- **Criterios de aceptación:**
  - Dada la migración inicial, cuando se aplica, entonces crea los ajustes por defecto (IVA 16 %, anticipo 50 %, vigencia 15 días, bloqueo 5 minutos, umbral de antigüedad 10 días, anticipos opción a).
  - Dado un cajero, cuando intenta cambiar un ajuste, entonces la base lo rechaza.
  - Dado el puerto `FeatureFlags`, cuando P1 y P2 están apagados, entonces devuelve falso.
  - Dado un valor [POR DEFINIR], cuando se revisa su ajuste, entonces está vacío o de prueba y cita su PD.

### S0-14 · Entrada de administradores · M · 4 h
Como administrador
quiero entrar con correo y contraseña y que la sesión se cierre por inactividad
para proteger el sistema.
- **Requerimientos:** RF-M8-01 (parte), RNF-09 · **Pendientes:** PD-21 (tiempo configurable) · **Decisión:** ADR-0013
- **Criterios de aceptación:**
  - Dado un correo y contraseña válidos, cuando se entra, entonces se abre la sesión de administrador.
  - Dado el tiempo de inactividad configurado, cuando se cumple (reloj fijo), entonces la sesión se cierra.
  - Dado un rol de cajero, cuando intenta una pantalla de administrador, entonces no se le muestra.

### S0-15 · Bitácora de acciones sensibles · M · 4 h
Como administrador
quiero que las acciones sensibles queden registradas con usuario, dispositivo, fecha y valores anterior y nuevo
para saber quién hizo qué.
- **Requerimientos:** RF-M8-03 (tabla y registro) · **Reglas:** RN-19, RN-18
- **Criterios de aceptación:**
  - Dada una acción sensible, cuando ocurre, entonces `RecordAuditEntry` guarda usuario, dispositivo, hora en UTC, valor anterior y nuevo.
  - Dado cualquier rol, cuando intenta modificar o borrar una entrada de bitácora, entonces la base lo rechaza.

### S0-16 · Registro, listado y revocación de dispositivos · L · 8 h  · `tablet`
Como administrador
quiero registrar la tablet con un código de un solo uso, ver los dispositivos y revocarlos
para que solo los equipos de ZAMMIR operen.
- **Requerimientos:** RF-M8-02 · **Reglas:** RN-19 · **Decisión:** ADR-0013
- **Criterios de aceptación:**
  - Dado un código de registro vigente, cuando una tablet lo canjea, entonces se crea el dispositivo y el código ya no sirve.
  - Dado un código vencido o usado, cuando se canjea, entonces se rechaza.
  - Dado un dispositivo revocado, cuando intenta operar o enviar, entonces se rechaza.
  - Dado un cajero, cuando intenta registrar o revocar, entonces el caso de uso y la base lo rechazan.
  - Dados registrar, listar y revocar, cuando ocurren, entonces generan su entrada de bitácora.
  - Dado el repositorio de dispositivos, cuando corre la batería de contrato, entonces pasan memoria y Supabase la misma.

### S0-17 · Validación: `packages/core` dentro de una función de servidor · S · 2 h
Como Juanito (desarrollador)
quiero comprobar que una función de Supabase puede usar `packages/core`
para saber si la hipótesis de ADR-0016 se sostiene.
- **Decisión:** ADR-0014, ADR-0016 · **Rama:** `spike/` desechable
- **Criterios de aceptación:**
  - Dada una función de ejemplo que usa un tipo de `packages/core`, cuando se ejecuta en Supabase local, entonces responde correctamente.
  - Dado el resultado, cuando se registra, entonces queda escrito en ADR-0016 o ADR-0014 (funciona o requiere alternativa).

### S0-18 · Prueba de concepto de impresión · L · 8 h  · `tablet` · ⛔ PD-15
Como Juanito (desarrollador)
quiero imprimir un ticket de 80 mm desde la PWA con la impresora real del lote que se va a comprar
para saber ahora si el proyecto puede imprimir.
- **Requerimientos:** RNF-26 · **Reglas:** E10 (parte de impresión) · **Decisión:** ADR-0008, ADR-0018 · **Pendientes:** PD-15 (modelo de impresora), PD-16 (tablet). Sin impresora no hay historia
- **Criterios de aceptación:**
  - Dada la impresora, cuando se descubren sus servicios, entonces se documentan el servicio y la característica de escritura y el tamaño de fragmento estable.
  - Dado un ticket de prueba, cuando se imprime, entonces salen acentos y ñ, un logo y un QR que otro teléfono escanea, con corte automático.
  - Dados 30 tickets seguidos, cuando se imprimen, entonces no hay pérdidas ni desincronización.
  - Dada la impresora apagada y encendida o la tablet bloqueada, cuando se reconecta, entonces vuelve a imprimir.
  - Dada la tablet sin internet, cuando se repite, entonces imprime igual.
  - Dado el tiempo de un ticket, cuando se mide, entonces se compara con RNF-26 (menos de 5 s).
  - Dado el resultado, cuando se escribe el ADR, entonces incluye modelo, servicio, fragmento, página de códigos, tiempos, limitaciones y fotos, y Juanito lo acepta.
- **Si la capa 1 falla:** se prueba la capa 2 y se avisa a Juanito ese mismo día; ZAMMIR no compra más equipo hasta cambiar de modelo [DC §8.4].

### S0-19 · README de arranque probado desde cero · XS · 1 h
Como Juanito (desarrollador)
quiero un README con "Cómo levantarlo en local" probado en un clon nuevo
para retomar el trabajo sin recordar nada.
- **Requerimientos:** RNF-32
- **Criterios de aceptación:**
  - Dado un clon nuevo, cuando se siguen solo los pasos del README, entonces la aplicación corre en local.

### S0-20 · Cierre del Sprint 0 · S · 2 h  · `tablet`
Como Juanito (desarrollador)
quiero cerrar el sprint con la compuerta común y la lista de tablet
para que el Sprint 1 empiece sobre terreno firme.
- **Reglas:** `00-principios` §5.2 · **Plan:** compuerta de salida de la fase 4
- **Criterios de aceptación:**
  - Dada la compuerta común, cuando se corre completa, entonces está en verde.
  - Dado un clon nuevo, cuando se sigue el README, entonces se levanta (S0-19).
  - Dados los cinco Pull Requests de prueba, cuando se revisan, entonces quedaron bloqueados (S0-07).
  - *(manual)* Lista de tablet firmada: instalar la PWA, abrirla en modo avión, botones cómodos en vertical y horizontal.
  - Dada la revisión del sprint, cuando termina, entonces la retrospectiva y la recalibración de tallas quedan registradas.
