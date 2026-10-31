# ADR-0022: Catálogo en la tablet: IndexedDB con Dexie y cambios por número

- **Estado:** Aceptada (propuesta por el desarrollador; Juanito puede cambiarla)
- **Fecha:** 2026-10-30
- **Decide:** Juanito (propuesta del desarrollador)

## Contexto

La tablet debe poder cotizar y vender sin internet [RNF-01]. Necesita una copia local del catálogo que se ponga al día sola cuando hay conexión, sin bajar todo cada vez y sin duplicar productos cuando cambia un precio.

## Decisión

1. **Almacén local: IndexedDB a través de Dexie.** Es la base que ofrece el navegador para datos estructurados y volúmenes mayores que `localStorage`; Dexie evita escribir a mano las transacciones. Las pruebas usan `fake-indexeddb`.
2. **Cambios por número.** Cada alta o cambio de un producto recibe en la base un número que solo crece (`change_seq`, asignado por un disparador). La tablet guarda el último que recibió y pide "lo que cambió después". Cada producto se guarda por su id, así un cambio de precio lo reemplaza.
3. **Los desactivados también viajan**, con su marca, para que la tablet deje de ofrecerlos [RF-M1-04]. Nada se borra [regla 4].
4. **Las categorías se bajan completas** (son pocas).
5. **Qué ve la tablet:** la vista `catalog_products_for_device`, solo para administradores y tablets activas; no incluye datos fiscales ni de administración.
6. **Sin conexión no se toca lo guardado.** Si una bajada se corta, lo ya guardado se queda y la siguiente continúa desde el último número recibido.
7. **Sesión de la tablet aparte.** La réplica usa un cliente propio con la sesión de la tablet, para no mezclarla con la de un administrador; si la sesión se renueva, se guarda la nueva.

## Consecuencias

- Se agregan `dexie` y, solo para pruebas, `fake-indexeddb`.
- El cotizador lee de `localProductReader`, que cumple el mismo puerto que el lector del servidor.
- Pendiente: prueba manual en la tablet real en modo avión; límite de espacio del navegador según el número de productos.
