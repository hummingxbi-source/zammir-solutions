# Plan maestro de entrega · ZAMMIR

> **Para qué sirve.** Es el documento de traspaso. Dice dónde está el proyecto, qué falta y cómo será la entrega a ZAMMIR. Lo lee primero cualquier persona o agente de IA que tome el trabajo desde aquí.
> **Corte:** miércoles 25 de noviembre de 2026, con la fase 10 (AJ-01 a AJ-09) fusionada y desplegada, y las decisiones de la entrega del [ADR-0045]. **Actualizado el 28 nov** con la fase 11 (catálogo escalable), fusionada y desplegada.
> **Regla de este documento:** solo lleva lo que se verificó en el repositorio o en producción. Lo que es una **propuesta** sin aprobar dice *(propuesta)*. Lo que está por confirmar dice *(por confirmar)*.
> **Sin datos reales:** aquí no hay correos, apellidos, teléfonos, montos, llaves ni contraseñas [CLAUDE.md regla 7, ADR-0010].
> **Para arrancar una conversación nueva con un agente de IA:** copiar el texto de [`PROMPT_PARA_EL_SIGUIENTE_AGENTE.md`](PROMPT_PARA_EL_SIGUIENTE_AGENTE.md).

---

## 1. El estado en una página

| Tema | Estado al 25 nov 2026 |
|---|---|
| **Construcción** | Fases 0 a 11 construidas y fusionadas en `main`. La fase 10, *ajustes de operación para la entrega* [ADR-0044], va en los PR #114 a #123 (§2); la fase 11, *catálogo escalable* [ADR-0048], en los PR #132 a #143, fusionados el 28 nov (§2b). |
| **Producción** | `https://sistema.zammir-solutions.com` responde 200 y sirve el último `main` (Vercel). Lleva la política de contenido (CSP) y la política de permisos. La función `salud` responde `{"ok":true}`. Verificado el 25 nov. |
| **Base en la nube** | Un solo proyecto de Supabase, **`zammir-pruebas`**, con **datos inventados** [ADR-0043]. El 25 nov se aplicaron las 8 migraciones de la fase 10 (41 en total), y el **28 nov las 8 de la fase 11 (49 en total)**, con un respaldo a mano antes; en las dos ocasiones se desplegaron las 11 funciones con *Desplegar a Supabase* en el entorno `pruebas`. En la entrega **se borra y se crea uno nuevo vacío**. |
| **Respaldo nocturno** | Activo desde el 24 nov y cifrado; se guarda 30 días en GitHub. Copia la base y las cuentas. La copia de las **fotos de medición** está activa desde el 25 nov, en el entorno `respaldo` [ADR-0046]; falta comprobarlo con una foto real tomada en la tablet (P2), porque `zammir-pruebas` no tenía fotos en las primeras corridas (PD-57). **Restauración de una copia de la nube ensayada y aprobada el 25 nov** (P1). |
| **Calidad automática** | CI en verde en cada PR. Al 24 nov, en local: 2,674 pruebas de unidad y componentes, 339 de integración con Supabase local y 500 de base de datos (pgTAP, 31 archivos). También pasan lint, Prettier, dependencias, mutación del dominio y escaneo de secretos. **Para el informe de calidad se vuelven a correr.** |
| **Facturación** | **En pausa** [ADR-0039]. El código existe y está probado, pero está apagado por interruptor. El contador de ZAMMIR sigue facturando. |
| **Impresión** | Hoja **carta** con la impresión de Android, o PDF por WhatsApp [ADR-0040]. **No hay ticket térmico.** |
| **Titularidad** | Las cuentas, el dominio y el código son de **HummingX BI**; los datos son de ZAMMIR, y HummingX los trata por su cuenta [ADR-0045]. |
| **Repositorio** | **Público hasta la entrega**; se vuelve privado después de firmar (PD-59, [ADR-0045]). |
| **Fechas con Luis** | Capacitación y pruebas: **sábado 28, domingo 29 y lunes 30 de noviembre** (PR-22). **Falta la hora.** |
| **Bloqueos reales** | Las respuestas de Luis (§3), el ensayo de restauración, el respaldo de las fotos, las pruebas con las tablets y la impresora, y el expediente de la entrega (§7). |

