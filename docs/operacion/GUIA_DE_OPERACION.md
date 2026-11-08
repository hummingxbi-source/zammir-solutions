# Guía de operación

> Historia S5-14 · requerimientos RNF-20 y RNF-32 · [DC §13]. Para **Juanito** (HummingX BI) y quien lo releve: cómo se mantiene ZAMMIR funcionando una vez entregado.
> Borrador. Lo que depende de cuentas, contratos o decisiones que todavía no existen está marcado **(pendiente: …)**. Se completa al salir a producción (S4-26, S5-01) y se revisa en la entrega.
> Esta guía es el **índice de operación**: el detalle está en el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) y en la [guía de restauración](RESTAURACION.md).

## 1. Qué hace falta saber (en una página)

| | |
|---|---|
| **Qué es** | Cotizador y mostrador en tablet que funcionan **sin internet**, con órdenes de trabajo, cuentas por cobrar, reportes y facturación. Una sola vidriería, en Otumba. |
| **Dónde vive** | Aplicación en **Vercel**; base de datos, cuentas y funciones de servidor en **Supabase**; timbrado en un **PAC** externo **(pendiente: PD-05)**. |
| **Qué se rompe primero** | Casi nada de lo que ve el mostrador: la tablet guarda lo capturado y lo envía cuando vuelve la conexión. Lo que sí requiere servidor es facturar, entrar a las secciones de administración, registrar tablets y el portal de autofacturación. |
| **Regla de oro** | Los datos reales **nunca** se usan en pruebas, **ningún agente de IA** entra a producción [RNF-19] y el certificado de ZAMMIR (CSD) **nunca** pasa por el código: se sube directo al proveedor de timbrado [RF-M10-02]. |

## 2. Rutina

### Cada día (2 minutos)
- [ ] Abrir `<dirección de Supabase>/functions/v1/salud`: debe responder `{"ok":true}`. Con un monitoreo externo esto avisa solo **(pendiente: cuenta del monitoreo, PP-32)**.
- [ ] Si alguien reportó un problema, pedir **sección, hora y folio** (nunca PIN ni contraseñas) y revisar `error_log` (§ 6 del manual de soporte).

### Cada semana (10 minutos)
- [ ] **Errores:** `select * from public.admin_error_log(100)` desde una sesión de administrador (o el editor SQL de Supabase). Un error que se repite se atiende; uno aislado se anota.
- [ ] **Facturas "en proceso":** en **Facturas → Emitidas**, ninguna debe llevar días en ese estado; si la hay, **Reintentar** (los reintentos automáticos todavía no están programados **(pendiente: S4-26)**).
- [ ] **Tablets:** en **Usuarios → Tablets**, la columna *Último envío* de cada una debe ser reciente. Una tablet que lleva días sin enviar tiene capturas sin llegar.
- [ ] **Respaldos:** confirmar en el panel de Supabase que el último respaldo es de ayer **(pendiente: plan y retención, PD-32)**.

### Cada mes
- [ ] **Timbres:** compararlos con el límite del paquete (**Facturas**, indicador de timbres) **(pendiente: cuántos incluye la anualidad, PD-26)**.
- [ ] **Dependencias:** `pnpm audit --prod` sin hallazgos graves (también corre en cada Pull Request).
- [ ] **Limpieza del registro de errores** a los 90 días: `select public.error_log_purge(90)` **(pendiente: programarla, S4-26)**.
- [ ] **Una exportación de los datos** (Configuración → Exportar los datos) guardada en un lugar seguro, como copia legible adicional (no sustituye al respaldo).

### Cada año y en fechas fijas
- [ ] **Certificado de sello digital (CSD) del SAT:** vence y hay que renovarlo con ZAMMIR **(pendiente: fecha de vencimiento al recibirlo, PD-04)**. Una factura con certificado vencido no se timbra.
- [ ] **Anualidad** de Supabase, Vercel, el PAC y el dominio: anotar sus fechas de renovación **(pendiente: al contratarlos)**.
- [ ] **Ensayo de restauración** de un respaldo (E9): al menos una vez al año y después de cambios grandes. Ver [RESTAURACION.md](RESTAURACION.md).

## 3. Desplegar

El detalle está en el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §3. En corto:

1. Todo cambio entra por **rama y Pull Request**; la integración continua corre toda la compuerta de calidad (formato, lint, tipos, dependencias, pruebas, base de datos, integración, extremo a extremo, mutación, escaneo de secretos y del paquete del navegador, auditoría de dependencias). Con algo en rojo **no se fusiona**.
2. Al fusionar a `main`, Vercel despliega a **pruebas**; las migraciones se aplican a la base de pruebas.
3. Se prueba a mano en la tablet sobre pruebas.
4. A **producción** se llega con migraciones aplicadas desde cero la primera vez y, después, solo las nuevas (**solo hacia adelante: una migración ya aplicada nunca se edita**) **(pendiente: producción, PD-10)**.
5. Después de desplegar: `salud` responde, el portal `/factura` abre y una tablet de pruebas entra, cotiza y envía.

