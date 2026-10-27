# Capacidad y carga por sprint

> Compuerta de la Fase 3: "La carga de cada sprint no excede la capacidad estimada, **o Juanito aprobó el riesgo**".
> **Resultado: la carga excede la capacidad en todos los sprints, por mucho.** Este documento muestra los números y las opciones. La decisión es de Juanito (y, si cambia el alcance o la fecha, de Luis).

## Cómo leer los números

- **Horas = estimación mía de trabajo conjunto** (Juanito + agente), incluidas pruebas, revisión y despliegue a pruebas. No es una medición. Error esperable: ±50 % por historia.
- **Capacidad = lo que Juanito dijo el 27 de oct de 2026:** 3 horas de construcción al día junto con el agente. No precisó los días por semana, así que hay dos escenarios:
  - **Base:** solo días hábiles (3 h × 5 = 15 h por semana).
  - **Optimista:** los siete días (3 h × 7 = 21 h por semana).
- El Sprint 0 son 4 días calendario (jue 29 oct a dom 1 nov): 2 hábiles (6 h) o 4 (12 h). El Sprint 5 son 2 días hábiles (6 h).
- La Fase 2 (ENTORNOS, TESTING, tabla RN → pieza, los 15 puntos de §2.8 y el `spike/sync`) cae en los mismos días que el Sprint 0 y **no está en estas cifras**.

## Carga contra capacidad

| Sprint | Fechas | Historias | Horas estimadas | Capacidad base | Capacidad optimista | Veces por encima (base / optimista) |
|---|---|---|---|---|---|---|
| S0 | 29 oct – 1 nov | 20 | 91 | 6 | 12 | 15.2 / 7.6 |
| S1 | 2 – 8 nov | 21 | 86 | 15 | 21 | 5.7 / 4.1 |
| S2 | 9 – 15 nov | 22 | 92 | 15 | 21 | 6.1 / 4.4 |
| S3 | 16 – 22 nov | 30 | 132 | 15 | 21 | 8.8 / 6.3 |
| S4 | 23 – 29 nov | 34 | 130 | 15 | 21 | 8.7 / 6.2 |
| S5 | 30 nov – 1 dic | 16 | 61 | 6 | 6 | 10.2 / 10.2 |
| **Total** | | **143** | **592** | **72** | **102** | **8.2 / 5.8** |

Dos observaciones:
- **Con la capacidad optimista, el Sprint 0 solo (91 h) consume casi toda la capacidad de todo el proyecto (102 h).**
- Incluso si cada estimación estuviera pasada en un 50 % (296 h en total), seguiría habiendo entre 2.9 y 4.1 veces más trabajo que capacidad.

## Dónde están las horas

| Bloque | Horas | Historias |
|---|---|---|
| Fundaciones, calidad, CI y entornos (S0) | 39 | 10 |
| Sistema de diseño, PWA y navegación (S0) | 22 | 4 |
| Configuración, administradores, bitácora y dispositivos (S0) | 20 | 4 |
| Prueba de concepto de impresión (S0) | 8 | 1 |
| Núcleo del dominio: dinero, medidas, IVA y precios (S1) | 22 | 4 |
| Catálogo M1 (S1) | 22 | 5 |
| Clientes M5 y legal inicial M9 (S1, S3) | 16 | 5 |
| Usuarios, PIN y permisos M8 (S1) | 26 | 6 |
| Sincronización y folios (S2) | 42 | 8 |
| Cotizador M2: captura, estados y documento (S2) | 44 | 12 |
| Órdenes de trabajo M3 (S3) | 48 | 10 |
| Mostrador y corte de caja M4 (S3) | 32 | 9 |
| Impresión de tickets (S3) | 28 | 5 |
| Cuentas por cobrar M6 (S4) | 8 | 3 |
| Reportes M7 (S4) | 18 | 7 |
| Legal M9 completo (S4) | 6 | 2 |
| Facturación M10 (S4) | 54 | 10 |
| Experiencia de usuario (S4) | 10 | 3 |
| Preparar producción, respaldos, monitoreo y manuales (S4) | 22 | 5 |
| Salida a producción, datos reales y entrega (S5) | 36 | 10 |
| Capacitación y aceptación firmada (S5) | 16 | 4 |
| Recorridos de aceptación E1 a E10 | 42 | 10 |
| Cierres de sprint | 11 | 6 |
| **Total** | **592** | **143** |

