# ADR-0036: Exportación de los datos del negocio en CSV, JSON y PDF, solo administradores y sin credenciales

- **Estado:** Aceptada (propuesta)
- **Fecha:** 2026-11-08
- **Decide:** Juanito (se propone en S5-08; confirmar al revisar el Sprint 5)

## Contexto

- El cliente debe poder llevarse sus datos en formatos estándar (CSV, JSON, PDF) al terminar la relación [RNF-22].
- La exportación junta datos personales de clientes y de facturas: debe ser solo de administradores, dejar rastro [RN-19] y no sacar nada que no sea del negocio (PIN, cuentas de acceso de las tablets, registros técnicos).
- La aplicación funciona sin internet y el archivo se arma en el navegador; no hay un servidor propio donde guardar archivos grandes.

## Decisión

1. **Una función de la base, `admin_export_data()`**, solo para administradores (`SECURITY DEFINER`, comprueba el rol dentro de la función). Entrega un JSON con 21 tablas del negocio (clientes, catálogo, cotizaciones, órdenes, ventas, pagos, turnos de caja, facturas, documentos legales, ajustes, bitácora, personas y tablets).
2. **Qué NO entrega, a propósito:** los PIN (sal, iteraciones, huella y versión); la cuenta de acceso de cada tablet; los códigos de registro, los contadores de folios, los intentos del portal, el registro de errores y el registro técnico de operaciones; del detalle de las facturas, el PDF en base64 (se vuelve a generar) y la solicitud guardada para reintentos (el XML y los datos sí van). La prueba pgTAP 23 y la de integración verifican que ninguna huella aparece en ninguna parte.
3. **Cada exportación queda en la bitácora** (`DATA_EXPORTED`, con quién la hizo y cuántos renglones por tabla). Un intento rechazado no deja nada.
4. **El archivo se arma en la aplicación**, con código puro en el núcleo (`buildExportPackage`): un JSON con todo, **un CSV por tabla** (RFC 4180, UTF-8 con marca de orden de bytes para Excel, importes en centavos, fechas en UTC, texto que Excel tomaría por fórmula con apóstrofo), un `LEEME.txt` que explica cómo leerlo y un **resumen en PDF** (columnas principales con nombres del oficio, importes en pesos y fechas de México; hasta 1,000 renglones por tabla, y dice cuántos quedan fuera: completos van en CSV y JSON). El ZIP se escribe sin comprimir y sin dependencias; el núcleo tampoco usa `TextEncoder` (no depende del navegador).
5. **Pantalla en Configuración** (solo administradores): *Preparar la exportación* y cuatro descargas (todo en un ZIP, JSON, CSV en ZIP y PDF), con el aviso de que son datos personales y deben guardarse en un lugar seguro. Si el PDF falla, lo demás se puede descargar.
6. **Límite de tiempo de la función:** 60 segundos.

## Consecuencias

- Es la copia **completa** del negocio. La copia de **un solo cliente** para atender una solicitud de sus derechos (acceso) no existe todavía: hoy se arma a mano desde su ficha (PP-34).
- Todo viaja en una sola respuesta. Con años de datos puede pesar decenas de megabytes y acercarse al límite de tiempo; si pasa, se parte por tablas (PP-34).
- Agregar una tabla del negocio exige agregarla a la función y a `EXPORT_TABLES` (el CSV y el JSON de una tabla desconocida ya salen completos, pero sin nombre del oficio en el PDF).
- Los estados y tipos van con su clave del sistema (por ejemplo `COMPLETED`); el `LEEME.txt` lo explica.
