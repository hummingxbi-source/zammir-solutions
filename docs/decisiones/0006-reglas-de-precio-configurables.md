# ADR-0006: Reglas de precio configurables por producto

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

El precio "depende del producto" y las reglas concretas (área mínima, redondeo de medidas, cargos extra, mínimos) aún no las envía el cliente [DC §5.1], PD-02. No se puede esperar a tenerlas para construir el cotizador.

## Decisión

- Cada producto tiene asignada una **regla de precio** con sus **parámetros guardados en la base de datos**, no en el código ni como variables comentadas.
- Cada tipo de regla es una pieza intercambiable con la misma interfaz: recibe medidas, cantidad y parámetros, y devuelve el importe y el detalle del cálculo.
- Mientras no lleguen los datos, todos los productos usan la **regla básica**: precio × cantidad en su unidad, sin mínimos ni redondeos.
- Cuando lleguen, los parámetros se capturan desde el panel o en el CSV del catálogo, sin redesplegar.
- Si aparece una regla nueva, se agrega como un tipo nuevo, sin modificar los existentes.

## Consecuencias

- El cotizador y el mostrador no saben cómo se calcula un precio; solo piden el cálculo a la regla del producto.
- Cada regla tiene sus propias pruebas.
- El detalle del cálculo que devuelve la regla es el que se muestra al usuario [RN-04].
