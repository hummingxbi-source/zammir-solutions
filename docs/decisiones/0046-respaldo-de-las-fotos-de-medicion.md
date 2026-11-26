# ADR-0046: Respaldo de las fotos de medición por el protocolo S3, con las dos copias más recientes

- **Estado:** Aceptada
- **Fecha:** 2026-11-25
- **Decide:** Juanito (HummingX BI), a propuesta de Claude
- **Resuelve:** PD-57
- **Concreta:** [ADR-0045] punto 6 (respaldo en un entorno propio, con fotos)

## Contexto

- El respaldo nocturno (`respaldo-nocturno.yml`) copiaba solo la base: los datos de `public` y las cuentas (`auth.users` y `auth.identities`). Las fotos de medición viven aparte, en el depósito privado `order-photos` de Supabase Storage, y **no se copiaban**.
- Las fotos no se cambian ni se borran desde la aplicación [RN-18]. Su ruta es `<id de la orden>/<id de la foto>.jpg`, sin datos personales. Cada una pesa hasta 800 KB y caben hasta 10 por orden (`order-photos.ts`).
- Con `pg_dump` no se pueden copiar: la base solo guarda su registro en `storage.objects`, no el archivo.
- Las copias van como artefactos de GitHub. Con el repositorio privado y la cuenta gratuita, el almacenamiento de artefactos tiene límite [ADR-0045].

## Decisión

1. **Cómo se copian:** por el **protocolo S3 de Supabase Storage**, con una llave S3 **del proyecto** (no de la cuenta) que se guarda en los secretos del entorno `respaldo`. El script `scripts/fotos-de-medicion.sh` usa la imagen oficial de la CLI de AWS en Docker, con la versión fija, igual que el respaldo ya usa `postgres:17`.
2. **Qué se guarda:** cada noche, después de guardar la copia de la base, se copian **todas** las fotos, se cifran igual que la base (AES-256 con `CLAVE_DE_RESPALDO`) y se guardan como el artefacto `fotos-zammir-AAAA-MM-DD`.
3. **Cuántas copias:** como las fotos solo se agregan, la copia más reciente trae todas. Se conservan las **dos más recientes**. Las viejas se borran **solo después** de guardar la nueva, para que siempre quede al menos una.
4. **Orden de los pasos:** si las fotos fallan, la copia de la base ya quedó guardada y el flujo sale en rojo para avisar.
5. **Cómo se restauran:** se descifra la copia y se suben con `scripts/fotos-de-medicion.sh restaurar`, que **agrega** lo que falte y nunca borra (`sync` sin `--delete`). Las fotos restauradas quedan sin dueño en `storage.objects`. Las políticas del depósito no dependen del dueño: se basan en si quien lee es tablet o administrador.

## Consecuencias

- El respaldo necesita cuatro secretos nuevos en el entorno `respaldo` y lee de ahí también `SUPABASE_DB_URL` y `CLAVE_DE_RESPALDO`.
- El flujo necesita el permiso `actions: write` para borrar las copias de fotos viejas.
- La llave S3 da acceso de lectura y escritura a todo el almacenamiento **del proyecto**. Se rota como las demás llaves (`GUIA_DE_OPERACION.md` §5) y se crea una nueva al recrear el proyecto en la entrega.
- El tamaño de cada copia crece con las fotos. Con el repositorio privado, dos copias deben caber en el almacenamiento de artefactos de la cuenta gratuita: se vigila mensualmente (PD-58).
- Se probó en Supabase local, con fotos inventadas: subir, copiar, cifrar, descifrar, borrar del depósito y restaurar dejaron el depósito idéntico a la copia. Con el proyecto en la nube se comprueba al correr el flujo a mano.

## Alternativas consideradas

- **La llave de servicio y la API de Storage:** descartada porque esa llave salta la seguridad de toda la base, no solo del almacenamiento.
- **El token de la cuenta con la CLI de Supabase:** descartada porque el token alcanza también el proyecto del otro cliente.
- **Guardar 30 días de fotos, como la base:** descartada porque son 30 veces el tamaño y no aportan nada, ya que las fotos no cambian.
- **Copias por diferencia** (solo las fotos nuevas de cada día): descartada porque para restaurar habría que juntar muchas copias y basta con que expire una para perder fotos.
