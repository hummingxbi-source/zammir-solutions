# ADR-0013: Autenticación por dispositivo y PIN, incluido el PIN sin conexión

- **Estado:** Aceptada el 2026-10-26, incluida la opción A del punto 3 (verificadores del PIN en la tablet) con sus mitigaciones. Los valores de PD-21 y PD-22 siguen abiertos
- **Fecha:** 2026-10-26
- **Decide:** Juanito
- **Detalle en:** `docs/arquitectura/AUTENTICACION.md`

## Contexto

- Administradores entran con correo y contraseña; empleados con PIN de 4 a 6 dígitos sobre una tablet registrada [RF-M8-02, DC §4].
- La tablet debe cotizar y vender **sin internet** [ADR-0003]. Por eso el PIN tiene que poder verificarse sin servidor.
- Descuentos, cambios de precio y facturar piden el PIN de un administrador [matriz de permisos]. Eso también pasa sin conexión.
- Un PIN de 4 a 6 dígitos tiene entre 10 000 y 1 000 000 combinaciones: ningún algoritmo de hash lo protege de un ataque fuera de línea sobre una copia de los datos. Con un hash lento aguantaría de minutos a horas con equipo común; es una estimación mía, no una medición.

## Decisión

### 1. Administradores
Supabase Auth con correo y contraseña. Cierre de sesión por inactividad (valor configurable, PD-21). Las funciones de servidor (usuarios, dispositivos, reportes consolidados, facturación) piden esta sesión y conexión.

### 2. Dispositivos
- Un administrador, con sesión y en línea, genera un **código de registro** de un solo uso y vida corta.
- La tablet lo canjea en una Edge Function, que crea el **dispositivo** y una identidad de Supabase Auth propia de ese dispositivo, con rol `device`.
- Revocar un dispositivo (RF-M8-02) lo deshabilita en Auth y en la tabla `devices`. Sus envíos posteriores se rechazan.
- El dispositivo no lee ni escribe tablas directamente: solo recibe datos de referencia y envía operaciones por funciones del servidor [ADR-0012].

### 3. PIN sin conexión — **a decidir**

| | A. Verificadores en la tablet (recomendada) | B. Todo PIN se valida en el servidor |
|---|---|---|
| Entrar y cambiar de usuario sin internet | Sí | No |
| Autorizar descuento o precio con PIN de administrador sin internet | Sí | No |
| Si roban la tablet | Un atacante que saque los datos puede adivinar PIN y hacerse pasar por ese usuario en esa tablet, hasta que se revoque | La tablet robada no sirve sin conexión para nada |
| Encaja con "funciona sin internet" [ADR-0003] | Sí | No: contradice el corazón del sistema |

**Recomiendo A, con estas mitigaciones (se pueden combinar, ninguna es total):**
1. Se guarda solo un verificador del PIN (PBKDF2-HMAC-SHA256 con sal propia e iteraciones altas, medido en la tablet real); nunca el PIN.
2. Se eligen el usuario y luego se teclea el PIN: el PIN no necesita ser único, pero se rechazan los triviales (`0000`, `1234`, repetidos).
3. Contador local de intentos fallidos con bloqueo creciente (valores configurables, PD-22).
4. Los administradores usan **6 dígitos** como mínimo para autorizar (configurable); es una propuesta mía, no viene del documento de construcción.
5. Toda autorización guarda quién autorizó, en qué dispositivo y a qué hora [RN-19]. El servidor, al recibir la operación, verifica que ese usuario esté activo y tenga permiso; si no, la marca "por revisar" (los hechos contables no se rechazan ni se borran [RN-18]).
6. Desactivar un usuario o revocar un dispositivo corta el acceso en la siguiente conexión y borra los verificadores locales.
7. La tablet no sale del local ni guarda más datos de los necesarios.

**Riesgo que se acepta con A:** una tablet robada y sin conexión puede ser atacada hasta que se revoque. Se mitiga con revocación y bitácora, no se elimina.

### 4. Bloqueo e inactividad
Bloqueo automático tras 5 minutos sin actividad (ajustable). Bloquear regresa a la pantalla de usuarios sin cerrar la sesión del dispositivo.

## Alternativas descartadas
- **PIN único para toda la tablet:** rompe "nunca se comparte un usuario" [DC §4].
- **Usuarios de Supabase Auth para cada empleado, con contraseña corta:** Auth no está pensado para PIN sin conexión.

## Consecuencias
- `PinHasher` es un puerto; la verificación vive en el dominio/aplicación y se prueba con contratos.
- Las funciones de servidor re-verifican rol, estado del usuario y estado del dispositivo en cada envío.
- Hace falta una pantalla de conexión para canjear códigos de registro.
