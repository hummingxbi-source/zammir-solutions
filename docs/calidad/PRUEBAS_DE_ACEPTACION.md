# Pruebas de aceptación

> Fuente: [DC §14]. Recorridos completos que **deben pasar antes de entregar**, siempre con datos de prueba, nunca reales.
> Cada recorrido se automatiza como prueba extremo a extremo en el sprint indicado y se repite completo en el Sprint 5, con el equipo real.

## Recorridos

| ID | Recorrido | Sprint donde se automatiza | Cómo se verifica |
|---|---|---|---|
| E1 | Medir a domicilio, cotizar con medidas, generar PDF, compartirlo por WhatsApp, aceptarlo, crear la orden, cobrar anticipo, avanzar estatus, entregar, cobrar saldo y generar el comprobante con garantía en hoja carta | 3 | Extremo a extremo + manual en tablet |
| E2 | Venta de mostrador en efectivo, en transferencia y mixta; comprobante en hoja carta, impreso o en PDF por WhatsApp; corte de caja por cajero y consolidado, con diferencia calculada | 3 | Extremo a extremo + manual con impresora real |
| E3 | Sin internet: 3 cotizaciones y 10 ventas en modo avión; al reconectar, cero duplicados, folios correctos y totales exactos [RNF-07] | 2 (cotizaciones) y 3 (ventas) | Extremo a extremo + manual en modo avión |
| E4 | Tres usuarios por PIN en la misma tablet: cada acción atribuida a quien la hizo; bloqueo por inactividad | 1 (PIN) y 3 (cobros) | Extremo a extremo |
| E5 | **En pausa [ADR-0039]: fuera de esta entrega.** Autofacturación: un folio liquidado genera su factura de prueba; uno ya facturado, uno fuera de plazo y uno con código incorrecto se rechazan con mensajes claros; sin duplicar timbres | 4 | Extremo a extremo contra el entorno de pruebas del PAC; se acepta al reactivar la facturación |
| E6 | **En pausa [ADR-0039]: fuera de esta entrega.** Facturación por administrador: un cajero sin permiso no puede; con autorización, sí | 4 | Extremo a extremo; se acepta al reactivar la facturación |
| E7 | Los reportes coinciden al centavo con los datos de ventas y pagos, en hora de México y con día, semana y mes bien delimitados | 4 | Pruebas de reportes con datos armados a mano + extremo a extremo |
| E8 | Permisos: el cajero no ve reportes, precios ni cortes ajenos; los administradores sí | 1 (matriz) y 4 (reportes) | Pruebas de permisos en dominio y RLS + extremo a extremo |
| E9 | Respaldo: restaurar una copia completa en un entorno limpio y verificar los datos | 5 | Manual, documentado |
| E10 | Impresión: 30 comprobantes seguidos en hoja carta sin error; cotización, comprobante de orden, venta y corte legibles impresos y en PDF en el teléfono de quien los recibe | 0 (prueba de concepto) y 3 | Manual con la impresora de ZAMMIR |

**Ajuste a E10 [ADR-0040]:** ya no hay ticket térmico. Los documentos salen en hoja carta, con la impresión de Android, o se envían en PDF por WhatsApp. Con la facturación en pausa no llevan QR [ADR-0039].

**Ajuste a E5 y E6 [ADR-0039]:** con la facturación en pausa no se ejecutan en la entrega. Sus pruebas automáticas siguen en el CI, y se aceptan con el equipo real al reactivarla.

## Dónde vive cada recorrido automatizado

A 8 de noviembre de 2026 (Sprint 4). Los marcados con 🖐 se repiten además a mano con el equipo real en el Sprint 5 (S5-09).

| ID | Pruebas automáticas | Qué cubren |
|---|---|---|
| E1 | `apps/web/src/shared/infra/sync/e1-e2-mostrador.integracion.test.ts` | De la cotización a la entrega, sin conexión y al volver la red, contra el servidor real. 🖐 |
| E2 | el mismo archivo y `packages/core/src/modules/cash/` | Ventas del día, cancelación fuera del corte y corte recalculado por el servidor. 🖐 impresora |
| E3 | `e3-cotizaciones-sin-conexion.integracion.test.ts` y `e3-e4-ventas.integracion.test.ts` | Cotizaciones y ventas sin conexión: cero duplicados y folios correctos. 🖐 |
| E4 | `apps/web/src/acceptance/e4-tres-personas.test.tsx` | Tres personas con PIN en la misma tablet y bloqueo por inactividad. |
| E5 | `apps/web/src/acceptance/e5-e6-facturacion.integracion.test.ts` | Autofacturación: folio liquidado → factura de prueba y descarga; ya facturado, fuera de plazo, con saldo y código incorrecto se rechazan con su motivo; ningún rechazo deja un timbre; reenviar no duplica. Contra el proveedor simulado; **se repite contra el entorno de pruebas del proveedor real cuando exista (PD-05)**. |
| E6 | el mismo archivo y `packages/core/src/acceptance/e6-facturar.test.ts` | Un cajero sin permiso no factura (sin sesión y con sesión de cajero); un administrador sí; el cajero solo con autorización de un administrador en el núcleo. Que el cajero facture desde la tablet con el PIN de un administrador **no está construido** (PP-31). |
| E7 | `packages/core/src/acceptance/e7-reportes.test.ts` | Datos armados a mano en los bordes de medianoche de México: día, semana (lunes a domingo) y mes bien delimitados; totales al centavo por periodo, método de pago y persona; la venta cancelada no cuenta. |
| E8 | `packages/core/src/acceptance/e8-permisos.test.ts` y `e8-reportes-precios-y-cortes.test.ts` | Catálogo, personas y privacidad; reportes y cuentas por cobrar solo de administradores; el cajero no cambia precios sin el PIN de un administrador ni ve ni cierra cortes ajenos. Las pantallas que se le niegan al cajero las prueban `reportes.test.tsx` y `cuentas-por-cobrar.test.tsx`. |
| E9 | `scripts/ensayo-de-restauracion.mjs` (`pnpm ensayo:restauracion`) y [`docs/operacion/RESTAURACION.md`](../operacion/RESTAURACION.md) | Ensayo en local con datos inventados: respaldo → base limpia desde las migraciones → restauración → cada tabla idéntica, cuenta de administrador funcionando y numeración automática intacta. 🖐 Repetido el 25 nov con una **copia real del respaldo de la nube**, restaurada en Supabase local con `scripts/ensayo-restauracion-nube.sh`: aprobado (S5-06, [ADR-0043]). |
| E10 | — | Manual con la impresora de ZAMMIR, en las pruebas en el local (S5-09). |

## Criterios generales

Además de los recorridos, antes de entregar [DC §14]:

- [ ] Sin errores en la consola del navegador durante los recorridos.
- [ ] Tiempos de [RNF-23] a [RNF-27] medidos en la tablet objetivo.
- [ ] Interfaz sin textos en inglés ni datos de relleno [RN-23], [GLOSARIO].
- [ ] Todos los `[POR DEFINIR]` resueltos o convertidos en ajustes de configuración documentados (`PENDIENTES.md`).
