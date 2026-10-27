# ADR-0010: Repositorios privados y sin datos reales

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

- El proyecto es confidencial [DC encabezado] y no se suben secretos ni datos reales [DC §0 regla 7].
- El 26 de octubre se detectó que el repositorio de la demo (`HummingX-BI/formularios`) es público y contiene el nombre del negocio, del dueño y la ubicación.

## Decisión

- Este repositorio y cualquier otro del proyecto son **privados**.
- No se suben claves ni secretos: se usan variables de entorno y un `.env.example` sin valores reales.
- No se usan datos reales de clientes de ZAMMIR en pruebas, semillas ni capturas de pantalla.
- El repositorio de la demo se pasa a privado (PD-19).

## Consecuencias

- Los agentes de IA tienen prohibido escribir datos reales de clientes en código, pruebas o documentación.
- Las semillas de datos de prueba se inventan.