---

## 2. Qué se construyó en la fase 10 (para explicarlo en la capacitación)

| Historia | Qué cambia para ZAMMIR | Dónde se ve |
|---|---|---|
| AJ-01 | Las listas de productos, clientes y facturas ya no se cortan en 1000 renglones | Catálogo, Clientes |
| AJ-02 | Si al hacer el corte sobra o falta dinero, aunque sea $1, el sistema pide una **explicación escrita** | Mostrador → Corte |
| AJ-03 | La **fecha de entrega** es obligatoria al crear la orden. Las órdenes vencidas salen como **"Atrasada"** y tienen su propio filtro | Órdenes, Inicio |
| AJ-04 | Las cuentas por cobrar se cuentan **desde la entrega**. Una cuenta está atrasada desde el día siguiente (1 día, configurable). Lo que no se ha entregado sale como "Por entregar" | Cuentas por cobrar |
| AJ-05 | Un administrador marca una transferencia como **"Ya llegó"**; queda quién lo marcó y cuándo | Cuentas por cobrar |
| AJ-06 | Al **cancelar una venta de mostrador**, el dinero se devuelve por el mismo medio y sale del turno abierto de quien cancela. Un corte ya cerrado no cambia | Mostrador, Corte, Reportes |
| AJ-07 | **Entregas por partes:** una orden por cada parte, eligiendo qué líneas de la cotización entran. Se ve "Parte N" y "Faltan N líneas" | Órdenes |
| AJ-08 | El administrador **agrega, renombra, ordena y desactiva categorías** | Catálogo → Categorías |
| AJ-09 | **Cargos extra** (cantos, perforaciones, biselados) ligados a una línea de vidrio, cobrados por m², metro lineal o pieza | Cotizador → "Cargo extra" |

## 2b. Qué se construyó en la fase 11 (para explicarlo en la capacitación)

Aprobada por Juanito el 27 nov con las decisiones D1 a D3 [ADR-0048]. Las fotos de los productos quedaron fuera.

| Historia | Qué cambia para ZAMMIR | Dónde se ve |
|---|---|---|
| CE-01 | **Precio abierto:** el precio del catálogo es de referencia y se fija al cotizar o vender. Arriba no pide nada; abajo es un descuento con PIN (D1) | Catálogo; Cotizador y Mostrador → "Fijar precio" |
| CE-07 | **Duplicar** un producto para dar de alta otro espesor o tono | Catálogo → "Duplicar" |
| CE-04 y PP-39 | **Descripción** del producto: se busca con ella, se ve en el buscador y sale en el documento del cliente | Catálogo, Cotizador, Mostrador, documentos |
| CE-05 | **Ajustes del cobro** por producto: redondeo de medidas, área mínima, cobro mínimo y **medida máxima** (apagados por omisión) | Catálogo; Cotizador avisa la medida máxima |
| CE-02 y PP-40 | **Unidad de venta** ("2 rollos", "3 pares") y **clave SAT** por producto; lista de unidades editable | Catálogo, Configuración |
| CE-08 | **Cargos extra también en el mostrador** | Mostrador → "Cargo extra" |
| CE-06 | **Precios en bloque:** subir o bajar una categoría por porcentaje, redondeado al peso (D3), o actualizar desde un archivo por código; siempre con vista previa y todo o nada | Catálogo → "Precios en bloque" |
| CE-09 | **Paquetes:** un producto que agrega varios renglones de una vez (vidrio + kit + tubo) | Catálogo; Cotizador y Mostrador |
| CE-03 | **Cantidades con decimales** (1.5 kg, 2.5 h) en lo marcado así; se cobra al centavo, la mitad hacia arriba (D2) | Catálogo; Cotizador y Mostrador |

Quedan como propuestas: PP-38 (bitácora del precio fijado arriba de la referencia, sin decidir). Descartada: PP-41 (paquetes desde el CSV).

Decisiones de negocio que tomó Juanito y están en ADR-0044:

