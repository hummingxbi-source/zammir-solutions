# ADR-0002: Construir desde cero; la demo solo es referencia

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

Existe una demo visual en `HummingX-BI/formularios`, carpeta `demos/zammir-demo` (React 19 + Vite, ~6,700 líneas). Revisión del 26 de octubre:

- Mezcla lógica, datos y vista en cada componente.
- Calcula importes con números flotantes (`parseFloat`), lo que prohíbe [RN-05].
- Genera folios con `Math.random`, contrario a [RN-15] y [RN-16].
- Incluye librerías de animación (GSAP, Lenis) y un plan de "scrollytelling" con audio que no aplican a una herramienta de trabajo.
- Contiene restos del template de Vite y un archivo de tokens que no se usa y tiene errores de sintaxis.
- Fue hecha de forma improvisada y ni su autor la entiende a fondo.

## Decisión

El sistema se construye desde cero en un repositorio nuevo. **No se copia código de la demo.**

La demo solo sirve como referencia de lo que el cliente ya vio: distribución de pantallas, vocabulario y la identidad visual (paleta latón, vidrio, aluminio y oliva; tipografías Fraunces, Source Serif 4 e IBM Plex Mono). Si se adopta esa identidad, se redefine dentro del sistema de diseño nuevo, no se copia.

## Consecuencias

- Se gana una base limpia y entendible desde el primer commit.
- Se pierde la posibilidad de "ahorrar" pantallas, pero ese ahorro era aparente: había que reescribir la lógica de todas formas.
- El cliente vio la demo; las pantallas nuevas deben resultarle familiares para no generar sorpresa en las pruebas.
