# ADR-0028: Identidad visual v1 tomada de la demo, sin copiar código

- **Estado:** Propuesta (por aprobar por Juanito)
- **Fecha:** 2026-11-03
- **Decide:** Juanito
- **Concreta:** [ADR-0002], PD-35, [RNF-28], [RF-UX-01 a RF-UX-10]

## Contexto

La identidad visual del sistema es provisional (PD-35). Juanito prefiere la UI y la UX de la demo (`HummingX-BI/formularios`, carpeta `demos/zammir-demo`) y pidió tomarla como guía. [ADR-0002] ya permite usar la demo como referencia de la identidad visual (paleta y tipografías) siempre que se redefina dentro del sistema de diseño propio y **no se copie código**.

La revisión de la demo (ver `docs/producto/PLAN_UI_UX.md`) encontró cosas que sí sirven (sensación de papel y oficio, tarjetas con jerarquía, barra lateral, cotizador con documento en vivo, mostrador con ticket a la derecha, guía de primeros pasos) y otras que no se pueden adoptar: texto de 10 a 13 px y contrastes por debajo de 4.5:1 (rompen [RNF-28]), ayudas que solo aparecen con el cursor, tres azules distintos, fuentes descargadas de internet (no funcionan sin conexión) y librerías de animación pesadas.

## Decisión

1. **La identidad visual v1 se deriva de la demo y se redefine en tokens propios**: papel `#F4F1EC`, tinta `#26241F`, acento azul `#0F4C81` (a confirmar, D1 del plan), tipografías Fraunces, Source Serif 4 e IBM Plex Mono.
2. **No se copia código de la demo.** Se reescriben componentes con clases y tokens, con pruebas.
3. **Las fuentes se empaquetan con la aplicación** (latín, 400 y 700, `woff2`, ≤ 250 KB) y se guardan para uso sin internet.
4. **Se cumple [RNF-28] con ajustes a los valores de la demo:** texto de 16 px, objetivos de 44 px, contraste AA. Única excepción propuesta: rótulos de tarjeta en mayúsculas a 14 px (requiere modificar [RNF-28] por escrito).
5. **Movimiento solo con CSS** (`transform` y `opacity`, 150–250 ms), apagado con `prefers-reduced-motion`. No entran GSAP, Lenis ni Framer Motion.
6. **Gráficas en SVG propio**, con tabla equivalente para lectores de pantalla.
7. **El estado nunca se comunica solo con color:** siempre color más texto o ícono.
8. **No cambia ninguna regla de negocio:** cambia la vista y las clases, no los casos de uso ni el dominio.

## Consecuencias

- Hay un solo archivo de tokens y un conjunto de componentes base que usan todas las pantallas, incluidas las de legal y facturación.
- La carga inicial incluye las fuentes: se vigila el presupuesto de peso y [RNF-23].
- Si Juanito prefiere el latón como acento principal, cambia un token, no los componentes (aunque el latón claro no pasa AA como texto y quedaría para detalles).
- Esta decisión reemplaza la identidad provisional de PD-35 cuando se apruebe.
