# Autenticación y permisos

> Borrador de Fase 2. Decisión de fondo: [ADR-0013] (aceptada, incluido el PIN sin conexión con verificadores en la tablet). Matriz de permisos: `docs/producto/REQUERIMIENTOS.md`. Valores marcados "configurable" no se fijan en código (PD-21, PD-22).

## 1. Identidades

| Quién | Cómo entra | Dónde vive la identidad | Necesita conexión |
|---|---|---|---|
| Administrador (Luis, Ricardo) | Correo y contraseña | Supabase Auth | Sí, para entrar |
| Dispositivo del mostrador (tablet) | Código de registro de un solo uso, canjeado una vez | Identidad propia en Supabase Auth con rol `device` | Solo al registrarse y al sincronizar |
| Cajero / vendedor | Elige su nombre y teclea su PIN sobre la sesión del dispositivo | Tabla `app_users` + verificador del PIN | **No** (A) |
| Administrador en la tablet | Igual que el cajero (nombre + PIN) | Igual | No (A) |
| Cliente final | Sin cuenta: enlaces con código (P1, autofacturación) | Funciones públicas con código | Sí |

Ningún usuario se comparte entre personas: el reporte "quién cobró qué" depende de eso [DC §4].

## 2. Dos sesiones distintas

- **Sesión del dispositivo:** la tiene la tablet siempre; no es una persona. Permite descargar datos de referencia y enviar operaciones.
- **Usuario activo:** quién está operando ahora (nombre + PIN). Vive en memoria y en el estado de la aplicación, no en Auth. Cada operación que se guarda lleva `userId` y `deviceId` [RN-11].
- **Sesión de administrador (Auth):** solo para lo que requiere servidor: usuarios, dispositivos, bitácora completa, reportes consolidados y facturación. Se usa desde la computadora. Si un administrador la necesita en la tablet, se cambia de sesión de forma explícita; **queda por confirmar** si Luis quiere ver reportes en la tablet (afecta el diseño y se decide en Fase 3).

## 3. Registro de dispositivos (RF-M8-02)

```
Administrador (web, en línea)            Tablet                       Servidor
        │ genera código (un solo uso,     │                               │
        │ vence en pocos minutos)────────►│                               │
        │                                 │ canjea código + nombre ──────►│ Edge Function register-device
        │                                 │                               │ valida, crea devices + usuario Auth rol `device`
        │                                 │◄── sesión del dispositivo ────│
        │                                 │ descarga catálogo, usuarios, verificadores
```

- El código se guarda con hash y se marca usado; no sirve dos veces.
- Revocar: el administrador marca el dispositivo; la función de servidor rechaza sus envíos y la tablet, al conectarse, borra sus datos locales y verificadores.
- Lista de dispositivos: nombre, fecha de alta, último envío, estado.

## 4. PIN

### 4.1 Alta y cambio
- Solo un administrador, en línea, crea o restablece un PIN (RF-M8-01). Una Edge Function calcula el verificador **en el servidor** y guarda solo el verificador.
- Se rechazan PIN triviales. Longitud 4 a 6 dígitos; para administradores el mínimo propuesto es 6 (configurable).

### 4.2 Verificador (propuesta)
`pin_verifier = PBKDF2-HMAC-SHA256(PIN, sal_por_usuario, iteraciones)`. Las iteraciones se miden en la tablet real para que entrar tarde menos de un segundo. Los parámetros se guardan junto al verificador, así se pueden subir sin romper los viejos. La verificación usa comparación en tiempo constante y vive detrás del puerto `PinHasher`.

### 4.3 Qué hay en la tablet
Por usuario activo: id, nombre, rol, sal, iteraciones y verificador. Nunca el PIN, ni contraseñas de administradores, ni datos de otros dispositivos.

### 4.4 Intentos fallidos
Contador local por usuario; bloqueo creciente tras N fallos (N y tiempos configurables, PD-22). Un administrador puede desbloquear en línea. El contador no es una barrera contra quien extrae los datos de la tablet; ver riesgos.

### 4.5 Bloqueo por inactividad
Tras 5 minutos sin actividad (ajustable) vuelve a la pantalla de usuarios. No cierra la sesión del dispositivo ni pierde lo capturado: una cotización a medias se conserva como borrador del usuario.

### 4.6 Cambio de usuario
Un toque lleva a la pantalla de usuarios; se elige el nombre y se teclea el PIN. La operación en curso no se pierde.

## 5. Autorización de acciones (matriz)

La matriz de permisos vive como **política pura en `packages/core`** (`permissions`), que se usa en dos lados:
- En la tablet, para mostrar u ocultar acciones y pedir PIN de administrador.
- En el servidor, al recibir cada operación: la misma política decide si es válida.

Para acciones que piden un administrador (descuento, cambio de precio, factura por cajero) la operación lleva `authorizedBy`. El servidor verifica que ese usuario sea administrador y esté activo; si no, no la rechaza (es un hecho contable) sino que la marca **por revisar** y la deja en la bitácora [RN-18, RN-19].

## 6. Qué puede hacer cada identidad en la base (RLS)

| Identidad | Lee | Escribe |
|---|---|---|
| Administrador | Todo | Datos administrables; nunca borra lo contable [RN-18] |
| Dispositivo | Solo datos de referencia para tablets (catálogo, reglas de precio, configuración, usuarios activos con verificador) | Nada directo: solo a través de la función que recibe operaciones |
| Anónimo | Nada | Solo funciones públicas con código (P1, autofacturación) |

Las pruebas de RLS por rol son obligatorias (`supabase/tests/`) [principios §4.1].

## 7. Bitácora (RN-19, RF-M8-03)
Se registran: cambio de precio, descuento, cancelación, reapertura de corte, cambio de usuario y de permisos, alta y baja de dispositivos y usuarios, restablecimiento de PIN y autorizaciones de administrador. Cada registro guarda usuario, dispositivo, fecha en UTC, valor anterior y valor nuevo.

## 8. Riesgos y límites
- **Tablet robada con datos extraíbles:** un PIN de 4 a 6 dígitos se puede adivinar sobre una copia de los verificadores. Mitigación: revocar el dispositivo, bitácora y marca "por revisar"; no se elimina [ADR-0013].
- **Reloj de la tablet:** un reloj manipulado afecta las horas de captura; el servidor guarda también su hora de recepción.
- **Un administrador sin PIN en la tablet** no puede autorizar sin conexión.
- **PD-21 y PD-22** sin valor: se construyen configurables.