## Lo que no sé (y cambia todo)

1. **¿Las 3 horas diarias son lo único que el agente puede avanzar?** Si el agente puede trabajar por su cuenta entre sesiones y Juanito solo revisa y decide en sus 3 horas, la capacidad útil sería mayor que 15 o 21 horas. No tengo cómo medir cuánto mayor. **El Sprint 0 es el experimento:** al cerrar sus primeras historias se sabe cuántas horas de reloj tomó cada una realmente.
2. **Qué parte de las 592 horas es mala estimación mía.** Las tallas son juicio, no datos.
3. **Si la ventana de entrega (23 nov – 1 dic) está en el contrato.** Si lo está, manda lo firmado [DC §15]; moverla es una conversación con Luis.

## Opciones

La regla de avance no se negocia: **si no alcanza, se recorta alcance o se mueve la fecha, nunca la calidad** [CLAUDE.md regla 11].

| # | Opción | Qué implica | Efecto en las horas |
|---|---|---|---|
| A | **Subir la capacidad** | Más horas al día o más días, y/o que el agente avance entre sesiones | Para entrar en la ventana hacen falta unas **17 horas al día** contando los 34 días, o unas **25 horas por día hábil** (24 días hábiles). No es realista sin trabajo asíncrono del agente |
| B | **Recortar alcance** | Mover bloques enteros a "después de la entrega" con aprobación de Juanito y, si afecta el contrato, de Luis | Cada bloque de la tabla de arriba libera sus horas. **Ninguno cabe sin recortar varios**; ejemplos: facturación + legal (60 h), reportes y cuentas por cobrar (26 h), preparación de producción y manuales (22 h), impresión de tickets (36 h) |
| C | **Mover la fecha de entrega** | Con el ritmo de 15 h por semana, 592 h son unas 40 semanas (hasta ~agosto de 2027); a 21 h, unas 28 (~mayo de 2027). Con las estimaciones recortadas a la mitad, entre 14 y 20 semanas (~febrero a marzo de 2027) | Sin recortar nada |
| D | **Combinación** | Medir en el Sprint 0, ajustar las tallas con datos reales, y entonces decidir cuánto recortar y cuánto mover la fecha | Depende de lo que se mida |

## Recomendación

1. **No dar la fecha por buena todavía.** Con estos números, el 1 de diciembre no es alcanzable sin cambiar capacidad, alcance o fecha.
2. **Usar el Sprint 0 como medición:** las primeras historias (S0-01 a S0-06) dicen cuántas horas reales cuesta cada talla.
3. **Avisarle a Luis de la incertidumbre ahora**, no al final: el riesgo R3 y R15 ya existían, pero ahora tiene cifras.
4. **Re-estimar tras unos días de Sprint 0** y decidir entre B, C o D con datos. Las cifras se recalculan sumando las tallas de cada historia cuando cambien.
5. Si Juanito prefiere decidir ya, el orden de recorte que sugiero (de menos a más dañino para el corazón del sistema, que es el cotizador sin conexión): P1, P2 y recorrido guiado (ya fuera) → panel de inicio con contenido (S4-24) → fotos de la medición (S3-03) → duplicar e historial de cotizaciones (S2-15, S2-16) → reportes y cuentas por cobrar → facturación. **Es una sugerencia mía; el orden real depende del contrato y de lo que Luis considere indispensable.**
