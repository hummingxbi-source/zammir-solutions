# Pendientes y propuestas

> Todo lo que aún no está definido. **Nada de esta lista se inventa en el código**: se construye configurable o se espera la respuesta [DC §0 regla 1].
> Al resolverse un pendiente: se marca como resuelto, se actualiza el documento afectado y, si es una decisión, se registra su ADR.
>
> **Bloquea** = sí, si no se puede avanzar la parte afectada sin la respuesta.
> Última revisión: 26 de octubre de 2026.

## Abiertos

| ID | Pendiente | Responsable | Bloquea | Cuándo se necesita | Mientras tanto |
|---|---|---|---|---|---|
| PD-01 | Resto del documento de construcción: §7 Facturación y PAC, §8 Impresión, §12 Demo, §15 Pendientes y detalle de M10 | Juanito | Sí, para M10 y la prueba de impresión | 27 oct 2026 | Se trabaja con lo disponible |
| PD-02 | Reglas de precio por producto: área mínima, redondeo de medidas, cargos extra, mínimos [RN-02] | Luis | No | Antes de cargar el catálogo real | Regla básica sin mínimos [ADR-0006] |
| PD-03 | Catálogo real, 50 a 150 productos [DC RF-M1-05] | Luis | No | Etapa final | Catálogo de prueba inventado |
| PD-04 | Datos fiscales de ZAMMIR: RFC, régimen, e.firma vigente y CSD | Luis | Solo para facturar en producción | **Pedir ya**: el trámite del CSD puede tardar | Sandbox del PAC con datos de prueba [ADR-0007] |
| PD-05 | Elegir PAC | Juanito | Solo para facturar en producción | Antes de la última semana | Adaptador simulado [ADR-0007] |
| PD-06 | Garantía: duración, cobertura y exclusiones [RN-14] | Luis | No | Antes de pruebas con el cliente | Campos configurables; la demo usó 6 meses de relleno |
| PD-07 | Qué pasa con el anticipo si se cancela una orden [DC RF-M3-08] | Contrato | No | Antes de construir la cancelación | Se registra el motivo y el monto, sin regla automática |
| PD-08 | Confirmar base de "ventas" en reportes [RN-20] | Luis | No | Antes de pruebas con el cliente | Base de efectivo recibido |
| PD-09 | Plazo para autofacturar que aparece como leyenda en tickets y comprobantes [DC RF-M4-04] | Luis / contador | No | Antes de pruebas con el cliente | Texto configurable |
| PD-10 | Dominio del sistema | Juanito / Luis | No | Última semana | Dominio de prueba de Vercel |
| PD-11 | Logo, teléfono, dirección y datos de contacto de ZAMMIR para documentos | Luis | No | Antes de pruebas con el cliente | Datos de prueba |
| PD-12 | Texto final del aviso de privacidad y términos [DC RF-M9-01] | ZAMMIR con su asesor | No | Antes de producción | Borrador base de HummingX |
| PD-13 | Activar o no P1 (portal de seguimiento) | Luis | No | Antes de pruebas con el cliente | Apagado por interruptor |
| PD-14 | Activar o no P2 (existencias de piezas estándar) | Luis | No | Antes de pruebas con el cliente | Apagado por interruptor |
| PD-15 | Modelo de impresora térmica de 80 mm | Juanito | Sí, para la prueba de impresión | Semana 1 [ADR-0008] | — |
| PD-16 | Modelo de tablet (Wi-Fi o con datos móviles) | Juanito | No | Antes de comprar | — |
| PD-17 | Confirmar que Luis y Ricardo tienen exactamente los mismos permisos [DC §4] | Luis | No | Antes de construir permisos | Mismos permisos, configurable |
| PD-18 | Idioma de los identificadores en el código [ADR-0009] | Juanito | Sí, antes de escribir código | Fase 2 | Propuesta: inglés |
| PD-19 | Pasar a privado el repositorio de la demo (`HummingX-BI/formularios`), que hoy es público y contiene datos del cliente | Juanito | No | **Urgente** | — |
| PD-20 | Costo mensual de hosting en producción, para el contrato [ADR-0003] | Juanito | No | Antes de firmar | — |

## Resueltos

| ID | Pendiente | Resolución | Fecha |
|---|---|---|---|
| PR-01 | ¿Los precios incluyen IVA? [DC §5.6] | Sí, incluyen IVA [ADR-0004] | 26 oct 2026 |
| PR-02 | ¿Se imprime en tamaño carta? [DC RF-M2-06] | No, fuera del alcance [ADR-0005] | 26 oct 2026 |
| PR-03 | ¿Se reutiliza el código de la demo? | No, se construye desde cero [ADR-0002] | 26 oct 2026 |

## Propuestas

Funciones que alguien cree que faltan o sobran. **No se construyen** hasta que Juanito las apruebe [DC §0 regla 5].

| ID | Propuesta | Quién | Estado |
|---|---|---|---|
| — | (vacío) | — | — |
