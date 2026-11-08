# Acta de entrega

> Historia S5-15 · [DC §13]. **Plantilla**: se llena y se firma al entregar. Mientras no esté firmada, la versión `1.0.0` no se etiqueta.
> Lo que dependa del contrato firmado entre ZAMMIR y HummingX BI se toma **del contrato**, no de esta plantilla (esta no inventa plazos ni costos).

## Datos de la entrega

| | |
|---|---|
| **Cliente** | ZAMMIR, Soluciones en Vidrio y Aluminio · Otumba, Estado de México |
| **Proveedor** | HummingX BI |
| **Sistema** | Sistema de gestión de ZAMMIR (cotizador, órdenes, mostrador y caja, clientes, cuentas por cobrar, reportes, usuarios, legal y facturación) |
| **Versión que se entrega** | `1.0.0` |
| **Dirección de producción** | *(dominio de ZAMMIR, PD-10)* |
| **Fecha y lugar** | |

## Qué se entrega

| Entregable | Dónde está | Entregado |
|---|---|---|
| Sistema en producción, con datos reales y sin datos de prueba | El dominio de ZAMMIR | ☐ |
| Tablets con la aplicación instalada y registradas | En el local | ☐ |
| Impresora térmica emparejada y probada en cada tablet | En el local | ☐ |
| Manual de usuario | [`docs/manuales/MANUAL_DE_USUARIO.md`](../manuales/MANUAL_DE_USUARIO.md) | ☐ |
| Manual de soporte | [`docs/manuales/MANUAL_DE_SOPORTE.md`](../manuales/MANUAL_DE_SOPORTE.md) | ☐ |
| Guía de operación y de restauración | [`docs/operacion/`](../operacion/GUIA_DE_OPERACION.md) | ☐ |
| Plan de soporte posterior a la entrega | Según el contrato | ☐ |
| Accesos de producción entregados a Juanito **por un canal seguro** | Registro de accesos | ☐ |
| Exportación de los datos del negocio probada (CSV, JSON y PDF) | Configuración → Exportar los datos | ☐ |
| Código fuente y su historial | Repositorio en GitHub | ☐ |
| `CHANGELOG.md` con la versión `1.0.0` | [`CHANGELOG.md`](../../CHANGELOG.md) | ☐ |

## Compuerta de salida

*(El detalle y la evidencia de cada punto están en [`CIERRE_DEL_PROYECTO.md`](CIERRE_DEL_PROYECTO.md).)*

- [ ] Aceptación firmada por Luis (plan de pruebas de aceptación ejecutado).
- [ ] Cero errores críticos abiertos; los menores quedan registrados abajo con fecha de atención.
- [ ] Respaldo restaurado con éxito al menos una vez, en producción.
- [ ] Manual de usuario y manual de soporte entregados; las tres sesiones de capacitación hechas.
- [ ] Guía de operación y plan de soporte en el repositorio.
- [ ] Versión `1.0.0` etiquetada.

## Capacitación

| Sesión | Con quién | Fecha | Hecha |
|---|---|---|---|
| 1 | Luis | | ☐ |
| 2 | Ricardo | | ☐ |
| 3 | Equipo de mostrador | | ☐ |

## Pendientes aceptados

Errores menores o mejoras que **no** impiden la entrega y que ambas partes aceptan atender después.

| # | Qué es | Gravedad | Se atiende el |
|---|---|---|---|
| | | | |

## Facturación

- [ ] El proveedor de timbrado real está conectado y el certificado de ZAMMIR lo subió ZAMMIR **directo al proveedor** (nunca pasó por el código).
- [ ] Se hizo una verificación en producción acordada con el contador de ZAMMIR.
- [ ] Quedó claro que la factura global del público en general la hace el contador de ZAMMIR, no el sistema.

## Fuera de la entrega (por decisión)

Portal de seguimiento para el cliente final (P1), existencias de piezas estándar (P2), el recorrido guiado con globos de ayuda y las propuestas sin aprobar de `docs/backlog/DESPUES_DE_LA_ENTREGA.md`.

## Firmas

Con estas firmas ZAMMIR da por **aceptado** el sistema descrito, en los términos del contrato y con los pendientes aceptados de arriba.

| | Nombre | Fecha | Firma |
|---|---|---|---|
| Por ZAMMIR | Luis | | |
| Por HummingX BI | Juanito | | |

---

## Publicar la versión (lo hace Juanito, después de firmar)

1. Con `main` en verde y el acta firmada, subir la versión en los `package.json` (`package.json`, `apps/web/package.json` y `packages/core/package.json`) de `0.0.0` a `1.0.0`.
2. En `CHANGELOG.md`, cambiar `## [1.0.0] — pendiente de etiquetar` por `## [1.0.0] — AAAA-MM-DD` y quitar la nota de "todavía no está etiquetada".
3. Fusionar ese cambio por Pull Request, como cualquier otro.
4. Etiquetar: `git tag -a v1.0.0 -m "ZAMMIR 1.0.0"` y `git push origin v1.0.0`; crear la versión en GitHub con las notas del `CHANGELOG.md`.
5. Anotar la fecha y la etiqueta en `CIERRE_DEL_PROYECTO.md`.
