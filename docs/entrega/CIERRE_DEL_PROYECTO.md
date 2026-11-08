# Cierre del proyecto

> Historia S5-16 · compuerta de salida de la [Fase 9](../plan/fase-09-sprint-5-salida-a-produccion.md). **Borrador vivo**: la tabla se actualiza conforme se cierran los puntos y la retrospectiva se completa con Juanito y Luis **después de la entrega**. Estado al **8 de noviembre de 2026**.
> Un punto solo se marca ✅ cuando hay evidencia (una prueba, un documento o una firma), no cuando "ya casi".

## 1. Compuerta de salida, punto por punto

| # | Punto | Estado | Evidencia o lo que falta |
|---|---|---|---|
| 1 | **Aceptación firmada por Luis** y acta de entrega | ⏳ Pendiente | Plan de escenarios listo ([`PLAN_DE_ACEPTACION_CLIENTE.md`](../calidad/PLAN_DE_ACEPTACION_CLIENTE.md)) y acta lista para firmar ([`ACTA_DE_ENTREGA.md`](ACTA_DE_ENTREGA.md)). Falta ejecutarlos con Luis en el local (S5-10) |
| 2 | **Cero errores críticos abiertos**; los menores, registrados con fecha | ⏳ Se revisa al cierre | Sin errores críticos conocidos hoy. Se confirma con las pruebas con el equipo real (S5-09) |
| 3 | **Respaldo restaurado con éxito** al menos una vez | 🟡 En local sí; en producción falta | Ensayo local aprobado el 8 nov (28 tablas idénticas), ver [`RESTAURACION.md`](../operacion/RESTAURACION.md). Falta repetirlo en producción con un respaldo real (S5-06, PD-32, PD-10) |
| 4 | **Manual de usuario y de soporte entregados**; las tres sesiones de capacitación hechas | 🟡 Manuales en borrador; capacitación pendiente | [`MANUAL_DE_USUARIO.md`](../manuales/MANUAL_DE_USUARIO.md) y [`MANUAL_DE_SOPORTE.md`](../manuales/MANUAL_DE_SOPORTE.md). Faltan las sesiones con Luis, Ricardo y el mostrador (S5-11 a S5-13) |
| 5 | **Guía de operación y plan de soporte** en el repositorio | 🟡 Guía lista; plan de soporte según el contrato | [`GUIA_DE_OPERACION.md`](../operacion/GUIA_DE_OPERACION.md). Falta revisar el plan de soporte contra el contrato firmado |
| 6 | **Versión `1.0.0` etiquetada** | ⏳ Pendiente (a propósito) | [`CHANGELOG.md`](../../CHANGELOG.md) preparado; se etiqueta al firmar el acta (instrucciones en el acta) |

## 2. Pruebas obligatorias de la fase

| Prueba | Estado | Evidencia o lo que falta |
|---|---|---|
| Toda la batería automática en verde sobre la versión que se despliega | ✅ Hoy · se repite al desplegar | Compuerta de calidad del CI en cada Pull Request; al cierre de este documento: ≈2,300 pruebas de unidad y componentes, ≈440 de base de datos, ≈310 de integración con Supabase real y 40 de extremo a extremo, más mutación del dominio (≥ 90 %) |
| Pruebas de humo en producción sin documentos fiscales ni contables falsos | ⏳ Pendiente | Requiere producción (S5-01) y acordar con el contador qué se cancela |
| Restauración de respaldo probada en un entorno separado | 🟡 En local | Ver punto 3 |
| **Revisión de seguridad**: RLS de todas las tablas, ningún secreto en el navegador, escaneo de secretos | ✅ | [`REVISION_DE_SEGURIDAD.md`](../calidad/REVISION_DE_SEGURIDAD.md); prueba pgTAP 22, `pnpm check:bundle` y escaneo de secretos en el CI |
| Revisión del catálogo importado contra el archivo de Luis | ⏳ Pendiente | Requiere el catálogo real (PD-03, S5-03) |
| Plan de pruebas de aceptación ejecutado por Luis | ⏳ Pendiente | Punto 1 |
| **E1 a E10 completos con el equipo real** y los criterios generales | 🟡 E3 a E8 automatizados; con el equipo real falta | [`PRUEBAS_DE_ACEPTACION.md`](../calidad/PRUEBAS_DE_ACEPTACION.md), sección "Dónde vive cada recorrido". Con tablet e impresora: S5-09 |
| Prueba en el local con su internet, incluido un corte a propósito | ⏳ Pendiente | S5-09 |
| Exportación de los datos del cliente en CSV, JSON y PDF | ✅ | Función `admin_export_data`, pruebas pgTAP 23, de integración y de componentes; ADR-0036 |