- **Reportes:** se quedan como están.
- **Atrasada:** desde el primer día.
- **Diferencia en el corte:** cualquier diferencia, desde $1, pide explicación.
- **Cancelar una venta:** se devuelve el dinero.
- **Partes:** una orden por cada parte.
- **Categorías:** las administra el administrador.
- **Extras:** se cobran por m².

Y en el ADR-0045, **el anticipo al cancelar una orden** (PD-07, ya resuelto):

- No se devuelve en automático.
- **En espera:** se recomienda devolverlo completo.
- **En proceso o Listo:** se retiene para cubrir material y mano de obra, y un administrador puede devolver una parte.
- Siempre con motivo escrito. El efectivo devuelto sale como faltante del corte y se explica ahí; el sistema todavía no registra esa devolución (PP-35).
- Se le explica a Luis en la entrega y queda en el acta (sección 4).

---

## 3. Lo que Luis ya contestó y lo que falta

### 3.1 Ya contestó

- **Wi-Fi en el mostrador (8 nov):** "Wi-Fi estable" (`RESPUESTAS_DE_LUIS.md`, pregunta 34). **No se vuelve a preguntar.**
- **Personas en la tablet (25 nov):** aparecen **Luis** y **Ricardo**, los dos administradores, y **una tercera persona del mostrador**.
- **Correos de los administradores (25 nov):** ya se tienen.
- **Dónde viven estos datos:** el nombre de la tercera persona y los correos están en el WhatsApp de Juanito. **No se copian al repositorio.** Se capturan directo en el sistema el día de la entrega.
- **Rol de la tercera persona:** lo asignó HummingX: **Cajero / vendedor**, sin permisos de administrador [ADR-0045].
- **Grabar y tomar fotos en la entrega:** ZAMMIR dio su consentimiento de palabra.

### 3.2 Falta que conteste

| # | Pregunta | Pendiente | ¿Bloquea la entrega? | Si no llega a tiempo |
|---|---|---|---|---|
| 1 | Su **lista de productos** (50 a 150) con precio | PD-03 | Sí, para operar con datos reales | Se entrega con las categorías y una carga mínima que él dicte en la capacitación. Se importa después con la herramienta |
| 2 | Precio por m² de **cantos, perforaciones y biselados** | PD-02 | No | Se dan de alta como "Cargo extra" con precio cuando lo diga |
| 3 | Qué productos llevan **IVA 0 % o exento** | PD-53 | No | Todo con IVA 16 %, que es lo configurado |
| 4 | **Tiempos de garantía** por tipo de producto (la cobertura ya la dio) | PD-06 | No | Campo configurable; se llena con él |
| 5 | ¿Su **asesor revisa el aviso de privacidad**? | PD-12 | No, pero debe quedar en el acta | Se publica el borrador base de HummingX como versión 1 y se anota |
| 6 | **Marca y modelo de la impresora** (Wi-Fi o de red, tamaño carta) | PD-54 | Solo la prueba de impresión | PDF por WhatsApp como respaldo |
| 7 | **Hora** de las sesiones del 28, 29 y 30 de noviembre | PR-22 | Sí, para la logística | — |

> Con Luis las preguntas son **mínimas**. No se le pregunta lo que ya está decidido ni lo que le toca a HummingX, como los permisos de cada rol o qué tablet se usa dónde. Las dos tablets son compartidas y ya las tiene Juanito.

---

## 4. Lo que falta del sistema (código, configuración y documentos)

### 4.1 Decisiones de HummingX

