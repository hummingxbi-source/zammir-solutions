# Cierre del proyecto

> Historia S5-16 · compuerta de salida de la [Fase 9](../plan/fase-09-sprint-5-salida-a-produccion.md). **Borrador vivo**: la tabla se actualiza conforme se cierran los puntos, y la retrospectiva se completa con Juanito y Luis **después de la entrega**. Estado al **25 de noviembre de 2026**, con las fases 0 a 10 en `main`.
> Un punto solo se marca ✅ cuando hay evidencia (una prueba, un documento o una firma), no cuando "ya casi".

## 1. Compuerta de salida, punto por punto

| # | Punto | Estado | Evidencia o lo que falta |
|---|---|---|---|
| 1 | **Aceptación firmada por Luis** y acta de entrega | ⏳ Pendiente | Plan de escenarios actualizado con la fase 10 ([`PLAN_DE_ACEPTACION_CLIENTE.md`](../calidad/PLAN_DE_ACEPTACION_CLIENTE.md)) y acta lista para firmar ([`ACTA_DE_ENTREGA.md`](ACTA_DE_ENTREGA.md)). Se ejecutan con Luis el sábado 28 (S5-10) |
| 2 | **Cero errores críticos abiertos**; los menores, registrados con fecha | ⏳ Se revisa al cierre | Sin errores críticos conocidos hoy. Se confirma con las pruebas con el equipo real (S5-09) |
| 3 | **Respaldo restaurado con éxito** al menos una vez | ✅ | Ensayos locales aprobados el 8 y el 20 nov, y el **25 nov con una copia real de la nube**, restaurada en Supabase local: 30 tablas con los mismos renglones, en 69 s ([`RESTAURACION.md`](../operacion/RESTAURACION.md) §6, [ADR-0043]). Se repite con el proyecto nuevo de la entrega (P12). La copia de las fotos de medición está activa desde el 25 nov [ADR-0046]; falta comprobarlo con una foto real tomada en la tablet (P2), porque `zammir-pruebas` no tenía fotos en las primeras corridas (PD-57) |
| 4 | **Manual de usuario y de soporte entregados**; las tres sesiones de capacitación hechas | 🟡 Manuales en borrador; capacitación pendiente | [`MANUAL_DE_USUARIO.md`](../manuales/MANUAL_DE_USUARIO.md) y [`MANUAL_DE_SOPORTE.md`](../manuales/MANUAL_DE_SOPORTE.md). Sesiones con Luis, Ricardo y el mostrador el 29 y 30 nov (S5-11 a S5-13) |
| 5 | **Guía de operación y plan de soporte** en el repositorio | 🟡 Guía lista; plan de soporte según el contrato | [`GUIA_DE_OPERACION.md`](../operacion/GUIA_DE_OPERACION.md). Horario de atención fijado [ADR-0045]; tiempos de respuesta según el contrato |
| 6 | **Versión `1.0.0` etiquetada** | ⏳ Pendiente (a propósito) | [`CHANGELOG.md`](../../CHANGELOG.md) preparado; se etiqueta al firmar el acta (instrucciones en el acta) |

## 2. Pruebas obligatorias de la fase