## 3. Lo que bloquea el cierre, y de quién depende

| Bloqueo | Depende de | Historias |
|---|---|---|
| Proveedor de timbrado y certificado de ZAMMIR | Decidir quién contrata el PAC (PD-05) y que ZAMMIR tramite su CSD en el SAT (PD-04) | S4-14, S4-15, S5-02 |
| Producción y dominio | Comprar el dominio y crear las cuentas de producción (PD-10) | S4-26, S5-01 |
| Respaldos de 30 días | Revisar el plan de Supabase (PD-32) | S4-27 |
| Catálogo, precios, ajustes y usuarios reales | Las respuestas de Luis (cuestionario) | S5-03, S5-04 |
| Tablets e impresora | El equipo físico | S4-33, S4-34, S5-05, S5-09 |
| Aceptación y capacitaciones | Luis, Ricardo y el mostrador, en persona | S5-10 a S5-13 |

## 4. Retrospectiva (borrador, a completar con Juanito y Luis)

> Escrita con lo que dejó el repositorio, no de memoria. La parte de "qué dice el cliente" y "qué haría distinto Juanito" **solo la pueden llenar ellos**.

### Qué funcionó

- **La compuerta de calidad obligatoria** (formato, lint, tipos, dependencias, pruebas, base de datos, integración, extremo a extremo, mutación y escaneo de secretos). Atrapó problemas reales antes de fusionar: una prueba inestable cuyo nombre aleatorio chocaba con el limpiador de datos personales, textos de prueba que el escáner de secretos tomó por un token, y permisos de sobra en una tabla que la revisión de seguridad encontró.
- **La mutación en lo que importa** (dinero, reglas, el limpiador de datos personales, el ZIP de la exportación) obligó a escribir pruebas más exactas: el limpiador pasó de 78 % a 97 % de mutantes muertos.
- **Una decisión, un ADR.** Treinta y seis decisiones registradas con su contexto; cuando algo se discutió de nuevo, ya estaba escrito por qué se había decidido así.
- **Un núcleo puro** (sin navegador ni servidor) con el que se probó casi todo sin infraestructura, y **adaptadores simulados** (proveedor de timbrado) que dejaron construir toda la facturación sin esperar al proveedor real.
- **Pull Requests pequeños con CI**, y la regla de no avanzar con algo en rojo.

### Qué costó

- **Todo lo que depende de terceros** (proveedor de timbrado, certificado del SAT, dominio, cuentas de producción, respuestas de Luis) se acumuló al final: es hoy el único bloqueo real del cierre, y no depende del código. La ronda única de preguntas a Luis al final concentra el riesgo.
- **La verificación en equipo real** (tablets e impresora) quedó para el final: son 34 historias con parte manual (166 horas del plan) que el código ya soporta pero nadie ha visto en el hardware.
- **Las pruebas con base de datos real** dependen de Docker y de Supabase local: son lentas y a veces frágiles (la primera llamada a una función de servidor puede dar 503 mientras arranca).
- **La mutación tarda** de 25 a 30 minutos por Pull Request.
- **Detalles de Windows** (finales de línea, rutas, Docker Desktop) comieron tiempo en varias historias.

### Lo que se descubrió tarde

- Una tablet recién conectada se quedaba en "todavía no puede cotizar" hasta reabrir la aplicación (se encontró al hacer las capturas del manual; ya corregido).
- La función de exportación y las de administrador obligan a mantener una lista cerrada de funciones permitidas en la prueba de seguridad: es correcto, pero cada función nueva debe sumarse ahí a propósito.

### Para decidir con Juanito y Luis después de la entrega

- ¿Se activan P1 (portal de seguimiento para el cliente final) y P2 (existencias de piezas estándar)?
- ¿Cuáles de las propuestas sin aprobar (`PENDIENTES.md`, PP-xx) entran a la siguiente etapa? En particular PP-31 (que un cajero facture desde la tablet con el PIN de un administrador), PP-33 (cabeceras de seguridad) y PP-34 (copia de los datos de un solo cliente).
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