| # | Decisión | Estado |
|---|---|---|
| D1 | **Anticipo al cancelar una orden** (PD-07) | ✅ Decidido [ADR-0045]: ver la §2 |
| D2 | **Visibilidad del repositorio** | ✅ Decidido [ADR-0045]: público hasta la entrega y privado después (PD-59). Volverlo privado ya agotaría los 2,000 minutos al mes de Actions: en noviembre la integración continua y la mutación usaron unos 2,600 |
| D3 | **Repositorio de la demo `HummingX-BI/formularios`:** es público y tiene datos del cliente (PD-19) | ⏳ Juanito lo dejó como está. Conviene cerrarlo o borrar esos datos antes de la entrega formal |
| D4 | **Rol de la tercera persona** | ✅ Cajero / vendedor [ADR-0045] |
| D5 | **Leyenda "Powered by HummingX BI"** en el pie (PD-30, apagada) | ⏳ Se deja apagada salvo que Juanito decida otra cosa |
| D6 | **Monitoreo de caídas** (PP-32): cuenta gratuita que consulte `salud` | ⏳ Sin ella, nadie se entera de una caída hasta que llama Luis |
| D7 | **Titularidad** de cuentas, dominio y código | ✅ HummingX BI; los datos son de ZAMMIR [ADR-0045] |
| D8 | **Contraseñas de los administradores** | ✅ Luis y Ricardo escriben la suya en persona [ADR-0045] |
| D9 | **Dónde se capacita** (PD-60). Lo que se haga en el proyecto real (ventas, cancelaciones, cortes) queda para siempre: nada contable se borra [RN-18], y el acta promete entregar el sistema sin datos de prueba | ✅ **Decidido el 28 nov:** se capacita con **datos inventados en `zammir-pruebas`**, en Otumba de Gómez Farías. El proyecto real se crea vacío el lunes, **después** de la última sesión y **antes** de la entrega formal, y las tablets se limpian antes de conectarlas (§4.3, paso 8) |

### 4.2 Lo que se corrigió en los documentos (25 nov) y lo que sigue

Ya corregidos, con [ADR-0039], [ADR-0040], [ADR-0043], [ADR-0044] y [ADR-0045]:

- `ACTA_DE_ENTREGA.md` como documento único con anexos;
- `PLAN_DE_ACEPTACION_CLIENTE.md`, con los escenarios 15 a 23 de la fase 10 y del anticipo;
- `PRUEBAS_DE_ACEPTACION.md`, `CIERRE_DEL_PROYECTO.md` y `REVISION_DE_SEGURIDAD.md`;
- `RESTAURACION.md`, `GUIA_DE_OPERACION.md`, `MANUAL_DE_SOPORTE.md`, `PLAN_DE_PRODUCCION.md` y `PUESTA_EN_PRODUCCION.md`;
- `ALCANCE.md` y `MANUAL_DE_USUARIO.md`, en lo que mencionaba QR o facturación.

| Sigue pendiente | Qué falta |
|---|---|
| Plan de soporte en `GUIA_DE_OPERACION.md` §8 y `MANUAL_DE_SOPORTE.md` §10 | Tiempos de respuesta y alcance del servicio, cuando estén en el contrato. El horario ya está: lunes a viernes, de 9:00 a 21:00 |
| `MANUAL_DE_USUARIO.md` | Quitar "(borrador)" y agregar capturas de las pantallas de AJ-02 a AJ-09 (hoy no hay), y exportarlo a PDF |

### 4.3 Configuración el día de la entrega (sigue `PLAN_DE_PRODUCCION.md` §7 y `PUESTA_EN_PRODUCCION.md`)

1. Borrar `zammir-pruebas` en Supabase y crear un proyecto **vacío**, con **otra** contraseña de base. Apagar el **registro abierto** y exigir **contraseñas de 12 caracteres o más**. **No tocar el otro proyecto de la cuenta: es de otro cliente.**
2. GitHub:
   - poner los secretos del proyecto nuevo en el entorno `produccion`, **sin** *Required reviewers* [ADR-0045], con un `SUPABASE_ACCESS_TOKEN` **nuevo**;
   - vaciar el entorno `pruebas` y **revocar en Supabase el token viejo**, porque es de la cuenta y alcanza también el otro proyecto.
