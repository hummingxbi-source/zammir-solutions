# ADR-0009: Idioma del código

- **Estado:** Aceptada (confirmada por Juanito el 2026-10-26, resuelve PD-18)
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

La interfaz va en español de México con el vocabulario del oficio [DC §0 regla 6]. Hay que decidir en qué idioma se nombran tablas, tipos, funciones y archivos.

## Decisión

- **Código en inglés:** tablas, tipos, funciones, variables, carpetas y archivos de código.
- **Interfaz, documentación, mensajes al usuario y commits en español.**
- `docs/producto/GLOSARIO.md` es la traducción oficial entre ambos (anticipo → `deposit`). Nadie inventa una traducción distinta.

**Por qué:** las librerías, el framework y la mayoría del material técnico están en inglés, y mezclar idiomas dentro del código (`getAnticipoById`) es lo que más ensucia. El glosario evita que el mismo concepto tenga tres nombres.

## Alternativa

- **Dominio en español** (`Cotizacion`, `anticipo`): más cercano al cliente, pero choca con todo lo que viene del framework y con acentos y la "ñ" en identificadores.
