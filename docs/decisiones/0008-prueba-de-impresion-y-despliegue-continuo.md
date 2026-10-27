# ADR-0008: Prueba de impresión en la semana 1 y despliegue continuo a pruebas

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

- Imprimir tickets por conexión inalámbrica desde una aplicación web en Android es uno de los dos riesgos que pueden romper el proyecto [DC §0 regla 3].
- Juanito comprará la impresora; si un modelo no funciona desde la PWA, hay que saberlo antes de comprarlo.
- Una PWA solo se instala y funciona sin conexión cuando se sirve por HTTPS, así que no se puede probar bien en la tablet desde la computadora local.

## Decisión

1. **Semana 1:** prueba técnica corta de impresión de un ticket de 80 mm desde la PWA en una tablet Android real, antes de comprar la impresora definitiva (PD-15). El resultado y el modelo elegido se registran en un ADR.
2. **Desde el Sprint 0:** cada cambio en la rama principal se despliega automáticamente a un **entorno de pruebas** (staging) en Vercel, y la app se prueba cada semana en la tablet real.
3. El despliegue a **producción**, el dominio y las conexiones reales quedan para la última semana.

## Consecuencias

- La impresión queda detrás de una interfaz propia, igual que la facturación, por si hay que cambiar de modelo o de método.
- Los problemas de instalación y modo sin conexión aparecen semana a semana, no al final.