3. Correr *Desplegar a Supabase* con el entorno `produccion`. Definir `PORTAL_HASH_PEPPER` **nuevo** en los secretos de las funciones. `BILLING_PROVIDER` queda sin valor.
4. Vercel: poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto nuevo **solo en *Production***, quitarlas de *Preview* y redesplegar.
5. Respaldo nocturno: en el entorno `respaldo`, actualizar `SUPABASE_DB_URL` y las cuatro `SUPABASE_S3_*` con una llave S3 **nueva** del proyecto nuevo. Correrlo a mano y confirmar que salen la copia de la base y la de las fotos.
6. Cuentas de **Luis y Ricardo** con su correo, **sin enviar invitación**. **Cada uno escribe su contraseña en persona.** Después, su rol de administrador por SQL (`PUESTA_EN_PRODUCCION.md` paso 1.5).
7. Las **tres personas con PIN**: Luis y Ricardo como administradores y la persona del mostrador como **Cajero / vendedor**. Cada quien escribe el suyo en persona; **nunca** se manda por mensaje.
8. **Dos tablets:** primero **borrar los datos del sitio** en cada una, porque guardan adentro los documentos de la capacitación y reconectar no los borra: en Chrome, ⋮ → *Configuración* → *Configuración de sitios* → *Todos los sitios* → `sistema.zammir-solutions.com` → **Borrar datos**. Después abrir la app y conectarla con un código nuevo. Comprobar que el Cotizador, Órdenes y el Mostrador no muestren nada de la práctica.
9. **Datos reales:** catálogo, categorías, cargos extra, garantía, datos del negocio y aviso de privacidad. Revisar que no quede **ningún dato de prueba**.
10. Prueba de humo en producción **sin dejar documentos falsos**: cotización, venta, corte y reporte. Si una venta de prueba queda, se cancela con motivo [RN-18] y se anota en el acta.

### 4.4 Versión 1.0.0 y repositorio privado (después de firmar el acta)

Seguir los pasos de `CIERRE_DEL_PROYECTO.md` §6:

1. Subir `apps/web/package.json` y `packages/core/package.json` a `1.0.0`.
2. Poner la fecha en `CHANGELOG.md`.
3. Abrir el PR.
4. Crear la etiqueta `v1.0.0` y la versión en GitHub.
5. Pasar el repositorio a **privado** y comprobar que Vercel siga desplegando (PD-59).

---

## 5. Lo que falta probar

| # | Prueba | Quién | Cuándo | Cómo se sabe que pasó |
|---|---|---|---|---|
| P1 | ✅ **Ensayo de restauración** de una copia **de la nube** con Supabase local (`scripts/ensayo-restauracion-nube.sh`) | Juanito, con Claude | **Hecho el 25 nov** | Aprobado: 30 tablas con los mismos renglones, en 69 s (registro de `RESTAURACION.md`). La copia casi no tenía datos |
| P2 | **Primera tablet** (PLAN_DE_PRODUCCION §4): instalar, conectar, PIN y **modo avión**. La copia del 26 nov mostró que `zammir-pruebas` **no tiene productos**: antes, cargar un catálogo **inventado** (Catálogo → **Importar desde archivo**) | Juanito | Antes del 28 | La venta hecha sin internet aparece en Reportes al reconectar |
| P3 | **Dos tablets a la vez** | Juanito | Antes del 28 | Los folios no chocan y los totales coinciden |
| P4 | **Política de contenido (CSP):** entrar, sincronizar, subir una foto e imprimir | Juanito | Antes del 28 | Nada se bloquea y la consola no muestra avisos de CSP |
| P5 | **Recorrido a mano de AJ-02 a AJ-09** en la tablet (escenarios 15 a 23 del plan de aceptación) | Juanito | Antes del 28 | Cada función hace lo de la tabla de la §2 |
| P6 | **Impresora de Luis:** darla de alta, imprimir cotización, venta, comprobante de orden y corte; probar la marca COPIA y la impresora apagada | Juanito con Luis | Sáb 28 | Hoja carta legible con logo; con la impresora apagada se ofrece el PDF |
| P7 | **WhatsApp:** los mismos documentos | Juanito con Luis | Sáb 28 | Llegan como PDF legible |
| P8 | **Recorridos E1 a E4 y E7 a E10** con el equipo real. E5 y E6 no, porque la facturación está en pausa | Juanito, Luis y el equipo | Sáb 28 | Todos pasan; lo que falle va a la hoja de hallazgos |
| P9 | **Corte de internet a propósito** en el local | Equipo | Sáb 28 | Se sigue cotizando y cobrando |
| P10 | **Tiempos y accesibilidad** (S4-33): letra, botones, contraste, uso con una mano | Equipo | Sáb 28 | Se anota lo que tarde o cueste |
| P11 | **Prueba de humo en producción** ya recreada (§4.3 paso 10) | HummingX | Día de la recreación | Sin datos de prueba al terminar |
| P12 | **Respaldo del proyecto nuevo** | Juanito | Día de la recreación | Salen las dos copias del proyecto nuevo: la base y las fotos |

