/** Todos los textos de la interfaz, en español de México y con el vocabulario del oficio.
 *  Ningún componente escribe un texto suelto: lo toma de aquí, para que la prueba de
 *  vocabulario pueda recorrerlos todos [00-principios §3.10, docs/producto/GLOSARIO.md]. */
export const textos = {
  app: {
    nombre: 'ZAMMIR',
  },
  navegacion: {
    irAlInicio: 'ZAMMIR, ir al panel de inicio',
    principal: 'Secciones del trabajo',
    secundaria: 'Otras secciones',
    mas: 'Más',
    yaVisitada: 'ya visitada',
    secciones: {
      catalogo: 'Catálogo',
      cotizador: 'Cotizador',
      ordenes: 'Órdenes de trabajo',
      mostrador: 'Mostrador',
      reportes: 'Reportes',
      clientes: 'Clientes',
      cuentasPorCobrar: 'Cuentas por cobrar',
      usuarios: 'Usuarios',
      configuracion: 'Configuración',
    },
  },
  inicio: {
    titulo: 'Panel de inicio',
    descripcion: 'Elige por dónde quieres empezar.',
  },
  entrada: {
    titulo: 'Entrar',
    soloAdministradores:
      'Esta sección es solo para administradores. Entra con tu correo y contraseña.',
    correo: 'Correo',
    contrasena: 'Contraseña',
    boton: 'Entrar',
    entrando: 'Entrando…',
    salir: 'Salir',
    cargando: 'Cargando…',
    sinPermiso: {
      mensaje: 'Tu cuenta no tiene permiso para ver esta sección.',
      queHacer: 'Pide a un administrador que lo haga, o sal para entrar con otra cuenta.',
    },
    errores: {
      INVALID_INPUT: {
        mensaje: 'Revisa tu correo y tu contraseña.',
        queHacer: 'Escribe un correo válido y tu contraseña.',
      },
      INVALID_CREDENTIALS: {
        mensaje: 'El correo o la contraseña no son correctos.',
        queHacer: 'Revísalos e intenta de nuevo.',
      },
      NOT_AN_ADMIN: {
        mensaje: 'Esta cuenta no es de administrador.',
        queHacer: 'Entra con una cuenta de administrador o pide ayuda a un administrador.',
      },
      NETWORK_UNAVAILABLE: {
        mensaje: 'No hay conexión con el servidor.',
        queHacer: 'Conéctate a internet e intenta de nuevo.',
      },
    },
  },
  dispositivos: {
    titulo: 'Tablets',
    descripcion: 'Registra las tablets de ZAMMIR y quita el acceso a las que ya no se usen.',
    cargando: 'Cargando tablets…',
    sinTablets: 'Todavía no hay tablets registradas. Genera un código para registrar la primera.',
    registrar: {
      titulo: 'Registrar una tablet',
      vigencia: 'Minutos que sirve el código',
      ayudaVigencia: 'Pasado ese tiempo el código ya no sirve y habrá que generar otro.',
      generar: 'Generar código',
      generando: 'Generando…',
      codigoGenerado: 'Código para la tablet',
      instruccion: 'Escríbelo en la tablet. Sirve una sola vez.',
      venceA: 'Vence a las',
    },
    columnas: {
      nombre: 'Nombre',
      alta: 'Registrada',
      ultimoEnvio: 'Último envío',
      estado: 'Estado',
      acciones: 'Acciones',
    },
    estados: { ACTIVE: 'Activa', REVOKED: 'Revocada' },
    sinEnvios: 'Aún no ha enviado',
    revocar: 'Revocar',
    confirmarRevocar: {
      titulo: 'Revocar tablet',
      mensaje: 'Esta tablet dejará de poder trabajar. El registro se conserva. ¿Quieres revocarla?',
      confirmar: 'Sí, revocar',
      cancelar: 'No, dejarla',
    },
    errores: {
      NOT_AUTHORIZED: {
        mensaje: 'Tu cuenta no puede administrar tablets.',
        queHacer: 'Entra con una cuenta de administrador.',
      },
      INVALID_INPUT: {
        mensaje: 'Los minutos no son válidos.',
        queHacer: 'Escribe un número entero mayor que cero.',
      },
      CODE_INVALID: {
        mensaje: 'El código no sirve.',
        queHacer: 'Genera uno nuevo.',
      },
      DEVICE_NOT_FOUND: {
        mensaje: 'Esa tablet ya no aparece.',
        queHacer: 'Actualiza la lista.',
      },
      DEVICES_UNAVAILABLE: {
        mensaje: 'No hay conexión con el servidor.',
        queHacer: 'Conéctate a internet e intenta de nuevo.',
      },
    },
  },
  conexion: {
    sinInternet: 'Sin internet.',
    puedesSeguir: 'Sigues trabajando: lo que captures queda guardado en la tablet.',
  },
  seccionVacia: {
    descripcion: 'Esta sección estará lista pronto.',
  },
} as const;
