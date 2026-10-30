# Sprint 5 — Salida a producción (30 nov – 1 dic)

> Plan: [`docs/plan/fase-09-sprint-5-salida-a-produccion.md`](../plan/fase-09-sprint-5-salida-a-produccion.md). Formato y tallas: [`README.md`](README.md).
> **Objetivo:** poner el sistema en producción con datos reales, probarlo con Luis y capacitar al equipo.
> **Entra si:** Sprint 4 cerrado en verde y los insumos del cliente entregados (catálogo, CSD, datos del negocio): su retraso es el riesgo principal de la fecha y se reporta de inmediato.
> **Importante:** este sprint tiene **dos días** y mucho depende de terceros. Lo que se pueda adelantar se hizo en el Sprint 4 (S4-26 a S4-30) [ADR-0019].

### S5-01 · Producción en marcha y dominio · S · 2 h  · ⛔ PD-10
- **Requerimientos:** RNF-13, RNF-37 · **Pendientes:** PD-10 (el dominio se fija **antes** de imprimir el primer ticket real)
- **Criterios de aceptación:**
  - Dado el dominio de ZAMMIR, cuando se publica, entonces responde por HTTPS con DNS en Cloudflare.
  - Dados los QR, cuando se imprime el primer ticket real, entonces apuntan a ese dominio y las rutas son estables.

### S5-02 · CSD y adaptador del PAC en producción · M · 4 h  · ⛔ PD-04 · PD-05
- **Requerimientos:** RF-M10-01, RF-M10-02 · **Decisión:** ADR-0007
- **Criterios de aceptación:**
  - Dado el CSD, cuando se sube, entonces va directo al PAC con ZAMMIR presente y nunca pasa por nuestro código ni base.
  - Dado el cambio a producción, cuando se hace por configuración, entonces no se toca código.
  - Dada la verificación en producción, cuando se acuerda con el contador, entonces no deja documentos fiscales falsos o se cancelan según lo acordado.

### S5-03 · Catálogo real y parámetros de precio reales · M · 4 h  · ⛔ PD-02 · PD-03
- **Requerimientos:** RF-M1-05 · **Reglas:** RN-02
- **Criterios de aceptación:**
  - Dado el archivo de Luis, cuando se importa con la herramienta, entonces los productos y precios coinciden con el archivo (revisión con Luis).
  - Dados los parámetros reales de las reglas de precio, cuando se capturan, entonces se calcula con ellos sin tocar código.

### S5-04 · Ajustes reales y usuarios reales · M · 4 h  · ⛔ PD-06 · PD-09 · PD-11 · PD-12
- **Requerimientos:** RF-M8-01, RF-M9-01 · **Reglas:** CLAUDE.md regla 7
- **Criterios de aceptación:**
  - Dados los valores reales (garantía, leyenda de plazo, datos y logo del negocio, textos legales), cuando se cargan, entonces ningún `[POR DEFINIR]` queda sin resolver o documentado como ajuste.
  - Dados los usuarios reales y sus PIN, cuando se crean con Luis presente, entonces cada quien conoce el suyo.
  - Dada la base de producción, cuando se revisa, entonces no hay ningún dato de prueba.

### S5-05 · Equipo: tablets e impresora · M · 4 h  · `tablet`
- **Requerimientos:** RNF-31 · **Pendientes:** PD-15, PD-16
- **Criterios de aceptación:**
  - Dadas las tablets, cuando se instala la PWA desde el dominio de producción, entonces quedan registradas como dispositivos.
  - Dada la impresora, cuando se empareja y prueba en cada tablet, entonces imprime el ticket de prueba.

### S5-06 · Restauración de respaldo (E9) · M · 4 h
- **Reglas:** E9 · **Requerimientos:** RNF-21
- **Criterios de aceptación:**
  - Dada una copia completa, cuando se restaura en un entorno limpio, entonces los datos se verifican y el procedimiento queda documentado.

### S5-07 · Revisión de seguridad · M · 4 h
- **Requerimientos:** RNF-08 a RNF-13, RNF-19
- **Criterios de aceptación:**
  - Dadas todas las tablas, cuando se revisan sus políticas por rol, entonces ninguna queda sin RLS.
  - Dado el código del navegador y el repositorio completo, cuando se escanean, entonces no hay secretos.

### S5-08 · Exportación de datos del cliente · M · 4 h
- **Requerimientos:** RNF-22
- **Criterios de aceptación:**
  - Dado un administrador, cuando exporta, entonces obtiene los datos de ZAMMIR en CSV, JSON y PDF.

### S5-09 · Recorridos E1 a E10 con el equipo real · L · 8 h  · `tablet`
- **Reglas:** `docs/calidad/PRUEBAS_DE_ACEPTACION.md` (recorridos y criterios generales)
- **Criterios de aceptación:**
  - Dados los diez recorridos, cuando se ejecutan completos con el equipo real, entonces pasan.
  - Dado el criterio general, cuando se revisan, entonces no hay errores en consola, textos en inglés ni datos de relleno y se cumplen RNF-23 a RNF-27.
  - Dado el local de ZAMMIR con su internet, cuando se corta a propósito, entonces el sistema sigue funcionando.

### S5-10 · Aceptación firmada por Luis · M · 4 h
- **Criterios de aceptación:**
  - Dado el plan de aceptación (S4-30), cuando Luis ejecuta los escenarios, entonces los firma.
  - Dados errores críticos, cuando existen, entonces se corrigen antes de entregar; los menores quedan registrados con fecha de atención.

### S5-11 · Capacitación con Luis · M · 4 h
- **Criterios de aceptación:**
  - Dada la sesión de 3 horas con Luis, cuando termina, entonces él completa sin ayuda un recorrido de cotización a cobro.

### S5-12 · Capacitación con Ricardo · M · 4 h
- **Criterios de aceptación:**
  - Dada la sesión de 3 horas con Ricardo, cuando termina, entonces él completa sin ayuda un recorrido de cotización a cobro y los reportes.

### S5-13 · Capacitación con el equipo de mostrador · M · 4 h
- **Criterios de aceptación:**
  - Dada la sesión de 3 horas con el equipo, cuando termina, entonces cada cajero entra con su PIN, cobra, hace su corte y reimprime un ticket.

### S5-14 · Guía de operación, soporte y accesos · M · 4 h
- **Requerimientos:** RNF-20, RNF-32 · **Reglas:** DC §13
- **Criterios de aceptación:**
  - Dada la guía, cuando se lee, entonces explica desplegar, restaurar un respaldo, rotar claves y atender una solicitud de datos.
  - Dado el plan de soporte, cuando se revisa, entonces corresponde al contrato.
  - Dados los accesos, cuando se entregan a Juanito, entonces van por un canal seguro.

### S5-15 · Versión 1.0.0 y acta de entrega · S · 2 h
- **Criterios de aceptación:**
  - Dada la versión, cuando se etiqueta, entonces el repositorio tiene `1.0.0` y el `CHANGELOG.md` correspondiente.
  - Dada el acta, cuando se firma, entonces cierra la entrega.

### S5-16 · Cierre del proyecto · XS · 1 h
- **Criterios de aceptación:**
  - Dada la compuerta de salida de la fase 9, cuando se revisa punto por punto, entonces está en verde (aceptación firmada, respaldo restaurado, manuales entregados, capacitación hecha, guía de operación y versión `1.0.0`).
  - Dada la retrospectiva final, cuando se hace, entonces queda registrada.
