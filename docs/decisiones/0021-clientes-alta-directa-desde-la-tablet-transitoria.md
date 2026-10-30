# ADR-0021: La tablet da de alta clientes directo en la base (transitorio hasta el Sprint 2)

- **Estado:** Aceptada como medida transitoria
- **Fecha:** 2026-10-30
- **Decide:** Juanito (propuesta del desarrollador)

## Contexto

`MODELO_DE_DATOS.md` y [ADR-0012](0012-motor-de-sincronizacion.md) dicen que la tablet no escribe en las tablas: envía operaciones a una función del servidor. Esa función llega con el Sprint 2. La historia S1-10 (clientes) se construye antes y la tablet necesita poder capturar clientes.

## Decisión

Hasta que exista la función de operaciones:

- La tablet (dispositivo **activo**) puede **dar de alta** clientes escribiendo directo en `customers`, con una política que **solo acepta** filas sin datos fiscales ni anonimización.
- La tablet **lee** clientes por la vista `customers_for_device`, **sin columnas fiscales** (RNF-06).
- La tablet **no corrige ni anonimiza** clientes: eso es de administradores (sesión de Auth) por la base.
- Un dispositivo revocado deja de ver y de dar de alta.

## Consecuencias

- Cuando llegue la función de operaciones (Sprint 2), se **retira** el permiso de inserción directa del dispositivo y el alta pasa por la operación idempotente con su cola local.
- Mientras tanto no hay cola sin conexión para altas de clientes: sin internet no se pueden registrar clientes nuevos desde la tablet. Se acepta porque el cotizador sin conexión llega en el Sprint 2.
- La bitácora de altas de clientes no existe en este periodo (no es una acción sensible de RN-19).
