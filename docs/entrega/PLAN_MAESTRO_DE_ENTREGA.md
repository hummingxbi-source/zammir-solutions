# Plan maestro de entrega · ZAMMIR

> **Para qué sirve.** Es el documento de traspaso. Dice dónde está el proyecto, qué falta y cómo será la entrega a ZAMMIR. Lo lee primero cualquier persona o agente de IA que tome el trabajo desde aquí.
> **Corte:** miércoles 25 de noviembre de 2026, después de fusionar y desplegar la fase 10 (AJ-01 a AJ-09).
> **Regla de este documento:** solo lleva lo que se verificó en el repositorio o en producción. Lo que es una **propuesta** sin aprobar dice *(propuesta)*. Lo que está por confirmar dice *(por confirmar)*.
> **Sin datos reales:** aquí no hay correos, apellidos, teléfonos, llaves ni contraseñas [CLAUDE.md regla 7, ADR-0010].
> **Para arrancar una conversación nueva con un agente de IA:** copiar el texto de [`PROMPT_PARA_EL_SIGUIENTE_AGENTE.md`](PROMPT_PARA_EL_SIGUIENTE_AGENTE.md).

---

## 1. El estado en una página

| Tema | Estado al 25 nov 2026 |
|---|---|
| **Construcción** | Fases 0 a 10 construidas y fusionadas en `main`. La última fue la fase 10, *ajustes de operación para la entrega* [ADR-0044], en los PR #114 a #123 (detalle en la §2). |
| **Producción** | `https://sistema.zammir-solutions.com` responde 200 y sirve la versión `f9926` de `main`. Lleva la política de contenido (CSP) y la política de permisos. La función `salud` responde `{"ok":true}`. |
| **Base en la nube** | Un solo proyecto de Supabase, **`zammir-pruebas`**, con **datos inventados** [ADR-0043]. El 25 nov se aplicaron las 8 migraciones de la fase 10 y se desplegaron las 11 funciones, con *Desplegar a Supabase* en el entorno `pruebas`. En la entrega **se borra y se crea uno nuevo vacío**. |
| **Respaldo nocturno** | Activo desde el 24 nov y cifrado; se guarda 30 días en GitHub. **Falta ensayar la restauración de una copia de la nube** (§5). |
| **Calidad automática** | CI en verde en cada PR. Al 24 nov, en local: 2,674 pruebas de unidad y componentes, 339 de integración con Supabase local y 500 de base de datos (pgTAP, 31 archivos). También pasan lint, Prettier, dependencias, mutación del dominio y escaneo de secretos. |
| **Facturación** | **En pausa** [ADR-0039]. El código existe y está probado, pero está apagado por interruptor. El contador de ZAMMIR sigue facturando. |
| **Impresión** | Hoja **carta** con la impresión de Android, o PDF por WhatsApp [ADR-0040]. **No hay ticket térmico.** |
| **Fechas con Luis** | Capacitación y pruebas: **sábado 28, domingo 29 y lunes 30 de noviembre** (PR-22). **Falta la hora.** |
| **Bloqueos reales** | Las respuestas de Luis (§3), el ensayo de restauración, las pruebas con las tablets y la impresora, y los documentos de la entrega (§7). **Ninguno es de código.** |

---

## 2. Qué se construyó en la fase 10 (para explicarlo en la capacitación)

| Historia | Qué cambia para ZAMMIR | Dónde se ve |
|---|---|---|
| AJ-01 | Las listas de productos, clientes y facturas ya no se cortan en 1000 renglones | Catálogo, Clientes |
| AJ-02 | Si al hacer el corte sobra o falta dinero, aunque sea $1, el sistema pide una **explicación escrita** | Mostrador → Corte |
| AJ-03 | La **fecha de entrega** es obligatoria al crear la orden. Las órdenes vencidas salen como **"Atrasada"** y tienen su propio filtro | Órdenes, Inicio |
| AJ-04 | Las cuentas por cobrar se cuentan **desde la entrega**. Una cuenta está atrasada desde el día siguiente (1 día, configurable). Lo que no se ha entregado sale como "Por entregar" | Cuentas por cobrar |
| AJ-05 | Un administrador marca una transferencia como **"Ya llegó"**; queda quién lo marcó y cuándo | Cuentas por cobrar, detalle de la orden |
| AJ-06 | Al **cancelar una venta de mostrador**, el dinero se devuelve por el mismo medio y sale del turno abierto de quien cancela. Un corte ya cerrado no cambia | Mostrador, Corte, Reportes |
| AJ-07 | **Entregas por partes:** una orden por cada parte, eligiendo qué líneas de la cotización entran. Se ve "Parte N" y "Faltan N líneas" | Cotizaciones, Órdenes |
| AJ-08 | El administrador **agrega, renombra, ordena y desactiva categorías** | Catálogo → Categorías |
| AJ-09 | **Cargos extra** (cantos, perforaciones, biselados) ligados a una línea de vidrio, cobrados por m², metro lineal o pieza | Cotizador → "Cargo extra" |