| Prueba | Estado | Evidencia o lo que falta |
|---|---|---|
| Toda la batería automática en verde sobre la versión que se despliega | ✅ Hoy · se repite al desplegar | Compuerta de calidad del CI en cada Pull Request. Al 24 nov, en local: 2,674 pruebas de unidad y componentes, 339 de integración con Supabase local y 500 de base de datos (pgTAP, 31 archivos), más extremo a extremo y mutación del dominio. **Las cifras del informe de calidad se vuelven a correr el día de la entrega** |
| Pruebas de humo en producción sin documentos falsos | ⏳ Pendiente | Al recrear el proyecto vacío en la entrega [ADR-0043]. Una venta de prueba que quede se cancela con motivo [RN-18] y se anota en el acta |
| Restauración de respaldo probada en un entorno separado | ✅ | Ver punto 3 |
| **Revisión de seguridad**: RLS de todas las tablas, ningún secreto en el navegador, escaneo de secretos, política de contenido | ✅ | [`REVISION_DE_SEGURIDAD.md`](../calidad/REVISION_DE_SEGURIDAD.md); prueba pgTAP 22, `pnpm check:bundle`, escaneo de secretos en el CI y la CSP en `vercel.json` (PR #113). Falta confirmar la CSP con la tablet (P4) |
| Revisión del catálogo importado contra el archivo de Luis | ⏳ Pendiente | Requiere el catálogo real (PD-03, S5-03) |
| Plan de pruebas de aceptación ejecutado por Luis | ⏳ Pendiente | Punto 1 |
| **E1 a E4 y E7 a E10 completos con el equipo real** y los criterios generales | 🟡 Automatizados; con el equipo real falta | [`PRUEBAS_DE_ACEPTACION.md`](../calidad/PRUEBAS_DE_ACEPTACION.md). E5 y E6 están en pausa con la facturación [ADR-0039]. Con tablet e impresora: S5-09 |
| Prueba en el local con su internet, incluido un corte a propósito | ⏳ Pendiente | S5-09, sábado 28 |
| Exportación de los datos del cliente en CSV, JSON y PDF | ✅ | Función `admin_export_data`, pruebas pgTAP 23, de integración y de componentes; ADR-0036 |

## 3. Lo que bloquea el cierre, y de quién depende

| Bloqueo | Depende de | Historias |
|---|---|---|
| Comprobar la copia de las fotos con una foto real | Prueba P2 con la tablet (PD-57, [ADR-0046]) | S4-27 |
| Producción vacía | Recrear el proyecto de Supabase en la entrega [ADR-0043] | S4-26 |
| Catálogo, precios y ajustes reales | Las respuestas de Luis (PD-02, PD-03, PD-06, PD-53) | S5-03, S5-04 |
| Tablets e impresora | Las pruebas P2 a P6 del plan maestro | S4-33, S4-34, S5-05, S5-09 |
| Aceptación y capacitaciones | Luis, Ricardo y el mostrador, en persona | S5-10 a S5-13 |
| Contrato | Plantilla con revisión de un abogado | — |

**Ya no bloquea:** la facturación (proveedor de timbrado y certificado de ZAMMIR) quedó en pausa y fuera de la entrega [ADR-0039].

## 4. Retrospectiva (borrador, a completar con Juanito y Luis)

> Escrita con lo que dejó el repositorio, no de memoria. La parte de "qué dice el cliente" y "qué haría distinto Juanito" **solo la pueden llenar ellos**.

### Qué funcionó

- **La compuerta de calidad obligatoria** (formato, lint, tipos, dependencias, pruebas, base de datos, integración, extremo a extremo, mutación y escaneo de secretos). Atrapó problemas reales antes de fusionar: una prueba inestable cuyo nombre aleatorio chocaba con el limpiador de datos personales, textos de prueba que el escáner de secretos tomó por un token, y permisos de sobra en una tabla que la revisión de seguridad encontró.
- **La mutación en lo que importa** (dinero, reglas, el limpiador de datos personales, el ZIP de la exportación) obligó a escribir pruebas más exactas: el limpiador pasó de 78 % a 97 % de mutantes muertos.
- **Una decisión, un ADR.** Cuarenta y seis decisiones registradas con su contexto; cuando algo se discutió de nuevo, ya estaba escrito por qué se había decidido así.
- **Un núcleo puro** (sin navegador ni servidor) con el que se probó casi todo sin infraestructura, y **adaptadores simulados** (proveedor de timbrado) que dejaron construir toda la facturación sin esperar al proveedor real.
- **Pull Requests pequeños con CI**, y la regla de no avanzar con algo en rojo.

### Qué costó

- **Todo lo que depende de terceros** (datos fiscales, dominio, cuentas de producción, respuestas de Luis) se acumuló al final. La facturación se tuvo que pausar [ADR-0039] y la ronda única de preguntas a Luis concentró el riesgo.
- **La verificación en equipo real** (tablets e impresora) quedó para el final: muchas historias con parte manual que el código ya soporta, pero que nadie ha visto en el hardware.
- **Cambios de alcance tardíos**: la impresora térmica se cambió por hoja carta [ADR-0040] y la fase 10 agregó nueve ajustes de operación [ADR-0044] a días de la entrega.
- **Las pruebas con base de datos real** dependen de Docker y de Supabase local: son lentas y a veces frágiles (la primera llamada a una función de servidor puede dar 503 mientras arranca).
- **La mutación tarda** de 25 a 35 minutos por Pull Request.
- **Detalles de Windows** (finales de línea, rutas, Docker Desktop) comieron tiempo en varias historias.

### Lo que se descubrió tarde

- Una tablet recién conectada se quedaba en "todavía no puede cotizar" hasta reabrir la aplicación (se encontró al hacer las capturas del manual; ya corregido).
- La función de exportación y las de administrador obligan a mantener una lista cerrada de funciones permitidas en la prueba de seguridad: es correcto, pero cada función nueva debe sumarse ahí a propósito.
- Al revisar el traspaso (25 nov) salió que el respaldo no copia las fotos de medición (PD-57) y que los revisores obligatorios en `produccion` habrían detenido el respaldo nocturno [ADR-0045].

### Para decidir con Juanito y Luis después de la entrega

- ¿Se activan P1 (portal de seguimiento para el cliente final) y P2 (existencias de piezas estándar)?
- ¿Cuándo se reactiva la facturación (lista de reactivación del ADR-0039)?
- ¿Cuáles de las propuestas sin aprobar (`PENDIENTES.md`, PP-xx) entran a la siguiente etapa? En particular PP-09 (retiros de caja), PP-34 (copia de los datos de un solo cliente) y PP-35 (registrar la devolución del anticipo).
- ¿Qué dice Luis que le sirvió, qué le sobró y qué le faltó? *(solo él)*
- ¿Qué haría distinto Juanito en el plan, el calendario o la forma de trabajar? *(solo él)*

## 5. Registro del cierre

| | |
|---|---|
| Fecha de la aceptación firmada | |
| Fecha y etiqueta de la versión | `v1.0.0`, |
| Errores menores aceptados (ver acta) | |
| Retrospectiva hecha el | |
| Quién la hizo | |

## 6. Publicar la versión 1.0.0 (lo hace Juanito, después de firmar el acta)

1. Con `main` en verde y el acta firmada, subir la versión de `apps/web/package.json` y `packages/core/package.json` de `0.0.0` a `1.0.0`. El `package.json` de la raíz no lleva versión.
2. En `CHANGELOG.md`, cambiar `## [1.0.0] — pendiente de etiquetar` por `## [1.0.0] — AAAA-MM-DD` y quitar la nota de "todavía no está etiquetada".
3. Fusionar ese cambio por Pull Request, como cualquier otro.
4. Etiquetar: `git tag -a v1.0.0 -m "ZAMMIR 1.0.0"` y `git push origin v1.0.0`; crear la versión en GitHub con las notas del `CHANGELOG.md`.
5. Anotar la fecha y la etiqueta en el registro del cierre (§5).
6. Pasar el repositorio a privado y comprobar que Vercel siga desplegando (PD-59).