**Hoja de hallazgos:** cada problema se anota con pantalla, qué se esperaba, qué pasó, hora y foto, **sin datos reales ni llaves**. Se corrige en una rama con PR y CI en verde. **Nunca se corrige directo en producción.**

---

## 6. La entrega como empresa: equipo, guion y grabación *(propuesta)*

### 6.1 Equipo de HummingX en el local *(propuesta; los nombres van solo en los documentos llenados)*

| Papel | Quién | Qué hace |
|---|---|---|
| **Responsable del proyecto** | Juanito | Conduce las sesiones y es el único que maneja llaves, contraseñas y paneles |
| **Apoyo técnico** | Socio 2 | Prepara las tablets y la impresora, sigue la lista de pruebas y llena la hoja de hallazgos |
| **Registro y documentos** | Socio 3 | Graba, toma la minuta, lleva los documentos impresos, recoge las firmas y cuida que la cámara **no capte pantallas con PIN, contraseñas ni datos de clientes** |

Firman el contrato y el acta de entrega dos por cada parte: por ZAMMIR, Luis y Ricardo; por HummingX BI, los dos socios que imparten la capacitación [ADR-0049]. Los nombres completos solo van en las versiones de `privado/`.

### 6.2 Guion de los tres días *(propuesta; ajustar a la hora que dé Luis)*

| Día | Bloque | Qué se hace | Documento que se firma |
|---|---|---|---|
| **Mié 25 a vie 27** (antes) | Preparación | P1 a P5. Respaldo con fotos. Redactar el expediente (§7). Preparar el catálogo con lo que mande Luis | — |
| **Sáb 28** | 1. Apertura (30 min) | Presentar al equipo, objetivo y orden del día. Al empezar a grabar, se repite en cámara el consentimiento que ZAMMIR ya dio de palabra | — |
| | 2. Pruebas con el equipo real (3 h) | P6 a P10, con datos inventados | Hoja de hallazgos (interna) |
| | 3. Aceptación (2 h) | Luis ejecuta el plan de aceptación | Hoja de resultados (anexo A del acta) |
| **Dom 29** | 4. Correcciones | Lo que haya salido el sábado, por PR | — |
| | 5. Capacitación de Luis (3 h) y de Ricardo (3 h), **en `zammir-pruebas` con datos inventados** | Luis completa solo un recorrido de cotización a cobro. Ricardo, lo mismo más los reportes | Anexo B del acta (sesiones 1 y 2) |
| **Lun 30** | 6. Capacitación del mostrador (3 h), **en `zammir-pruebas`** | Cada persona entra con su PIN, cobra, hace su corte y reimprime | Anexo B del acta (sesión 3) |
| | 7. Paso a producción | Recrear el proyecto vacío, datos reales, usuarios, **limpiar las tablets** y conectarlas (§4.3), y P11 y P12 | — |
| | 8. Entrega formal (1 h) | Repaso de lo entregado, entrega del expediente, firma del contrato y del acta de entrega, constancias de capacitación, y foto y video de cierre | Contrato y acta de entrega (anexos C, D y E) |
| **Mar 1 dic** | 9. Cierre | Etiquetar `v1.0.0`, pasar el repositorio a privado, actualizar `CIERRE_DEL_PROYECTO.md` y la retrospectiva | — |

> El orden importa: **primero se prueba y se capacita con datos inventados, y Luis acepta; después se recrea el proyecto vacío y se cargan los datos reales** [ADR-0043]. No se recrea antes de que pasen las pruebas ni antes de la última sesión de capacitación.

### 6.3 Reglas para grabar

