# ADR-0032: Facturar desde el sistema: administrador con sesión, sin plazo y con elección explícita en pagos mixtos

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-05
- **Decide:** Juanito (se propone en S4-16; confirmar al revisar el Sprint 4)

## Contexto

- Un administrador debe poder facturar una venta u orden liquidada en segundos, aunque el cliente ya no pueda hacerlo en el portal por el plazo de fin de mes [RF-M10-04, RN-26].
- Un cajero solo puede facturar con la autorización de un administrador por PIN [RF-M10-08, S4-17]. Ese PIN se verifica **en la tablet, sin internet** (ADR-0013): el servidor no puede comprobarlo. Una factura timbrada no se puede "marcar por revisar" como una operación de la bitácora: es irreversible sin cancelarla.
- Las secciones de administración usan sesión de Supabase Auth (correo y contraseña), no la entrada con PIN de la tablet.
- La forma de pago de una factura con pago mixto la define el contador (PD-28).

## Decisión

1. **Función de servidor `facturar`, solo para administradores con sesión.** Verifica el token con Supabase Auth y exige `app_metadata.rol = 'ADMIN'` en el servidor [RNF-11]. Un cajero, con o sin sesión, recibe 403. La decisión de qué se puede facturar vive en el núcleo (`issueSystemInvoice`), que ya sabe pedir la autorización de un administrador a un cajero [S4-17].
2. **El camino "cajero con PIN de administrador" no se abre todavía:** habría que confiar en un `authorizedBy` que manda la tablet sin que el servidor pueda comprobar el PIN. Se propone en `PENDIENTES.md` (PP-31) y se pregunta a Luis si lo necesitan (pregunta 66). Mientras tanto, un cajero le pide al administrador que facture.
3. **Sin plazo de fin de mes:** un administrador sí puede facturar fuera de él [RN-26, S4-20]. Siguen aplicando lo liquidado, no cancelado y sin factura vigente [RN-24, RN-25].
4. **Pago mixto: elige quien factura.** El portal no factura pagos mixtos (ADR-0031), pero el administrador sí puede, eligiendo explícitamente `01` o `03`; la elección queda guardada con la factura. Con un pago puro, la forma sale de cómo se pagó y la elección se ignora. No se supone ninguna regla [PD-28].
5. **Una sola lectura de "qué trae un documento":** `private.invoice_source` sirve al portal (por folio y código) y a esta función (por identificador). Se ejecuta solo con el rol de servicio.
6. **Lo que ve el administrador sale de la base con permisos de administrador:** `admin_invoice_candidates()` (ventas y órdenes liquidadas, sin factura vigente ni en proceso y sin cancelar, con los datos fiscales de la ficha del cliente para precargar al receptor) y la lectura de los archivos de `invoice_requests`, que ya solo leen los administradores.
7. **El receptor se precarga de la ficha del cliente y se puede corregir** [RF-M10-05]. El administrador puede usar cualquier uso de CFDI del catálogo del SAT, no solo los que se le ofrecen al cliente del portal.
8. **Reenviar por WhatsApp** usa el menú de compartir del dispositivo con el PDF y, sin él, descarga el PDF y abre WhatsApp con un mensaje. El correo espera PD-50.
9. **Sección "Facturas" solo para administradores** en el menú secundario.

## Consecuencias

- Para que los cajeros puedan facturar desde la tablet con el PIN de un administrador hace falta diseñar cómo el servidor comprueba esa autorización (por ejemplo, un PIN verificado en el servidor con sesión del administrador). Queda como propuesta.
- Facturar requiere internet: el timbrado siempre ocurre en el servidor.
- Las facturas siguen siendo de prueba (sin validez fiscal) hasta conectar el PAC real (S4-15) [ADR-0031].