Decisiones de negocio que tomó Juanito y están en ADR-0044:

- **Reportes:** se quedan como están.
- **Atrasada:** desde el primer día.
- **Diferencia en el corte:** cualquier diferencia, desde $1, pide explicación.
- **Cancelar una venta:** se devuelve el dinero.
- **Partes:** una orden por cada parte.
- **Categorías:** las administra el administrador.
- **Extras:** se cobran por m².
- **PD-07, anticipo al cancelar una orden:** lo define HummingX y se le dice a Luis el día de la entrega (§4).

---

## 3. Lo que Luis ya contestó y lo que falta

### 3.1 Ya contestó (25 nov 2026)

- **Personas en la tablet:** aparecen **Luis** y **Ricardo**, los dos administradores, y **una tercera persona del mostrador**.
- **Correos de los administradores:** ya se tienen.
- **Dónde viven estos datos:** el nombre de la tercera persona y los correos están en el WhatsApp de Juanito. **No se copian al repositorio.** Se capturan directo en el sistema el día de la entrega.
- **Rol de la tercera persona:** lo asigna HummingX, no Luis. *(Propuesta: Cajero / vendedor.)*

### 3.2 Falta que conteste

| # | Pregunta | Pendiente | ¿Bloquea la entrega? | Si no llega a tiempo |
|---|---|---|---|---|
| 1 | Su **lista de productos** (50 a 150) con precio | PD-03 | Sí, para operar con datos reales | Se entrega con las categorías y una carga mínima que él dicte en la capacitación. Se importa después con la herramienta |
| 2 | Precio por m² de **cantos, perforaciones y biselados** | PD-02 | No | Se dan de alta como "Cargo extra" con precio cuando lo diga |
| 3 | Qué productos llevan **IVA 0 % o exento** | PD-53 | No | Todo con IVA 16 %, que es lo configurado |
| 4 | **Tiempos de garantía** por tipo de producto (la cobertura ya la dio) | PD-06 | No | Campo configurable; se llena con él |
| 5 | ¿Su **asesor revisa el aviso de privacidad**? | PD-12 | No, pero debe quedar en el acta | Se publica el borrador base de HummingX como versión 1 y se anota |
| 6 | **Marca y modelo de la impresora** (Wi-Fi o de red, tamaño carta) | PD-54 | Solo la prueba de impresión | PDF por WhatsApp como respaldo |
| 7 | ¿Hay **Wi-Fi en el mostrador**? | — | No (el sistema funciona sin internet) | Las tablets traen datos móviles |
| 8 | **Hora** de las sesiones del 28, 29 y 30 de noviembre | PR-22 | Sí, para la logística | — |

> Con Luis las preguntas son **mínimas**. No se le pregunta lo que ya está decidido ni lo que le toca a HummingX, como los permisos de cada rol o qué tablet se usa dónde. Las dos tablets son compartidas y ya las tiene Juanito.

---

## 4. Lo que falta del sistema (código, configuración y documentos)

### 4.1 Decisiones que le tocan a HummingX antes del sábado 28