- ZAMMIR dio su consentimiento **de palabra**. Al empezar a grabar se pregunta otra vez en cámara, para que quede registrado.
- No grabar pantallas con PIN, contraseñas, correos, llaves ni datos de clientes. Si una pantalla los muestra, se pausa la grabación.
- El video se guarda en el almacenamiento de HummingX, **no en el repositorio**.

---

## 7. Expediente de la entrega (5 documentos) [ADR-0047]

> **Dónde se guardan.** Las **plantillas sin datos** viven en el repositorio: el acta en `docs/entrega/ACTA_DE_ENTREGA.md` y las demás en [`docs/entrega/plantillas/`](plantillas/README.md). **La versión llenada**, con nombres completos, montos, números de serie, datos de soporte y firmas, se prepara en la carpeta local `privado/`, que **git ignora**, y se imprime y exporta a PDF desde ahí [CLAUDE.md regla 7]. Los PDF firmados se copian además al almacenamiento de HummingX.
> Todo va en **una carpeta** con portada, índice y folios. Cada documento lleva su folio, versión, fecha y lugar.

| Folio | Documento | Plantilla | Se firma |
|---|---|---|---|
| HMX-ZAM-01 | **Contrato de prestación de servicios**: alcance, entregables, soporte, garantía del software, titularidad del dominio y del código, datos personales (HummingX los trata por cuenta de ZAMMIR) y terminación | ❌ **Se redacta al final.** No hay borrador previo. Debe concordar con `ALCANCE.md`, ADR-0038, ADR-0039 y ADR-0045. Lo no definido queda [POR DEFINIR]. **Lo revisa un abogado**, incluida la forma de firmar de HummingX, que no está constituida | Luis y Ricardo, y dos socios de HummingX [ADR-0049] de HummingX |
| HMX-ZAM-02 | **Acta de entrega y aceptación**, con anexos: **A** constancia de pruebas de aceptación · **B** capacitación (un apartado por sesión) · **C** entrega de accesos, sin contraseñas · **D** entrega de equipo · **E** aviso de privacidad y su acuse | ✅ [`ACTA_DE_ENTREGA.md`](ACTA_DE_ENTREGA.md) | Luis y Ricardo, y dos socios de HummingX [ADR-0049]; anexo A el sábado, anexo B en cada sesión y el resto el lunes |
| HMX-ZAM-03 | **Informe técnico de entrega**: ficha técnica, calidad y seguridad (cifras **corridas el mismo día**) y plan de continuidad. Es un informe de HummingX: sin sellos ni la palabra "certificado" | ✅ [`plantillas/INFORME_TECNICO_DE_ENTREGA.md`](plantillas/INFORME_TECNICO_DE_ENTREGA.md) | No |
| HMX-ZAM-04 | **Manual de usuario** | ✅ [`MANUAL_DE_USUARIO.md`](../manuales/MANUAL_DE_USUARIO.md), versión 1.0; faltan capturas de las pantallas de AJ-02 a AJ-09 | No |
| HMX-ZAM-05 | **Guías rápidas por rol** para plastificar, con bienvenida y soporte al reverso | ✅ [`plantillas/GUIAS_RAPIDAS.md`](plantillas/GUIAS_RAPIDAS.md) | No |
| ✦ | *Constancia de capacitación* por persona (opcional) | ✅ [`plantillas/CONSTANCIA_DE_CAPACITACION.md`](plantillas/CONSTANCIA_DE_CAPACITACION.md) | HummingX |

**Internos (no se entregan):** orden del día, minuta de cada día y hoja de hallazgos ([`plantillas/INTERNOS_DE_LA_ENTREGA.md`](plantillas/INTERNOS_DE_LA_ENTREGA.md)), `MANUAL_DE_SOPORTE.md` y `GUIA_DE_OPERACION.md`.

**Lo que recibe ZAMMIR** (va en el acta):

- El sistema en `https://sistema.zammir-solutions.com`, con sus datos reales y sin datos de prueba.
- Las dos tablets con la aplicación instalada y conectadas (anexo D del acta).
- La impresión en hoja carta probada con su impresora.
- Sus cuentas de administrador y el registro de quién tiene PIN en la tablet (anexo C del acta).
- La exportación de sus datos, probada (CSV, JSON y PDF).
- El expediente de la entrega.

