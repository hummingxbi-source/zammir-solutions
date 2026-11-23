# ADR-0042: El recorrido guiado entra en la entrega

- **Estado:** Aceptada
- **Fecha:** 2026-11-23
- **Decide:** Juanito (HummingX BI)
- **Modifica:** [ADR-0019] (el recorrido guiado salía de la entrega salvo decisión en contrario)
- **Requerimiento:** RF-UX-04

## Contexto

El [ADR-0019] dejó fuera de la entrega el recorrido guiado con globos de ayuda [RF-UX-04] para cuidar el calendario. Al empezar a probar el sistema en producción, a Juanito le resultó confuso el arranque: tres formas de entrar (tablet, persona con PIN y administrador) y varias secciones sin una explicación de conjunto. Pide un recorrido por todo el sistema que enfoque cada parte de la pantalla, la explique con claridad, sea llamativo y se pueda repetir desde la barra.

## Decisión

1. **El recorrido guiado se construye y entra en la entrega.**
2. **Cómo funciona:** un velo oscurece la pantalla menos el elemento que se explica (con un anillo de luz animado) y un globo dice qué es, con avance ("Paso 3 de 18"), **Anterior**, **Siguiente** y **Saltar**. Recorre la bienvenida, las tres formas de entrar, el panel de inicio, las cinco secciones del flujo de trabajo (abriendo cada pantalla), las de administración visibles con los interruptores actuales, el aviso de conexión, quién usa la tablet, la cuenta de administrador, la ayuda "¿Por dónde empiezo?" y el botón para repetirlo.
3. **Cuándo aparece:** solo la primera vez que se abre la aplicación en cada equipo (se recuerda en el almacenamiento del navegador) y nunca en las pantallas de acceso. El botón **Recorrido guiado**, al pie de la barra de navegación, lo repite cuando se quiera.
4. **Sin librerías externas:** se construye con los componentes y colores del sistema para que funcione sin internet, se pueda probar y respete la accesibilidad (teclado, foco atrapado en el globo, lectores de pantalla y la preferencia de reducir movimiento [RF-UX-09]).
5. **Si un elemento no está en pantalla** (por ejemplo, nadie ha entrado con PIN o la barra está oculta), el paso se explica igual con el globo al centro.
6. Junto con el recorrido, el inicio explica las **tres formas de entrar** y el orden de la **configuración inicial** (PR #110).

## Consecuencias

- Se agregan unas 4 a 6 horas al Sprint 4; no cambia la fecha de entrega.
- Los textos de cada paso viven en `textos.recorrido` y se revisan con Luis en la capacitación; cambiarlos no toca la lógica.
- El recorrido refuerza, pero no sustituye, la capacitación con el equipo (S5-11 a S5-13).
