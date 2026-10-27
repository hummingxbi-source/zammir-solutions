# Pruebas de aceptación

> Fuente: [DC §14]. Recorridos completos que **deben pasar antes de entregar**, siempre con datos de prueba, nunca reales.
> Cada recorrido se automatiza como prueba extremo a extremo en el sprint indicado y se repite completo en el Sprint 5, con el equipo real.

## Recorridos

| ID | Recorrido | Sprint donde se automatiza | Cómo se verifica |
|---|---|---|---|
| E1 | Medir a domicilio, cotizar con medidas, generar PDF, compartirlo por WhatsApp, aceptarlo, crear la orden, cobrar anticipo, avanzar estatus, entregar, cobrar saldo y generar el comprobante con garantía y QR | 3 | Extremo a extremo + manual en tablet |
| E2 | Venta de mostrador en efectivo, en transferencia y mixta; ticket térmico con QR; corte de caja por cajero y consolidado, con diferencia calculada | 3 | Extremo a extremo + manual con impresora real |
| E3 | Sin internet: 3 cotizaciones y 10 ventas en modo avión; al reconectar, cero duplicados, folios correctos y totales exactos [RNF-07] | 2 (cotizaciones) y 3 (ventas) | Extremo a extremo + manual en modo avión |
| E4 | Tres usuarios por PIN en la misma tablet: cada acción atribuida a quien la hizo; bloqueo por inactividad | 1 (PIN) y 3 (cobros) | Extremo a extremo |
| E5 | Autofacturación: un folio liquidado genera su factura de prueba; uno ya facturado, uno fuera de plazo y uno con código incorrecto se rechazan con mensajes claros; sin duplicar timbres | 4 | Extremo a extremo contra el entorno de pruebas del PAC |
| E6 | Facturación por administrador: un cajero sin permiso no puede; con autorización, sí | 4 | Extremo a extremo |
| E7 | Los reportes coinciden al centavo con los datos de ventas y pagos, en hora de México y con día, semana y mes bien delimitados | 4 | Pruebas de reportes con datos armados a mano + extremo a extremo |
| E8 | Permisos: el cajero no ve reportes, precios ni cortes ajenos; los administradores sí | 1 (matriz) y 4 (reportes) | Pruebas de permisos en dominio y RLS + extremo a extremo |
| E9 | Respaldo: restaurar una copia completa en un entorno limpio y verificar los datos | 5 | Manual, documentado |
| E10 | Impresión: 30 tickets seguidos sin error; cotización y comprobante en PDF tamaño carta legibles en el teléfono de quien los recibe, con QR escaneable | 0 (prueba de concepto) y 3 | Manual con impresora real |

**Ajuste a E10:** el documento fuente pide imprimir la cotización y el comprobante en tamaño carta. Esa impresión quedó fuera del alcance [ADR-0005], [ADR-0017]; se verifica en su lugar que el PDF se lea bien y que su QR se pueda escanear desde otro teléfono.

## Criterios generales

Además de los recorridos, antes de entregar [DC §14]:

- [ ] Sin errores en la consola del navegador durante los recorridos.
- [ ] Tiempos de [RNF-23] a [RNF-27] medidos en la tablet objetivo.
- [ ] Interfaz sin textos en inglés ni datos de relleno [RN-23], [GLOSARIO].
- [ ] Todos los `[POR DEFINIR]` resueltos o convertidos en ajustes de configuración documentados (`PENDIENTES.md`).