| # | Decisión | Por qué importa |
|---|---|---|
| D1 | **PD-07: qué pasa con el anticipo si se cancela una orden.** Hoy el sistema registra el anticipo y no lo devuelve solo | Se le comunica a Luis el día de la entrega y debe quedar por escrito en el acta |
| D2 | **¿Se vuelve privado `zammir-solutions` antes de los datos reales?** El repositorio es **público**. Juanito decidió dejarlo así el 24 nov. Las copias nocturnas se guardan **cifradas** en ese repositorio | Con datos reales, una copia cifrada en un repositorio público depende solo de la clave. En un repositorio privado con la cuenta gratuita: 2,000 minutos de Actions al mes y no existe *Required reviewers*. Hay que decidirlo y registrar el ADR |
| D3 | **Repositorio de la demo `HummingX-BI/formularios`:** es público y tiene datos del cliente (PD-19). Juanito lo dejó como está | Conviene cerrarlo o borrar esos datos antes de la entrega formal |
| D4 | **Rol de la tercera persona** | *(Propuesta: Cajero / vendedor.)* |
| D5 | **Leyenda "Powered by HummingX BI"** en el pie (PD-30, apagada) | Se le pregunta a Luis o se deja apagada |
| D6 | **Monitoreo de caídas** (PP-32): cuenta gratuita que consulte `salud` | Sin ella, nadie se entera de una caída hasta que llama Luis |

### 4.2 Documentos del repositorio que quedaron viejos (corregir antes de imprimir)

