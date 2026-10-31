# ADR-0012: Motor de sincronización sin conexión

- **Estado:** Aceptada el 2026-10-26 (opción A). Validada el 2026-10-30 con el `spike/sync` hecho como pruebas de integración ([ADR-0023])
- **Fecha:** 2026-10-26
- **Decide:** Juanito
- **Completa:** [ADR-0003] (librería de sincronización "a decidir en Fase 2")

## Contexto

- La tablet cotiza y vende sin internet; todo se guarda primero en IndexedDB y se envía después [principios §6].
- Dos tablets (y quizá un administrador en la computadora) escriben al mismo servidor.
- Los folios definitivos deben quedar **sin huecos ni duplicados** y se asignan en el servidor dentro de la misma transacción que guarda el documento [RN-16].
- Lo contable (pagos, ventas, cambios de estado) se **agrega**, no se sobrescribe [principios §6.5]. Los datos que se editan (catálogo, clientes, usuarios) son pocos: 50 a 150 productos.
- Un solo desarrollador, 5 semanas, y el sprint 2 (cotizador sin conexión) depende de esto.

## Requisitos que debe cumplir cualquier opción

1. Escritura local inmediata, con identificadores generados en el dispositivo (UUID).
2. Envío idempotente: la misma operación recibida dos veces no duplica nada.
3. Folio definitivo asignado por el servidor en la transacción del documento.
4. Descarga de catálogo, clientes y configuración a la tablet.
5. Estado visible para el usuario: "guardado en la tablet" y "enviado".
6. Pruebas con dos tablets simuladas y reintentos, sin depender de un servicio externo.
7. Entra como adaptador detrás de los puertos `SyncOutbox` y `<Entidad>Repository`, por lo que no se acopla al dominio.

## Opciones

> Lo que digo de las librerías viene de mi conocimiento general y puede estar desactualizado (versiones, precios, licencias). **Antes de decidir hay que verificarlo en su documentación actual.**

### A. Cola propia sobre IndexedDB (Dexie) + una función en el servidor
- La tablet escribe en IndexedDB y encola **operaciones** (comandos con UUID) en una bandeja de salida.
- Un worker las envía en orden a una única Edge Function o función SQL, que en una transacción verifica el UUID (idempotencia), guarda el documento y asigna el folio definitivo.
- La descarga de datos de referencia usa un cursor por `updated_at` o versión.
- **A favor:** control total de folios e idempotencia; sin servicio extra ni costo adicional; encaja exacto con los puertos del plan; pruebas sencillas.
- **En contra:** hay que escribir y probar la sincronización nosotros (reintentos, orden, errores); más código propio en la fase crítica.

### B. Motor de replicación completo (por ejemplo RxDB con replicación a Supabase)
- Réplica local de colecciones con empuje y jalón automáticos.
- **A favor:** reintentos, cursores y observación de cambios ya resueltos.
- **En contra:** modelo orientado a documentos que se replican, no a comandos; el folio sin huecos exige igualmente una función propia; algunas capacidades pueden ser de pago; curva de aprendizaje y dependencia de una librería.

### C. Sincronización administrada de Postgres a SQLite local (por ejemplo PowerSync)
- Servicio que replica Postgres hacia la tablet; las escrituras vuelven por un endpoint propio.
- **A favor:** muy completo para el jalón de datos.
- **En contra:** un servicio más que alojar y pagar en producción; la tablet usaría SQLite en el navegador, no IndexedDB; **la escritura de folios sigue siendo trabajo propio**.

### D. Sincronización de solo lectura (por ejemplo ElectricSQL) + cola propia para escribir
- Cubre la descarga; la escritura sería la opción A de todos modos.
- **En contra:** un servicio más; no ahorra lo más difícil.

## Recomendación: A

En este sistema lo difícil no es copiar tablas: es **escribir una operación una sola vez y darle folio sin huecos**. Eso es lo mismo con cualquier opción, así que B, C y D agregan una dependencia sin quitar ese trabajo. Los datos editables son pocos y los contables se agregan, por lo que la mayoría de los conflictos desaparece por diseño. La opción A coincide con el riesgo ya aceptado en [ADR-0003] (lógica del negocio fuera de proveedores).

**Mitigación del riesgo de A:** una **validación corta (`spike/sync`)** antes de cerrar este ADR, con dos tablets simuladas que crean documentos al mismo tiempo, se desconectan, reintentan y duplican envíos. Debe demostrar: sin huecos ni duplicados, idempotencia y reanudación tras un corte. Código desechable, sin fusionarse.

## Qué pasa con cada entidad (a confirmar en `SINCRONIZACION.md`)

| Tipo | Ejemplos | Política |
|---|---|---|
| Eventos contables que se agregan | Pagos, ventas, cotizaciones emitidas, cambios de estado | Operación idempotente por UUID; nunca se sobrescribe |
| Datos de referencia que descarga la tablet | Catálogo, reglas de precio, configuración, usuarios y sus PIN verificables | Solo servidor → tablet; versión o cursor |
| Datos editables desde varias partes | Clientes | Última escritura gana por campo, con rastro en bitácora |

## Consecuencias si se elige A

- Sprint 0 incluye el esqueleto de `SyncOutbox`, la tabla de operaciones procesadas y la función de folios.
- Hay batería de pruebas de contrato para `SyncOutbox` y para el servidor, más pruebas de concurrencia en Postgres.
- Si la validación falla, se reevalúa B con el costo ya conocido.
