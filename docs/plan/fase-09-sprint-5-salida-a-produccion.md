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
- Dominio configurado con HTTPS.
- Variables de entorno de producción cargadas solo en los paneles de Vercel y Supabase.
- Migraciones aplicadas desde cero en la base de producción.
- Respaldos activos y **una restauración de prueba** hecha y documentada.
- Monitoreo de errores *(propuesta: Sentry o equivalente, se decide en Fase 2)*.

### 9.2 Facturación en producción
- CSD de ZAMMIR cargado de forma segura.
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
- Manual corto de uso con capturas, en el lenguaje del oficio, pensado para personas sin experiencia con sistemas [DC §2].
- Sesión de capacitación con Luis, Ricardo y los empleados.

### 9.6 Entrega y operación
- Guía de operación para HummingX: cómo desplegar, cómo restaurar un respaldo, cómo rotar claves, cómo atender una solicitud de datos personales.
- Plan de soporte posterior a la entrega, según el contrato.
- `CHANGELOG.md` con la versión `1.0.0`.

## Pruebas obligatorias

- [ ] Toda la batería automática en verde sobre la versión que se despliega.
- [ ] Pruebas de humo en producción con un recorrido que no genere documentos fiscales ni datos contables falsos, o con documentos que se cancelan según lo acordado con el contador.
- [ ] Restauración de respaldo probada en un entorno separado.
- [ ] Revisión de seguridad: RLS de todas las tablas, ningún secreto en el código del navegador, escaneo de secretos del repositorio completo.
- [ ] Revisión del catálogo importado contra el archivo de Luis: mismos productos y precios.
- [ ] Plan de pruebas de aceptación ejecutado por Luis.
- [ ] Prueba en el local de ZAMMIR con su internet de Telmex, incluido un corte de internet a propósito.

## Compuerta de salida

- [ ] Aceptación firmada por Luis.
- [ ] Cero errores críticos abiertos. Los menores quedan registrados con fecha de atención.
- [ ] Respaldo restaurado con éxito al menos una vez.
- [ ] Manual entregado y capacitación hecha.
- [ ] Guía de operación y plan de soporte en el repositorio.
- [ ] Versión `1.0.0` etiquetada en el repositorio.

## Riesgos y pendientes

- **Insumos del cliente tarde** (catálogo, CSD): es el riesgo principal de la fecha, y no depende de HummingX. Se reporta de inmediato con su impacto en la fecha.
- Dos días es muy poco para todo esto: lo que se pueda preparar antes (proyectos de producción vacíos, dominio, manual) se adelanta durante el Sprint 4.
- PD-02, PD-03, PD-04, PD-06, PD-09, PD-10, PD-11, PD-12.
