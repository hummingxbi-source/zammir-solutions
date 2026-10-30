# Fase 9 — Sprint 5: Salida a producción

- **Tipo:** entrega
- **Fechas:** 30 de noviembre – 1 de diciembre de 2026
- **Lee antes:** `ENTORNOS.md`, `SECURITY.md`, [00 §5](00-principios-de-ingenieria.md)

## Objetivo

Entregar a ZAMMIR un sistema en producción, con sus datos reales, su equipo configurado, su gente capacitada y la aceptación firmada de Luis.

## Entra si

- Sprints 0 a 4 cerrados con sus compuertas en verde.
- Recibidos: catálogo real (PD-03), reglas de precio (PD-02), datos del negocio (PD-11), CSD y datos fiscales (PD-04), textos legales finales (PD-12), dominio (PD-10).
- Cualquier insumo que falte se reporta a Juanito: según el documento fuente, **la fecha de entrega se recorre** si el cliente no entrega sus insumos [DC §1.3].

## Alcance

### 9.1 Infraestructura de producción
- Proyectos de producción en planes de pago de Supabase y Vercel [ADR-0003], separados del entorno de pruebas.
- Dominio de ZAMMIR con HTTPS y DNS en Cloudflare; **se fija antes de imprimir el primer ticket real**, porque los QR apuntan a él [RNF-37], PD-10.
- Variables de entorno de producción cargadas solo en los paneles de Vercel y Supabase.
- Migraciones aplicadas desde cero en la base de producción.
- Respaldos diarios con **30 días** de historial; si el plan de Supabase retiene menos, exportación nocturna a un almacenamiento externo [RNF-21], PD-32. **Una restauración completa** en un entorno limpio, hecha y documentada (E9).
- Registro de errores sin datos personales y monitoreo simple de disponibilidad con aviso a Juanito [RNF-34] (herramienta definida en `ENTORNOS.md`).

### 9.2 Facturación en producción
- ZAMMIR (o Juanito con ZAMMIR presente) sube el CSD **directamente al PAC**; nunca pasa por nuestro código ni base de datos [RF-M10-02].
- Cambio del adaptador del PAC a producción por configuración [ADR-0007].
- Verificación en producción acordada con Juanito y el contador de ZAMMIR, porque una factura en producción es un documento fiscal real.

### 9.3 Datos reales
- Importación del catálogo real con la herramienta de RF-M1-05, revisada con Luis.
- Captura de los parámetros reales de las reglas de precio.
- Ajustes del negocio con valores reales: garantía (PD-06), leyenda de plazo (PD-09), datos del negocio (PD-11).
- Usuarios reales de ZAMMIR con sus PIN, creados con Luis presente.
- **Ningún dato de prueba en producción.**

### 9.4 Equipo
- Tablets con la PWA instalada desde el dominio de producción y registradas como dispositivos.
- Impresora térmica emparejada y probada en cada tablet.

### 9.5 Aceptación y capacitación
- Plan de pruebas de aceptación: una lista de escenarios del día a día de ZAMMIR (cotizar en casa del cliente sin señal, cobrar un anticipo, entregar, hacer el corte, facturar) que Luis ejecuta y firma.
- Manual de usuario con capturas, en el lenguaje del oficio, pensado para personas sin experiencia con sistemas, y **manual de soporte** para HummingX. Juanito los edita [DC §13].
- Capacitación presencial de 3 horas en tres sesiones: una con Luis, una con Ricardo y una con el equipo de mostrador [DC §13].
- Pruebas con personas reales de lo que verán los clientes finales (portal de autofacturación) [R11].

### 9.6 Entrega y operación
- Guía de operación para HummingX: cómo desplegar, cómo restaurar un respaldo, cómo rotar claves, cómo atender una solicitud de datos personales.
- Plan de soporte posterior a la entrega, según el contrato.
- Exportación de los datos del cliente en CSV, JSON y PDF probada [RNF-22].
- Accesos entregados a Juanito por un canal seguro [DC §13].
- **Acta de entrega** firmada [DC §13].
- `CHANGELOG.md` con la versión `1.0.0`.

## Pruebas obligatorias

- [ ] Toda la batería automática en verde sobre la versión que se despliega.
- [ ] Pruebas de humo en producción con un recorrido que no genere documentos fiscales ni datos contables falsos, o con documentos que se cancelan según lo acordado con el contador.
- [ ] Restauración de respaldo probada en un entorno separado.
- [ ] Revisión de seguridad: RLS de todas las tablas, ningún secreto en el código del navegador, escaneo de secretos del repositorio completo.
- [ ] Revisión del catálogo importado contra el archivo de Luis: mismos productos y precios.
- [ ] Plan de pruebas de aceptación ejecutado por Luis.
- [ ] **E1 a E10 completos** con el equipo real y los criterios generales de `docs/calidad/PRUEBAS_DE_ACEPTACION.md`: sin errores en consola, tiempos de RNF-23 a RNF-27, sin textos en inglés ni datos de relleno, todos los `[POR DEFINIR]` resueltos o convertidos en ajustes documentados.
- [ ] Prueba en el local de ZAMMIR con su internet de Telmex, incluido un corte de internet a propósito.

## Compuerta de salida

- [ ] Aceptación firmada por Luis y acta de entrega.
- [ ] Cero errores críticos abiertos. Los menores quedan registrados con fecha de atención.
- [ ] Respaldo restaurado con éxito al menos una vez.
- [ ] Manual de usuario y manual de soporte entregados; las tres sesiones de capacitación hechas.
- [ ] Guía de operación y plan de soporte en el repositorio.
- [ ] Versión `1.0.0` etiquetada en el repositorio.

## Riesgos y pendientes

- **Insumos del cliente tarde** (catálogo, CSD): es el riesgo principal de la fecha, y no depende de HummingX. Se reporta de inmediato con su impacto en la fecha.
- Dos días es muy poco para todo esto, más tres sesiones presenciales de capacitación: es la razón de PD-34. Si el calendario no cambia, lo que se pueda preparar antes (proyectos de producción vacíos, dominio, manuales) se adelanta durante el Sprint 4.
- PD-02, PD-03, PD-04, PD-06, PD-09, PD-10, PD-11, PD-12, PD-29, PD-30, PD-32, PD-34.
