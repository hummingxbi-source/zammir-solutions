# ADR-0024: Clientes como operación en cola, réplica por número de cambio y folio reconciliado

- **Estado:** Aceptada (propuesta por el desarrollador; Juanito puede cambiarla). Sustituye a [ADR-0021]
- **Fecha:** 2026-10-31
- **Decide:** Juanito (propuesta del desarrollador)
- **Concreta:** [ADR-0012], [ADR-0016], [ADR-0022], [ADR-0023], [RN-16], [RN-19], [RNF-06]

## Contexto

[ADR-0021] dejó que la tablet diera de alta clientes directo en la tabla, como medida transitoria hasta que existiera la función de operaciones. Con el Sprint 2 la función existe, y un cotizador que necesita internet para dar de alta a un cliente nuevo no cumple el objetivo del proyecto (cotizar sin conexión en la obra). Además la cotización guarda en la tablet un folio provisional que, al confirmarse, debe cambiar por el definitivo.

## Decisión

1. **El cliente se guarda en la tablet y sale como operación `UpsertCustomer`.** El documento y la operación se guardan en la misma transacción local (la misma cola que las cotizaciones). El servidor la aplica con `private.apply_upsert_customer` dentro de `receive_operation`: alta si no existe; si existe, **por campo gana el último que llega** y el valor anterior queda en la bitácora (`CUSTOMER_UPSERTED`) [RN-19]. Un cliente anonimizado no se corrige: la operación queda `TO_REVIEW` con motivo `CUSTOMER_ANONYMIZED`.
2. **Se retira el permiso de insertar de la tablet** en `customers` (ADR-0021 queda sustituida). Los administradores siguen dando de alta y corrigiendo en línea, con datos fiscales; la tablet nunca los envía ni los baja [RNF-06].
3. **Réplica por número de cambio**, igual que el catálogo ([ADR-0022]): `customers.change_seq` (secuencia + disparador) y la vista `customers_for_device` (sin datos fiscales) con ese número. La tablet pide "lo que cambió después" de su último número y lo guarda en su base local. **Un cliente con un cambio todavía pendiente de envío no se sobrescribe** con la versión del servidor; cuando sale, el servidor tiene la última palabra.
4. **El folio definitivo se reconcilia en la tablet.** Después de cada pasada de envío, `reconcileQuotes` pone en cada cotización confirmada su folio definitivo, la marca "Enviado" (o "Guardado en la tablet" si aún tiene otro cambio por salir) y, si el servidor la dejó por revisar, el motivo. Es idempotente y se repite en cada pasada, así que un corte entre confirmar y reconciliar se corrige solo.
5. **Las condiciones de la cotización las edita un administrador en Configuración** (`business_settings.quote_conditions`, solo administradores por RLS). Cada cotización copia el texto al emitirse [RN-13].

## Consecuencias

- Se puede dar de alta a un cliente y cotizarle sin conexión; el cliente sale antes que su cotización, por el orden de la cola.
- **Pendiente (no construido):** bajar las cotizaciones propias del servidor por número de cambio (reinstalación de una tablet, historial entre tablets). Se deja registrado como PP-20; no bloquea el uso diario porque lo emitido en la tablet ya está en su base local.
- **Pendiente:** el aviso de privacidad vigente aún no viaja en la configuración bajada, así que un cliente nuevo desde la tablet queda sin versión de aviso (PP-21).
- Si dos tablets corrigen al mismo cliente a la vez, gana la que llega al final; la bitácora conserva lo anterior.
