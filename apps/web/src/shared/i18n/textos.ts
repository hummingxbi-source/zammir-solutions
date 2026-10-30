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
  clientes: {
    titulo: 'Clientes',
    descripcion:
      'Registra a quien te pide una cotización. Solo hacen falta el nombre y el WhatsApp.',
    cargando: 'Cargando clientes…',
    sinClientes:
      'Todavía no hay clientes. Escribe el nombre y el WhatsApp de la persona y toca "Guardar cliente" para registrar al primero.',
    alta: {
      titulo: 'Nuevo cliente',
      nombre: 'Nombre',
      whatsapp: 'WhatsApp o teléfono (10 dígitos)',
      correo: 'Correo (opcional)',
      notas: 'Notas (opcional)',
      fiscalTitulo: 'Datos para factura (opcional)',
      rfc: 'RFC',
      razonSocial: 'Razón social',
      codigoPostalFiscal: 'Código postal fiscal (5 dígitos)',
      guardar: 'Guardar cliente',
      guardando: 'Guardando…',
      listo: 'Cliente guardado.',
    },
    buscar: 'Buscar cliente por nombre, teléfono o correo',
    sinResultados: 'Ningún cliente coincide con la búsqueda.',
    duplicado: {
      aviso: 'Ya hay un cliente con este teléfono:',
      ayuda: 'Puede ser la misma persona. Si no lo es, guarda de todos modos.',
    },
    columnas: { nombre: 'Nombre', whatsapp: 'WhatsApp', correo: 'Correo', acciones: 'Acciones' },
    sinCorreo: 'Sin correo',
    anonimizar: 'Anonimizar',
    confirmarAnonimizar: {
      titulo: 'Anonimizar a',
      mensaje:
        'Se borrarán su nombre, teléfono, correo, notas y datos fiscales. Sus cotizaciones, ventas y facturas se conservan. No se puede deshacer. ¿Quieres anonimizarlo?',
      confirmar: 'Sí, anonimizar',
      cancelar: 'No, dejarlo',
    },
    anonimizado_ok: 'Cliente anonimizado.',
    anonimizado: 'Datos anonimizados',
    errores: {
      NAME_REQUIRED: {
        mensaje: 'Falta el nombre.',
        queHacer: 'Escribe el nombre del cliente.',
      },
      PHONE_INVALID: {
        mensaje: 'El WhatsApp no es válido.',
        queHacer: 'Escribe los 10 dígitos, por ejemplo 55 1234 5678.',
      },
      EMAIL_INVALID: {
        mensaje: 'El correo no es válido.',
        queHacer: 'Revísalo o déjalo vacío.',
      },
      RFC_INVALID: {
        mensaje: 'El RFC no es válido.',
        queHacer: 'Debe tener 12 o 13 caracteres, o déjalo vacío.',
      },
      FISCAL_ZIP_INVALID: {
        mensaje: 'El código postal fiscal no es válido.',
        queHacer: 'Escribe 5 dígitos, o déjalo vacío.',
      },
      NOT_FOUND: {
        mensaje: 'Ese cliente ya no aparece.',
        queHacer: 'Actualiza la lista.',
      },
      NOT_AUTHORIZED: {
        mensaje: 'Tu cuenta no puede guardar clientes.',
        queHacer: 'Entra con una cuenta de administrador.',
      },
      ANONYMIZED: {
        mensaje: 'Este cliente ya se anonimizó y no se puede editar.',
        queHacer: 'Crea un cliente nuevo si vuelve a comprar.',
      },
      CUSTOMERS_UNAVAILABLE: {
        mensaje: 'No hay conexión con el servidor.',
        queHacer: 'Conéctate a internet e intenta de nuevo.',
      },
    },
  },
  usuarios: {
    titulo: 'Personas del mostrador',
    descripcion:
      'Da de alta a quien usa la tablet, asígnale un rol y un PIN, y desactívalo cuando ya no trabaje contigo. Nadie se borra.',
    cargando: 'Cargando personas…',
    sinPersonas: 'Todavía no hay personas registradas. Da de alta a la primera.',
    alta: {
      titulo: 'Dar de alta a una persona',
      nombre: 'Nombre',
      rol: 'Rol',
      pin: 'PIN',
      ayudaPin:
        'De 4 a 6 dígitos. No uses números fáciles como 0000 o 1234. Los administradores usan al menos',
      digitos: 'dígitos',
      guardar: 'Dar de alta',
      guardando: 'Guardando…',
      listo: 'Persona dada de alta.',
    },
    roles: { ADMIN: 'Administrador', STAFF: 'Cajero / vendedor' },
    columnas: { nombre: 'Nombre', rol: 'Rol', estado: 'Estado', acciones: 'Acciones' },
    estados: { activo: 'Activo', inactivo: 'Desactivado' },
    desactivar: 'Desactivar',
    activar: 'Activar',
    restablecerPin: 'Restablecer PIN',
    nuevoPin: 'PIN nuevo',
    guardarPin: 'Guardar PIN',
    pinRestablecido: 'PIN restablecido.',
    cancelar: 'Cancelar',
    confirmarDesactivar: {
      titulo: 'Desactivar a',
      mensaje: 'Ya no podrá entrar a la tablet. Su historial se conserva. ¿Quieres desactivarlo?',
      confirmar: 'Sí, desactivar',
      cancelar: 'No, dejarlo',
    },
    errores: {
      NAME_REQUIRED: {
        mensaje: 'Falta el nombre.',
        queHacer: 'Escribe el nombre de la persona.',
      },
      NAME_TAKEN: {
        mensaje: 'Ya hay alguien con ese nombre.',
        queHacer: 'Agrega un apellido o una inicial para distinguirlos.',
      },
      NOT_FOUND: {
        mensaje: 'Esa persona ya no aparece.',
        queHacer: 'Actualiza la lista.',
      },
      NOT_AUTHORIZED: {
        mensaje: 'Tu cuenta no puede administrar personas.',
        queHacer: 'Entra con una cuenta de administrador.',
      },
      USERS_UNAVAILABLE: {
        mensaje: 'No hay conexión con el servidor.',
        queHacer: 'Conéctate a internet e intenta de nuevo.',
      },
      PIN_FORMAT: {
        mensaje: 'El PIN no es válido.',
        queHacer: 'Escribe de 4 a 6 dígitos, solo números.',
      },
      PIN_TOO_SHORT_FOR_ADMIN: {
        mensaje: 'El PIN de un administrador es más largo.',
        queHacer: 'Escribe 6 dígitos.',
      },
      PIN_TRIVIAL: {
        mensaje: 'Ese PIN es muy fácil de adivinar.',
        queHacer: 'Elige otro que no sea una secuencia ni se repita.',
      },
      PIN_REQUIRED: {
        mensaje: 'Para ser administrador hace falta un PIN nuevo.',
        queHacer: 'Escribe un PIN de 6 dígitos.',
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
