# ADR-0023: Receptor de operaciones en dos capas y validación de la sincronización

- **Estado:** Aceptada (propuesta por el desarrollador; Juanito puede cambiarla). Cierra [ADR-0012] y [ADR-0016]
- **Fecha:** 2026-10-30
- **Decide:** Juanito (propuesta del desarrollador)
- **Concreta:** [ADR-0012], [ADR-0016], [RN-15], [RN-16], PD-23

## Contexto

[ADR-0016] pedía que el servidor ejecutara `packages/core` con una conexión directa a Postgres y una transacción, "a validar en `spike/sync`", y [ADR-0012] quedó condicionada a esa validación. La historia S2-01 pide demostrar con evidencia que la cola propia, la idempotencia y los folios sin huecos aguantan concurrencia y cortes.

## Decisión

1. **El receptor son dos capas.**
   - Una función de borde (`recibir-operacion`, Deno) valida el sobre y la carga con el **mismo código** que usa la tablet (`packages/core`) y entrega la operación a la base.
   - Una función SQL (`receive_operation`) hace, en **una sola transacción**: comprobar que quien manda es un dispositivo activo (y bloquear su fila), devolver el resultado guardado si el `opId` ya se aplicó, comprobar el orden por `seq`, aplicar el cambio, asignar el folio como último paso y guardar la operación con su resultado.
   - No se usa una conexión directa de la función de borde a Postgres: no hace falta y es frágil en funciones de borde. La alternativa que ADR-0016 dejaba abierta ("función SQL") es la que se adopta, con el dominio validando antes.
2. **El `spike/sync` se ejecuta como pruebas de integración sobre la implementación real**, no como rama desechable. Están en `apps/web/src/shared/infra/sync/` (`sync.integracion.test.ts`, `recibir-operacion.integracion.test.ts`, `pg-folio-allocator.integracion.test.ts`) y corren en CI. `pnpm test:concurrencia` las repite 10 veces seguidas (compuerta del sprint).
3. **Cada operación lleva el documento completo** (instantánea con líneas y totales). Los borradores no se envían. Las cargas deben ser consistentes (totales = suma de líneas); si no, se rechazan.
4. **Rechazos estructurales** (no se guarda nada; la tablet detiene su cola): dispositivo revocado o ajeno, tipo desconocido, carga inválida, sobre inválido. `OUT_OF_ORDER` no es estructural: se corrige reenviando desde `expectedSeq`. Una persona desactivada o desconocida **no** se rechaza: la operación se aplica y queda `TO_REVIEW` con motivo [ADR-0013, RN-18]. Un código público repetido tampoco se pisa: queda `TO_REVIEW` sin consumir folio.
5. **Folios:** `UPDATE folio_counters … RETURNING` como último paso; no se usan secuencias de Postgres porque no se revierten. **El año del folio es el de la fecha de emisión en hora de México** (PD-23, propuesta; falta confirmar con Luis).
6. **Código público** de documento: 8 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sin 0/O/1/I/L), generado en la tablet; el servidor exige que sea único.
7. **Las cotizaciones y las operaciones solo las escribe `receive_operation`**; la tablet no tiene permiso de escritura directa y no lee `operations`. Nada se borra.

## Evidencia (S2-01)

Contra Supabase local real, con dos tablets simuladas:
- 200 operaciones de dos dispositivos al mismo tiempo → folios 1 al 200, sin huecos ni repetidos.
- 60 operaciones con cortes de conexión al azar (25 % antes de llegar al servidor y 25 % con la respuesta perdida), reenviadas hasta confirmar → folios 1 al 60, un solo registro por operación.
- Cada operación enviada 2 o 3 veces a la vez → un solo registro por `opId` y el mismo resultado.
- Una tablet que junta 60 operaciones "por horas" las envía en orden y se pone al día sin pérdida.
- Una operación fuera de orden recibe `OUT_OF_ORDER` con la `seq` esperada y se corrige reenviando.
- La función de borde rechaza con la validación de `packages/core` una carga que no cumple.
- Las 10 rondas seguidas de `pnpm test:concurrencia` pasan.

## Consecuencias

- [ADR-0012] y [ADR-0016] quedan **Aceptadas** con esta evidencia.
- La recomputación de importes con las reglas de precio en el servidor se agrega con la cotización (S2-13); mientras tanto el servidor comprueba consistencia aritmética.
- El entorno local de funciones de borde limita las peticiones simultáneas; por eso las pruebas mandan en paralelo solo lo que representa tráfico real (dos tablets, copias de una misma operación).
- Si la ventana de operaciones crece mucho, se archivará `operations` (no se borra).