**Si un despliegue sale mal:** en Vercel se vuelve a la versión anterior de la aplicación. Una migración **no se deshace**: se corrige con otra migración hacia adelante.

## 4. Restaurar un respaldo

Procedimiento, lista de verificación y registro de ensayos: **[RESTAURACION.md](RESTAURACION.md)**. Siempre en un proyecto **limpio**, nunca encima del de producción. Ya se ensayó en local (`pnpm ensayo:restauracion`); **falta ensayarlo en producción**.

## 5. Rotar claves

Rotar es cambiar una llave por otra nueva, porque se filtró, porque alguien que la conocía ya no trabaja con ustedes o por rutina. **Siempre**: crear la nueva, actualizarla en todos los lugares, comprobar y **solo entonces** revocar la vieja. Los nombres exactos de los menús de Supabase y Vercel pueden cambiar: **verifícalos en el panel antes de tocar nada**.

| Llave | Dónde vive | Qué pasa al cambiarla | Cómo |
|---|---|---|---|
| **Contraseña de un administrador** | Supabase Auth | Solo esa persona vuelve a entrar | La cambia la persona (o se restablece desde Supabase). Si se sospecha de la cuenta, cambiarla y revisar la bitácora |
| **PIN de una persona** | Base (con hash y sal) | Solo esa persona | **Usuarios → Restablecer PIN** |
| **Llave de servicio de Supabase** (`SUPABASE_SERVICE_ROLE_KEY`) | Secretos de las funciones de servidor y del CI | Las funciones dejan de poder escribir hasta actualizar el secreto | Generar la nueva en el panel de Supabase; actualizar los secretos de las funciones y de GitHub Actions; probar `salud` y una factura de prueba; revocar la vieja |
| **Llave pública** (`VITE_SUPABASE_ANON_KEY`) | Variable de Vercel (visible en el navegador, protegida por RLS) | La aplicación deja de conectarse hasta volver a desplegar | Cambiarla en Vercel y volver a desplegar; las tablets la toman al actualizar la aplicación |
| **Secreto JWT del proyecto** | Supabase | **Cierra todas las sesiones y obliga a reconectar cada tablet** con un código nuevo | Solo ante una filtración grave; avisar antes al mostrador |
| **Llaves del proveedor de timbrado** (`PAC_API_KEY`) | Secretos de las funciones | No se puede facturar hasta actualizarla | La emite el PAC; actualizar el secreto y probar con una factura de prueba **(pendiente: PD-05)** |
| **Llave de Turnstile** (`TURNSTILE_SECRET_KEY` y `VITE_TURNSTILE_SITE_KEY`) | Secretos y variable | El portal de autofacturación falla el control contra automatización hasta actualizarlas | Regenerar en Cloudflare, actualizar las dos y volver a desplegar **(pendiente: PD-51)** |
| **Pimienta del portal** (`PORTAL_HASH_PEPPER`) | Secreto de las funciones | Se olvidan los intentos fallidos acumulados (no daña nada) | Cambiarla; no requiere más |
| **Certificado de ZAMMIR (CSD)** | **Solo en el PAC** | No se factura con el vencido | Lo renueva ZAMMIR en el SAT y lo sube **directo al PAC**; nunca pasa por el código ni por Juanito en un archivo |
| **Accesos de producción** (Supabase, Vercel, GitHub, Cloudflare, PAC) | Cada plataforma | — | Ver § 7 |

**Después de cualquier rotación:** `salud` responde, una tablet cotiza y envía, un administrador entra a **Facturas** y se anota fecha y motivo en el registro de accesos (§ 7).

## 6. Atender una solicitud de datos de un cliente

Procedimiento paso a paso en el [manual de soporte](../manuales/MANUAL_DE_SOPORTE.md) §8: registrar la solicitud, comprobar quién es, ubicarlo en **Clientes**, corregir o dar una copia y responder por el mismo canal. Dos cosas que conviene tener claras:

- La **copia de los datos de un solo cliente** hoy se arma a mano desde su ficha **(pendiente: PP-34)**. **No** se entrega la exportación completa del negocio: trae datos de todos.
- Lo contable (ventas, órdenes, pagos y facturas) **no se borra** [RN-18]. Qué datos personales se pueden quitar de un documento contable lo decide el asesor de ZAMMIR **(pendiente)**; no se improvisa.

## 7. Accesos y cómo se entregan

