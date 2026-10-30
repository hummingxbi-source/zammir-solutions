# Riesgos principales

> Fuente: [DC §16]. Columna "Dónde se atiende" agregada para ligar cada riesgo con el plan y las decisiones.
> Se revisa en cada retrospectiva de sprint. Un riesgo que se materializa se reporta a Juanito el mismo día.

| ID | Riesgo | Mitigación según el documento | Dónde se atiende |
|---|---|---|---|
| R1 | La impresora Bluetooth no expone BLE y no imprime desde el navegador | Prueba de concepto en la primera semana; capas 2 y 3 de impresión; cambio de modelo antes de que el cliente compre más equipo | Sprint 0 [ADR-0008], [ADR-0018], PD-15 |
| R2 | Datos fiscales, CSD o PAC no están a tiempo | Entorno de pruebas del PAC y activación en producción al final; avisar pronto | [ADR-0007], PD-04, PD-05, Sprint 5 |
| R3 | Plazo corto de cinco semanas | Orden por riesgo, alcance cerrado, nada fuera de lo listado | `docs/plan/README.md` (regla de avance), [ADR-0019] |
| R4 | El cliente tarda en entregar su catálogo | Importador y plantilla desde la primera fase de construcción; fecha comprometida por el cliente | Sprint 1 (RF-M1-05), PD-03 |
| R5 | Duplicados o folios mal asignados al sincronizar | UUID por operación, folios temporales, prueba E3 | Sprint 2, [ADR-0012], [ADR-0016], `spike/sync` |
| R6 | Tratamiento fiscal de anticipos | Configuración y validación del contador | [RN-27], PD-27 |
| R7 | Seguridad con tablet compartida y PIN | Dispositivo registrado, bloqueo por inactividad, atribución por usuario, límite de intentos | [ADR-0013], PD-22 |
| R8 | Respaldos con menos retención de la prometida | Exportación nocturna externa y prueba de restauración | [RNF-21], PD-32, Sprint 5 |
| R9 | Confusión entre demo y sistema real | Nada de datos de la demo en producción | [ADR-0002], [ADR-0017] |
| R10 | Fallas de terceros (internet, nube, PAC, SAT) | Modo sin internet, reintentos y mensajes claros | [RNF-01] a [RNF-05], [RNF-20], [RF-M10-15] |
| R11 | Usuarios mayores o poco familiarizados con la tecnología | Diseño simple y pruebas con personas reales | [RF-UX-01] a [RF-UX-10], [RNF-28] a [RNF-30], revisión de cada sprint con Luis |

## Riesgos agregados por el equipo

| ID | Riesgo | Mitigación | Dónde se atiende |
|---|---|---|---|
| R12 | El IVA calculado por línea difiere en un centavo del que espera el PAC | Verificar la tolerancia en el entorno de pruebas del PAC; el cambio queda dentro de `TaxCalculator` | [ADR-0011] |
| R13 | El PAC real se conecta tarde y su API sorprende | Contrato del `BillingProvider` basado en el estándar CFDI; elegir el PAC antes del Sprint 4 | [ADR-0007], [ADR-0017], PD-05 |
| R14 | El dominio cambia después de imprimir tickets reales y los QR dejan de funcionar | Definir el dominio antes de imprimir el primer ticket real; rutas estables | [RNF-37], PD-10 |
| R15 | Semana de estabilización insuficiente | Se mantiene el plan actual con recortes desde ahora (P1, P2 y recorrido guiado) y preparación de producción durante el Sprint 4 | [ADR-0019] |
| R16 | El corte de caja por cajero no corresponde a cómo ZAMMIR maneja el efectivo (cajón compartido por tres personas, una tablet que cobra en campo) | Preguntar a Luis antes del Sprint 3; el modelo separa turno de caja y cobros por cajero | PD-36, PD-37, `REVISION_DE_NEGOCIO.md` §4 |
| R17 | La medición final en obra cambia el precio que se congeló al cotizar | Ajuste en la orden por un administrador, con motivo y bitácora (propuesta) | PD-38, [RN-03], [RN-13] |
