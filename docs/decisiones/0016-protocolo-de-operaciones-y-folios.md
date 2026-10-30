# ADR-0016: Protocolo de operaciones y asignación de folios

- **Estado:** Propuesta — se cierra cuando `spike/sync` pase [ADR-0012]
- **Fecha:** 2026-10-26
- **Decide:** Juanito
- **Detalle en:** `docs/arquitectura/SINCRONIZACION.md`
- **Concreta:** [ADR-0012], [RN-15], [RN-16]

## Contexto
Hay que enviar cambios hechos sin conexión de forma que no se dupliquen ni se pierdan, y numerar documentos sin huecos ni repetidos con dos tablets escribiendo a la vez.

## Decisión
1. **Todo cambio sale como una operación** con `opId` (UUID), `deviceId`, `seq`, tipo, versión de formato, usuario, autorizador y carga validada. El servidor guarda cada operación y su resultado; recibirla otra vez devuelve ese resultado.
2. **Orden por dispositivo** (`seq`); el servidor detecta saltos y pide reenvío.
3. **Folio definitivo** con `UPDATE folio_counters ... RETURNING` dentro de la transacción de la operación, como último paso. Bloqueo de fila = turnos, sin repetidos; la reversión de la transacción = sin huecos.
4. **Folio provisional** `T<n>-NNNN`, una serie por dispositivo, compartida por todos los tipos. Los borradores no tienen folio.
5. **Conflictos** según la tabla de `SINCRONIZACION.md` §6: lo contable se agrega; los cambios de estado inválidos se aplican "por revisar"; los clientes se resuelven por campo, gana el último que llega.
6. **Año del folio:** el de la fecha de emisión en hora de México (propuesta, PD-23).
7. **Ejecución en servidor:** una función que usa `packages/core` y una conexión directa a Postgres con transacción. *A validar en `spike/sync`; alternativa: función SQL.*

## Consecuencias
- Los folios siguen el orden de llegada, no el de creación.
- Una operación estructuralmente inválida detiene la cola de ese dispositivo y requiere atención.
- Lo "por revisar" es un estado de primera clase para administradores.
- Hay una tabla `operations` que crece; se archivará, no se borrará [RN-18].

## Alternativas consideradas
- **Folio asignado en la tablet con rangos reservados por dispositivo:** evita esperar al servidor, pero deja huecos y complica el cierre del año.
- **Secuencias de Postgres (`nextval`):** no se revierten al fallar la transacción y dejan huecos.
- **Última escritura gana para todo:** pierde pagos y estados; descartada para lo contable.