| Acceso | Para qué | Quién lo tiene | Cómo se entrega |
|---|---|---|---|
| **GitHub** (repositorio y Actions) | Código e integración continua | Juanito | Invitación a su cuenta personal con verificación en dos pasos |
| **Supabase** (producción) | Base de datos, cuentas y funciones | Juanito; ZAMMIR como titular del plan | Cuenta de ZAMMIR con Juanito como colaborador (**no** compartir una contraseña) |
| **Vercel** (producción) | Despliegue de la aplicación | Juanito | Igual: colaborador, con dos pasos |
| **Cloudflare** | Dominio y DNS (y Turnstile) | ZAMMIR (titular del dominio) y Juanito | Colaborador; el dominio queda a nombre de ZAMMIR |
| **Proveedor de timbrado (PAC)** | Facturas | ZAMMIR (o Juanito, si él lo contrata, PD-05) | El que fije el contrato **(pendiente)** |
| **Cuentas de administrador del sistema** (Luis, Ricardo) | Administrar el negocio | Cada quien la suya | Las crea Juanito con ellos presentes; la contraseña la elige cada persona |

**Reglas:**
1. Los accesos y las llaves **se entregan por un canal seguro** (un administrador de contraseñas compartido o una invitación nominal de la propia plataforma) y **nunca** por chat, correo en texto ni dentro del repositorio.
2. **Una cuenta por persona**; nada de contraseñas compartidas. Verificación en dos pasos en todo lo que la ofrezca.
3. **Registro de accesos:** una tabla con *quién, a qué, desde cuándo, quién lo concedió*. Al terminar la relación con alguien se revoca el mismo día y se anota. **(Pendiente: crear el registro al entregar los accesos.)**
4. Ningún agente de IA recibe accesos de producción [RNF-19].

## 8. Plan de soporte

Lo que ya está fijado [RNF-20]: atención por **WhatsApp o correo, en horario hábil**; **no** se compromete disponibilidad de 24 horas; las fallas de terceros (internet, nube, SAT, proveedor de timbrado) quedan fuera, pero el sistema sigue capturando sin internet y reintenta.

| Punto | Estado |
|---|---|
| Canales | WhatsApp y correo de HummingX **(pendiente: números y cuentas finales)** |
| Horario hábil | **(pendiente: horas y días exactos del contrato)** |
| Tiempo de primera respuesta y de solución | **(pendiente: lo que fije el contrato; esta guía no inventa plazos)** |
| Qué incluye la anualidad | Soporte, actualizaciones y los costos de plataformas, según el contrato **(pendiente: revisar que esta guía corresponda al contrato firmado, criterio de S5-14)** |
| Qué se cobra aparte | **(pendiente: según el contrato)** |

Al reportar un problema se pide: **sección**, **hora aproximada**, **folio** (si hay) y **qué esperaba ver**. Nunca PIN, contraseñas, llaves ni datos fiscales completos por mensaje.

## 9. Si pasa algo grave

| Qué pasó | Qué hacer |
|---|---|
| **El servicio no responde** (`salud` en 503 o sin respuesta) | Revisar el estado de Supabase y Vercel; el mostrador sigue capturando sin internet. Avisar a ZAMMIR. Si es de la plataforma, esperar y vigilar; si es de la base, ver la restauración |
| **Una factura quedó mal emitida** | **Cancelarla** (solo administradores, con motivo del SAT) y volver a emitirla; nada se borra |
| **El proveedor de timbrado no contesta** | Las facturas quedan *En proceso* y se reintentan; **Reintentar** a mano. Nunca se timbra dos veces |
| **Se perdió o robaron una tablet** | **Usuarios → Tablets → Revocar**. Cambiar los PIN de quienes la usaban. Revisar la bitácora de esa tablet |
| **Se sospecha que alguien vio datos que no debía** | Cambiar las contraseñas y PIN involucrados, revisar la bitácora y `error_log`, rotar las llaves que correspondan (§ 5) y avisar a ZAMMIR. Si hay datos personales expuestos, **consultar al asesor de ZAMMIR sobre la obligación de avisar** **(pendiente)** |
| **Se borró o dañó información** | Restaurar en un proyecto limpio con [RESTAURACION.md](RESTAURACION.md); no tocar producción hasta comprobar la copia |

## 10. Lo que falta para cerrar esta guía

| Falta | Depende de |
|---|---|
| Producción, dominio, variables y despliegue real | PD-10, S4-26, S5-01 |
| Aviso automático de caídas | Cuenta del monitoreo (PP-32) |
| Reintentos de facturas y purga de errores programados | Mantenimiento programado (S4-26) |
| Proveedor de timbrado, certificado y renovaciones | PD-04, PD-05 |
| Respaldos, retención y ensayo en producción | PD-32, S4-27, S5-06 |
| Plan de soporte según el contrato | Contrato con ZAMMIR |
| Registro de accesos y su entrega por canal seguro | La entrega (S5-14) |
| Criterio legal para cancelar datos personales y para avisar de una exposición | Asesor de ZAMMIR |