| Documento | Qué está mal | Debe decir |
|---|---|---|
| `docs/entrega/ACTA_DE_ENTREGA.md` | Promete una "impresora térmica emparejada" y tiene una sección de facturación activa | Impresora **carta** Wi-Fi [ADR-0040]. Facturación **en pausa**, no forma parte de esta entrega [ADR-0039] |
| `docs/calidad/PRUEBAS_DE_ACEPTACION.md` | E2 habla de "ticket térmico con QR" y E10 de "30 tickets seguidos" | Comprobante en hoja carta y PDF por WhatsApp. E5 y E6 (facturación) quedan fuera mientras esté en pausa |
| `docs/calidad/PLAN_DE_ACEPTACION_CLIENTE.md` | Los escenarios 7 a 10 son de facturación y el 13 de tickets térmicos. **No hay escenarios para AJ-02 a AJ-09** | Marcar 7 a 10 como "fuera, en pausa". Cambiar el 13 a hoja carta. Agregar escenarios para el corte con explicación, la fecha de entrega y "Atrasada", "Ya llegó", la devolución al cancelar, las partes, las categorías y los cargos extra |
| `docs/entrega/CIERRE_DEL_PROYECTO.md` | Estado al 8 nov, con cifras de pruebas viejas | Estado al día de la entrega, con las cifras nuevas |
| `docs/calidad/REVISION_DE_SEGURIDAD.md` | Dice que falta la CSP y cuenta 26 tablas | La CSP ya está (PR #113). Tablas nuevas: `refunds` y `payment_confirmations`; volver a contarlas con la prueba 22 |
| `docs/operacion/PLAN_DE_PRODUCCION.md` | Fase 1 paso 4: `PORTAL_HASH_PEPPER` sin marcar | Solo lo usa el portal de autofacturación (`supabase/functions/_shared/portal.ts`), que está apagado. Si falta, usa la llave de servicio. Opciones: definirlo de todos modos en el proyecto nuevo (recomendado, cuesta un minuto) o anotar que se define al reactivar la facturación |
| `docs/operacion/GUIA_DE_OPERACION.md` §7 (accesos) | Pone a ZAMMIR como titular de Supabase, Vercel y Cloudflare, con Juanito como colaborador, y dice que cada administrador elige su contraseña. Hoy la organización de Supabase es "HummingX BI", y `PUESTA_EN_PRODUCCION.md` paso 5 dice que Juanito crea la cuenta con una contraseña larga del gestor | Que Juanito decida quién es titular de cada cuenta después de la entrega y quién elige la contraseña. Después, alinear los dos documentos y el contrato |
| `docs/operacion/GUIA_DE_OPERACION.md` §8 y `MANUAL_DE_SOPORTE.md` §10 | El plan de soporte dice "pendiente según el contrato" | Copiar lo que fije el contrato: canales, horario, tiempos de respuesta, qué incluye la anualidad y qué se cobra aparte |

### 4.3 Configuración el día de la entrega (sigue `PLAN_DE_PRODUCCION.md` §7 y `PUESTA_EN_PRODUCCION.md`)

1. Borrar `zammir-pruebas` en Supabase y crear un proyecto **vacío**, con **otra** contraseña de base. **No tocar el otro proyecto de la cuenta: es de otro cliente.**
2. GitHub: poner los secretos del proyecto nuevo en el entorno `produccion` (con *Required reviewers*, si el repositorio sigue público) y vaciar el entorno `pruebas`.
3. Correr *Desplegar a Supabase* con el entorno `produccion`.
4. Vercel: poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto nuevo **solo en *Production***, quitarlas de *Preview* y redesplegar.
5. Respaldo nocturno: actualizar `SUPABASE_DB_URL`, correrlo a mano y confirmar que sale la copia.
6. Cuentas de **Luis y Ricardo** con su correo y una contraseña larga del gestor, **sin enviar invitación**. Después, su rol de administrador por SQL (paso 5).
7. Las **tres personas con PIN**. Cada quien escribe el suyo en persona; **nunca** se manda por mensaje.
8. **Dos tablets:** reconectar cada una con un código nuevo.
9. **Datos reales:** catálogo, categorías, cargos extra, garantía, datos del negocio y aviso de privacidad. Revisar que no quede **ningún dato de prueba**.
10. Prueba de humo en producción **sin dejar documentos falsos**: cotización, venta, corte y reporte. Si una venta de prueba queda, se cancela con motivo [RN-18] y se anota en el acta.

### 4.4 Versión 1.0.0 (después de firmar el acta)

Seguir los pasos de la sección *Publicar la versión* de `ACTA_DE_ENTREGA.md`:

1. Subir los `package.json` a `1.0.0`.
2. Poner la fecha en `CHANGELOG.md`.
3. Abrir el PR.
4. Crear la etiqueta `v1.0.0` y la versión en GitHub.

---

## 5. Lo que falta probar

| # | Prueba | Quién | Cuándo | Cómo se sabe que pasó |
|---|---|---|---|---|
| P1 | **Ensayo de restauración** de una copia **de la nube** (PLAN_DE_PRODUCCION §5 paso 3) con Supabase local | Juanito (necesita Docker y la clave del respaldo) | **Antes del 28**, sin falta | Anotado en el registro de `RESTAURACION.md`. Es la única copia que existe (plan gratuito) |
| P2 | **Primera tablet** (PLAN_DE_PRODUCCION §4): instalar, conectar, PIN y **modo avión** | Juanito | Antes del 28 | La venta hecha sin internet aparece en Reportes al reconectar |
| P3 | **Dos tablets a la vez** | Juanito | Antes del 28 | Los folios no chocan y los totales coinciden |
| P4 | **Política de contenido (CSP):** entrar, sincronizar, subir una foto e imprimir | Juanito | Antes del 28 | Nada se bloquea y la consola no muestra avisos de CSP |
| P5 | **Recorrido a mano de AJ-02 a AJ-09** en la tablet (lista de la §2) | Juanito | Antes del 28 | Cada función hace lo de la tabla |
| P6 | **Impresora de Luis:** darla de alta, imprimir cotización, venta, comprobante de orden y corte; probar la marca COPIA y la impresora apagada | Juanito con Luis | Sáb 28 | Hoja carta legible con logo; con la impresora apagada se ofrece el PDF |
| P7 | **WhatsApp:** los mismos documentos | Juanito con Luis | Sáb 28 | Llegan como PDF legible |
| P8 | **Recorridos E1 a E4 y E7 a E10** con el equipo real. E5 y E6 no, porque la facturación está en pausa | Juanito, Luis y el equipo | Sáb 28 | Todos pasan; lo que falle va a la hoja de hallazgos |
| P9 | **Corte de internet a propósito** en el local | Equipo | Sáb 28 | Se sigue cotizando y cobrando |
| P10 | **Tiempos y accesibilidad** (S4-33): letra, botones, contraste, uso con una mano | Equipo | Sáb 28 | Se anota lo que tarde o cueste |
| P11 | **Prueba de humo en producción** ya recreada (§4.3 paso 10) | HummingX | Día de la recreación | Sin datos de prueba al terminar |
| P12 | **Respaldo del proyecto nuevo** | Juanito | Día de la recreación | Sale la copia del proyecto nuevo |

**Hoja de hallazgos:** cada problema se anota con pantalla, qué se esperaba, qué pasó, hora y foto, **sin datos reales ni llaves**. Se corrige en una rama con PR y CI en verde. **Nunca se corrige directo en producción.**

---

## 6. La entrega como empresa: equipo, guion y grabación *(propuesta)*

### 6.1 Equipo de HummingX en el local *(propuesta; asignar nombres)*

| Papel | Quién | Qué hace |
|---|---|---|
| **Responsable del proyecto** | Juanito | Conduce las sesiones, firma por HummingX y es el único que maneja llaves, contraseñas y paneles |
| **Apoyo técnico** | Compañero 1 | Prepara las tablets y la impresora, sigue la lista de pruebas y llena la hoja de hallazgos |
| **Registro y documentos** | Compañero 2 | Graba, toma la minuta, lleva los documentos impresos, recoge las firmas y cuida que la cámara **no capte pantallas con PIN, contraseñas ni datos de clientes** |

### 6.2 Guion de los tres días *(propuesta; ajustar a la hora que dé Luis)*

| Día | Bloque | Qué se hace | Documento que se firma |
|---|---|---|---|
| **Mié 25 a vie 27** (antes) | Preparación | P1 a P5. Corregir los documentos de la §4.2. Redactar contrato, actas e informe (§7). Decidir D1 a D6. Preparar el catálogo con lo que mande Luis | — |
| **Sáb 28** | 1. Apertura (30 min) | Presentar al equipo, objetivo, orden del día y **consentimiento para grabar** | Consentimiento de grabación |
| | 2. Pruebas con el equipo real (3 h) | P6 a P10, con datos inventados | Hoja de hallazgos |
| | 3. Aceptación (2 h) | Luis ejecuta el plan de aceptación actualizado | Plan de aceptación firmado (S5-10) |
| **Dom 29** | 4. Correcciones | Lo que haya salido el sábado, por PR | — |
| | 5. Paso a producción | Recrear el proyecto, datos reales, usuarios y tablets (§4.3), y P11 y P12 | — |
| | 6. Capacitación de Luis (3 h) y de Ricardo (3 h) | Luis completa solo un recorrido de cotización a cobro. Ricardo, lo mismo más los reportes | Acta de capacitación por sesión |
| **Lun 30** | 7. Capacitación del mostrador (3 h) | Cada persona entra con su PIN, cobra, hace su corte y reimprime | Acta de capacitación |
| | 8. Entrega formal (1 h) | Repaso de lo entregado, entrega de manuales y accesos, firma del contrato (si no se firmó antes) y del acta de entrega, y foto y video de cierre | Contrato, acta de entrega, carta de equipo y aviso de privacidad aceptado |
| **Mar 1 dic** | 9. Cierre | Etiquetar `v1.0.0`, actualizar `CIERRE_DEL_PROYECTO.md` y la retrospectiva | — |

> El orden importa: **primero se prueba con datos inventados y Luis acepta; después se recrea el proyecto vacío y se cargan los datos reales** [ADR-0043]. No se recrea antes de que pasen las pruebas.

### 6.3 Reglas para grabar

- Consentimiento **por escrito** de quienes salen en el video (§7, documento 9).
- No grabar pantallas con PIN, contraseñas, correos, llaves ni datos de clientes. Si una pantalla los muestra, se pausa la grabación.
- El video se guarda en el almacenamiento de HummingX, **no en el repositorio**.

---

## 7. Paquete de documentos de la entrega

> **Dónde se guardan.** Una **plantilla sin datos** puede vivir en el repositorio, en `docs/entrega/`. **La versión llenada**, con nombres completos, montos, RFC o firmas, se guarda **fuera del repositorio**, en una carpeta privada de HummingX, y se imprime de ahí [CLAUDE.md regla 7]. La carpeta de OneDrive `Desktop\Zammir` **es** un repositorio de git: ahí no van los documentos llenados.

| # | Documento | Existe | Qué falta | Firma |
|---|---|---|---|---|
| 1 | **Contrato de prestación de servicios** (alcance, entregables, anualidad, soporte, garantía del software, propiedad del código y del dominio, datos personales como encargado, terminación) | ❌ *(por confirmar si Juanito ya tiene un borrador)* | Redactar la plantilla. Debe concordar con `ALCANCE.md`, ADR-0038 (hosting $0 más dominio y PAC) y ADR-0039 (facturación en pausa). Montos y plazos los pone Juanito; **no se inventan** | Luis y Juanito |
| 2 | **Acta de entrega** | ✅ `docs/entrega/ACTA_DE_ENTREGA.md` | Corregir según la §4.2. Agregar la política del anticipo (D1) y las decisiones de ADR-0044 | Luis y Juanito |
| 3 | **Plan y constancia de aceptación** | ✅ `docs/calidad/PLAN_DE_ACEPTACION_CLIENTE.md` | Actualizar según la §4.2 | Luis |
| 4 | **Acta de capacitación**, una por sesión: asistentes, temas, duración, criterio cumplido y observaciones | ❌ | Crear la plantilla con los criterios de S5-11 a S5-13 | Quien recibe y quien imparte |
| 5 | **Constancia de capacitación** por persona *(propuesta)* | ❌ | Diseño sencillo con la identidad de HummingX | Juanito |
| 6 | **Informe de calidad y seguridad**: qué pruebas hay y cuántas, mutación, revisión de seguridad (RLS en todas las tablas, secretos, dependencias), CSP, respaldo y ensayo de restauración, y lo que **no** se probó | ❌ (las fuentes sí existen) | Escribirlo con cifras **corridas el mismo día**, sin copiar las de este documento. Fuentes: `REVISION_DE_SEGURIDAD.md`, `TESTING.md`, el CI y `RESTAURACION.md` | Juanito |
| 7 | **Carta de entrega de equipo**: tablets (modelo, número de serie, accesorios) y estado | ❌ *(por confirmar si las tablets se venden, se prestan o van en el contrato)* | Plantilla | Luis y Juanito |
| 8 | **Entrega de accesos**: qué cuentas existen, quién tiene cada una y por qué canal se entregó. **Sin las contraseñas** | 🟡 `GUIA_DE_OPERACION.md` §7 | Llenarla el día de la entrega | Luis y Juanito |
| 9 | **Consentimiento para grabar y tomar fotos** | ❌ | Plantilla corta | Cada persona grabada |
| 10 | **Aviso de privacidad** versión final | 🟡 borrador base en el sistema | PD-12 | Se publica en Configuración |
| 11 | **Manual de usuario** | 🟡 borrador que ya incluye la fase 10 | Quitar "(borrador)", revisar las capturas y exportarlo a PDF | — |
| 12 | **Guía rápida por rol**, una hoja plastificable para Administrador y para Cajero / vendedor *(propuesta)* | ❌ | Crear | — |
| 13 | **Manual de soporte** y **guía de operación** | 🟡 | Plan de soporte según el contrato (§4.2) | — |
| 14 | **Minuta de cada día** y **hoja de hallazgos** | ❌ | Plantillas | Luis y Juanito |
| 15 | **Pendientes aceptados** (errores menores con fecha) | ✅ dentro del acta | Llenar el día | Luis y Juanito |

**Lo que recibe ZAMMIR** (va en el acta):

- El sistema en `https://sistema.zammir-solutions.com`, con sus datos reales y sin datos de prueba.
- Las dos tablets con la aplicación instalada y conectadas.
- La impresora probada.
- Los manuales: usuario, guía rápida, soporte y operación.
- Los accesos, entregados por un canal seguro.
- La exportación de sus datos, probada (CSV, JSON y PDF).
- El código fuente con su historial.
- El `CHANGELOG` de la versión `1.0.0`.
- El dominio a nombre de ZAMMIR, o el plan para transferirlo.
- El plan de soporte del contrato.

**Fuera de la entrega**, y así se escribe en el acta:

- Facturación activa (en pausa [ADR-0039]).
- Portal de seguimiento P1.
- Existencias P2.
- Las propuestas sin aprobar de `PENDIENTES.md`.

---

## 8. Reglas que no se rompen (resumen para quien siga)

1. Lo de `CLAUDE.md`, sobre todo:
   - no inventar reglas de negocio (lo no definido va a `PENDIENTES.md`);
   - dinero en centavos;
   - nada contable se borra;
   - fechas en UTC, mostradas en hora de México;
   - interfaz en español de México;
   - **sin secretos ni datos reales**;
   - cada decisión lleva su ADR;
   - plan breve antes de una tarea grande;
   - **no se avanza con algo en rojo**, y nunca se bajan umbrales ni se apagan pruebas.
2. **Llaves, contraseñas y tokens:** solo en los paneles y en el gestor de contraseñas. Nunca en el repositorio, en el chat ni en un documento. Los PIN nunca se mandan por mensaje.
3. **No tocar el otro proyecto de Supabase** de la cuenta: es de otro cliente.
4. **Nunca correr `supabase config push`.**
5. **No se usa verificación en dos pasos** [ADR-0041]. **No recomendar planes de pago** de Supabase o Vercel [ADR-0038], salvo que se materialice un riesgo.
6. **Una migración que ya corrió no se edita:** se corrige con otra nueva.
7. **Cada cambio va por PR** con la compuerta en verde. **Se fusiona solo cuando Juanito lo dice.** Los cambios de base se suben con *Desplegar a Supabase*.
8. **Con Juanito en paneles:** un paso concreto por mensaje, y esperar su respuesta.
9. **Con Luis:** preguntas mínimas. Los permisos de cada rol los decide HummingX.
10. **Verificar antes de afirmar.** Errores que ya pasaron y no deben repetirse:
    - confundir el repositorio de la demo (`HummingX-BI/formularios`) con el del proyecto (`hummingxbi-source/zammir-solutions`);
    - decir que el corte es "a ciegas" (no lo es: muestra lo esperado);
    - armar listas de preguntas para Luis sin revisar antes `PENDIENTES.md` y `RESPUESTAS_DE_LUIS.md`. Por ejemplo, las fechas ya estaban acordadas en PR-22 y solo faltaba la hora.

---

## 9. Datos técnicos para trabajar

| | |
|---|---|
| **Repositorio** | `hummingxbi-source/zammir-solutions` (GitHub, **público**). Rama principal `main`, sin protección de rama |
| **Copia de trabajo al día** | **`C:\z\s16`**, un *worktree* en `main`. **Trabajar aquí** |
| **Copia de OneDrive** | `C:\Users\jesus\OneDrive\Desktop\Zammir` es el repositorio principal, pero está en una rama vieja (`feat/s0-05-supabase-local`). **No trabajar ahí** sin antes `git switch main && git pull`. `main` ya está tomada por `C:\z\s16`, así que lo práctico es usar `C:\z\s16` o crear un *worktree* nuevo en `C:\z\` |
| **pnpm** | Si no está en el PATH: `C:\z\bin` |
| **Comandos** | `pnpm test` · `pnpm lint` · `pnpm db:start` · `pnpm db:reset && pnpm test:db` · `pnpm test:integracion` (sirve las funciones con `pnpm funciones:empaquetar` y `supabase functions serve --no-verify-jwt --env-file supabase/functions/pruebas.env`) · `pnpm test:e2e` · `pnpm test:mutacion:critico` · `pnpm build && pnpm check:bundle` · `pnpm ensayo:restauracion` |
| **Flujos de GitHub** | *Integración continua* (unos 10 min), *Mutación* (unos 35 min), *Desplegar a Supabase* (entrada `entorno`: `pruebas` o `produccion`) y *Respaldo nocturno* (2:00 a. m.) |
| **Migraciones** | 41 en `supabase/migrations`, aditivas. La última es `20261125070000_cargos_extra.sql` |
| **Decisiones** | ADR-0001 a ADR-0044 en `docs/decisiones/`, índice en `DECISIONES.md` |
| **Pendientes** | `docs/producto/PENDIENTES.md` (PD abiertos, PR resueltos, PP propuestas) |
| **Correcciones de interfaz que pidió Juanito** | Lo del 14 nov ya se atendió (PR #92, #93, #110 y #111). La lista sigue abierta para lo que reporte al probar |

---

## 10. Lista de verificación rápida (lo que debe estar en verde antes del lunes 30)

- [ ] Luis dio la hora de las sesiones.
- [ ] Decisiones D1 a D6 tomadas y registradas (ADR o `PENDIENTES.md`).
- [ ] Ensayo de restauración de una copia de la nube aprobado (P1).
- [ ] P2 a P5 hechas con las dos tablets.
- [ ] Documentos de la §4.2 corregidos por PR.
- [ ] Documentos 1, 4, 6, 7, 9, 12 y 14 de la §7 redactados como plantilla. Los llenados van fuera del repositorio.
- [ ] Catálogo real listo para cargar, o un plan B acordado con Luis.
- [ ] Impresiones: acta de entrega, plan de aceptación, actas de capacitación, consentimientos, guías rápidas, contrato y hoja de hallazgos.
- [ ] Gestor de contraseñas listo con las cuentas nuevas (Supabase, administradores) y su forma de entrega.
