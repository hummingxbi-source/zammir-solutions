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
  seccionVacia: {
    descripcion: 'Esta sección estará lista pronto.',
  },
} as const;