**Fuera de la entrega**, y así se escribe en el acta:

- Facturación activa (en pausa [ADR-0039]).
- Ticket térmico e impresora Bluetooth [ADR-0040].
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
    - armar listas de preguntas para Luis sin revisar antes `PENDIENTES.md` y `RESPUESTAS_DE_LUIS.md`. Por ejemplo, las fechas ya estaban acordadas en PR-22 y el Wi-Fi ya estaba contestado (pregunta 34).

---

## 9. Datos técnicos para trabajar

| | |
|---|---|
| **Repositorio** | `hummingxbi-source/zammir-solutions` (GitHub, **público hasta la entrega**). Rama principal `main`, sin protección de rama |
| **Copia de trabajo al día** | **`C:\z\s16`**, un *worktree* en `main`. **Trabajar aquí** |
| **Copia de OneDrive** | `C:\Users\jesus\OneDrive\Desktop\Zammir` es el repositorio principal, pero está en una rama vieja (`feat/s0-05-supabase-local`). **No trabajar ahí** sin antes `git switch main && git pull`. `main` ya está tomada por `C:\z\s16`, así que lo práctico es usar `C:\z\s16` o crear un *worktree* nuevo en `C:\z\` |
| **pnpm** | Si no está en el PATH: `C:\z\bin` |
| **Comandos** | `pnpm test` · `pnpm lint` · `pnpm db:start` · `pnpm db:reset && pnpm test:db` · `pnpm test:integracion` (sirve las funciones con `pnpm funciones:empaquetar` y `supabase functions serve --no-verify-jwt --env-file supabase/functions/pruebas.env`) · `pnpm test:e2e` · `pnpm test:mutacion:critico` · `pnpm build && pnpm check:bundle` · `pnpm ensayo:restauracion` |
| **Flujos de GitHub** | *Integración continua* (unos 10 min), *Mutación* (unos 35 min), *Desplegar a Supabase* (entrada `entorno`: `pruebas` o `produccion`) y *Respaldo nocturno* (programado a las 2:00 a. m.; GitHub lo ha corrido con horas de retraso) |
| **Migraciones** | 41 en `supabase/migrations`, aditivas. La última es `20261125070000_cargos_extra.sql` |
| **Decisiones** | ADR-0001 a ADR-0047 en `docs/decisiones/`, índice en `DECISIONES.md` |
| **Pendientes** | `docs/producto/PENDIENTES.md` (PD abiertos, PR resueltos, PP propuestas) |
| **Correcciones de interfaz que pidió Juanito** | Lo del 14 nov ya se atendió (PR #92, #93, #110 y #111). La lista sigue abierta para lo que reporte al probar |

---

## 10. Lista de verificación rápida (lo que debe estar en verde antes del lunes 30)

- [ ] Luis dio la hora de las sesiones.
- [x] Decisiones D1, D2, D4, D7 y D8 tomadas y registradas [ADR-0045].
- [ ] D3, D5 y D6 decididas o anotadas.
- [x] Ensayo de restauración de una copia de la nube aprobado (P1, 25 nov).
- [x] Respaldo con las fotos de medición y en su entorno propio [ADR-0046]: activo desde el 25 nov.
- [ ] Copia de fotos comprobada con una foto real (P2, PD-57).
- [ ] P2 a P5 hechas con las dos tablets.
- [x] Documentos de la §4.2 corregidos por PR.
- [x] Expediente de la §7 redactado como plantilla, salvo el contrato (ADR-0047).
- [ ] Contrato (HMX-ZAM-01) redactado y revisado por un abogado.
- [ ] Versiones llenadas en `privado/` y exportadas a PDF.
- [ ] Catálogo real listo para cargar, o un plan B acordado con Luis.
- [ ] Impresiones: contrato, acta de entrega con sus anexos A a E, hoja de resultados del plan de aceptación, informe técnico, manual de usuario, guías rápidas (plastificadas), constancias y, para uso interno, orden del día, minuta y hoja de hallazgos.
- [ ] Gestor de contraseñas listo con las cuentas nuevas de la plataforma.
