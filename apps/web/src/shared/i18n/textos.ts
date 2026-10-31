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
  conectar: {
    titulo: 'Conectar esta tablet',
    descripcion:
      'Pídele a un administrador el código de registro (lo genera en Usuarios) y escríbelo aquí. Sirve una sola vez.',
    codigo: 'Código de registro',
    nombre: 'Nombre de esta tablet (por ejemplo, Mostrador)',
    boton: 'Conectar',
    conectando: 'Conectando…',
    listo: 'Listo: esta tablet quedó conectada como',
    irAlInicio: 'Ir al inicio',
    yaConectada: 'Esta tablet ya está conectada como',
    olvidar: 'Olvidar el registro de esta tablet',
    olvidada: 'Se olvidó el registro. Pide un código nuevo para conectarla otra vez.',
    errores: {
      INVALID_INPUT: {
        mensaje: 'Faltan datos.',
        queHacer: 'Escribe el código y un nombre para la tablet.',
      },
      CODE_INVALID: {
        mensaje: 'El código no sirve: no existe, ya se usó o ya venció.',
        queHacer: 'Pide un código nuevo a un administrador.',
      },
      ALREADY_REGISTERED: {
        mensaje: 'Esta tablet ya está conectada.',
        queHacer: 'Si necesitas conectarla otra vez, primero olvida el registro.',
      },
      NETWORK_UNAVAILABLE: {
        mensaje: 'No hay conexión con el servidor.',
        queHacer: 'Conéctate a internet e intenta de nuevo.',
      },
      DEVICES_UNAVAILABLE: {
        mensaje: 'El servidor no pudo conectar la tablet.',
        queHacer: 'Intenta de nuevo en unos minutos.',
      },
    },
  },
  personas: {
    titulo: '¿Quién va a usar la tablet?',
    acceso: 'Entrar con PIN',
    descripcion: 'Toca tu nombre y escribe tu PIN.',
    cargando: 'Cargando personas…',
    sinPersonas: 'Todavía no hay personas dadas de alta para esta tablet.',
    pin: 'PIN',
    teclado: 'Teclado numérico',
    borrar: 'Borrar',
    entrar: 'Entrar',
    verificando: 'Revisando…',
    cambiarDePersona: 'Elegir otra persona',
    activa: 'Está usando la tablet:',
    cambiarDeUsuario: 'Cambiar de usuario',
    bloqueadaPorInactividad: 'La tablet se bloqueó por no usarse. Elige tu nombre para seguir.',
    errores: {
      DEVICE_NOT_READY: {
        mensaje: 'Esta tablet no está conectada o ya no tiene permiso.',
        queHacer: 'Pide a un administrador un código de registro y conéctala.',
      },
      NO_USERS_YET: {
        mensaje: 'Esta tablet todavía no tiene la lista de personas.',
        queHacer: 'Conéctala a internet una vez para que la reciba.',
      },
      AUTH_FAILED: {
        mensaje: 'El PIN no es correcto.',
        queHacer:
          'Revisa el PIN e intenta de nuevo. Si lo olvidaste, pide a un administrador que lo restablezca.',
      },
      LOCKED: {
        mensaje: 'Demasiados intentos con el PIN.',
        queHacer: 'Espera antes de volver a intentar.',
      },
    },
    esperaSegundos: (segundos: number): string =>
      `Intenta de nuevo en ${String(segundos)} segundos.`,
  },
  importar: {
    titulo: 'Importar el catálogo',
    descripcion:
      'Carga muchos productos de una vez desde un archivo. Descarga la plantilla, llénala, guárdala como CSV UTF-8 y súbela.',
    reglaTodoONada:
      'Si una sola fila tiene un error, no se importa nada: corrige el archivo y vuelve a subirlo. Así el catálogo nunca queda a medias.',
    plantilla: 'Descargar plantilla',
    archivo: 'Archivo CSV con tus productos',
    revisando: 'Revisando el archivo…',
    resumen: {
      filas: 'filas',
      conErrores: 'con errores',
      todoBien: 'El archivo está bien. Revisa la lista y confirma para importar.',
      hayErrores: 'Corrige estos errores en el archivo y vuélvelo a subir. No se importó nada.',
    },
    columnas: { fila: 'Fila', producto: 'Producto', problemas: 'Qué corregir' },
    sinNombre: '(sin nombre)',
    filaBien: 'Bien',
    importar: 'Importar',
    importando: 'Importando…',
    productos: 'productos',
    importado: 'Catálogo importado:',
    codificacion:
      'El archivo parece no estar en UTF-8 y los acentos se verían mal. Guárdalo como "CSV UTF-8" y vuelve a subirlo.',
    archivoVacio: 'El archivo está vacío o solo trae el encabezado.',
    faltanColumnas: 'Faltan columnas obligatorias:',
    columnaGeneral: 'La fila',
    columnasNombre: {
      codigo: 'Código',
      nombre: 'Nombre',
      categoria: 'Categoría',
      tipo: 'Tipo',
      unidad: 'Unidad',
      precio: 'Precio',
      exento: 'Exento',
      regla: 'Regla',
      base_metro_lineal: 'Base del metro lineal',
      garantia_meses: 'Garantía (meses)',
    },
    errores: {
      NAME_REQUIRED_IN_ROW: 'Falta el nombre.',
      CATEGORY_UNKNOWN: 'La categoría no existe. Escríbela igual que en el catálogo.',
      KIND_INVALID: 'El tipo debe ser "a medida", "pieza estándar" o "servicio".',
      UNIT_INVALID: 'La unidad debe ser "m²", "metro lineal", "pieza" o "servicio".',
      PRICE_INVALID: 'El precio no es un número válido (por ejemplo 280 o 1,234.50).',
      PRICE_TOO_MANY_DECIMALS: 'El precio solo puede tener dos decimales.',
      PRICE_NEGATIVE: 'El precio no puede ser negativo.',
      EXEMPT_INVALID: 'En "exento" escribe sí o no.',
      CODE_DUPLICATE_IN_FILE: 'Este código ya aparece antes en el archivo.',
      CODE_DUPLICATE_IN_CATALOG: 'Este código ya existe en el catálogo.',
      RULE_UNKNOWN: 'La regla de precio no existe.',
      LINEAR_BASIS_REQUIRED:
        'Un producto por metro lineal necesita la base: "largo" o "perímetro".',
      LINEAR_BASIS_INVALID: 'La base del metro lineal debe ser "largo" o "perímetro".',
      WARRANTY_INVALID: 'La garantía debe ser un número entero de meses mayor que cero.',
      NAME_REQUIRED: 'Falta el nombre.',
      KIND_UNIT_MISMATCH: 'Ese tipo de producto no se cobra con esa unidad.',
      RULE_UNIT_MISMATCH: 'La regla de precio no corresponde a la unidad.',
      RULE_NOT_REGISTERED: 'La regla de precio no existe.',
      RULE_PARAMS_INVALID: 'Los parámetros de la regla de precio no son válidos.',
      FISCAL_INVALID: 'Los datos fiscales de la categoría no son válidos.',
    },
    pantalla: {
      NOT_AUTHORIZED: {
        mensaje: 'Tu cuenta no puede importar el catálogo.',
        queHacer: 'Entra con una cuenta de administrador.',
      },
      CATALOG_UNAVAILABLE: {
        mensaje: 'No hay conexión con el servidor.',
        queHacer: 'Conéctate a internet e intenta de nuevo.',
      },
      CODE_TAKEN: {
        mensaje: 'Un código ya existe; no se importó nada.',
        queHacer: 'Vuelve a subir el archivo para ver cuál es.',
      },
      CATEGORY_NOT_FOUND: {
        mensaje: 'Una categoría ya no existe; no se importó nada.',
        queHacer: 'Vuelve a subir el archivo.',
      },
      NOT_FOUND: {
        mensaje: 'No se encontró algo necesario.',
        queHacer: 'Intenta de nuevo.',
      },
      IMPORT_INVALID: {
        mensaje: 'El archivo tiene errores; no se importó nada.',
        queHacer: 'Corrígelos y vuelve a subirlo.',
      },
    },
  },
  bitacora: {
    titulo: 'Bitácora',
    descripcion:
      'Quién hizo qué, desde qué tablet y cuándo. Solo se consulta: nada se modifica ni se borra.',
    cargando: 'Cargando bitácora…',
    vacia: 'No hay movimientos con esos filtros.',
    filtros: {
      accion: 'Acción',
      todas: 'Todas',
      desde: 'Desde',
      hasta: 'Hasta (incluido)',
      aplicar: 'Buscar',
    },
    columnas: {
      fecha: 'Fecha y hora',
      persona: 'Persona',
      tablet: 'Tablet',
      accion: 'Acción',
      antes: 'Antes',
      despues: 'Después',
      autorizo: 'Autorizó',
    },
    sistema: 'Sistema',
    desconocido: 'Desconocido',
    sinValor: '—',
    cargarMas: 'Cargar más',
    acciones: {
      DEVICE_REGISTERED: 'Registró una tablet',
      DEVICE_REVOKED: 'Revocó una tablet',
      DEVICES_LISTED: 'Consultó la lista de tablets',
      PRODUCT_PRICE_CHANGED: 'Cambió un precio',
      PRODUCT_ACTIVATED: 'Activó un producto',
      PRODUCT_DEACTIVATED: 'Desactivó un producto',
      USER_CREATED: 'Dio de alta a una persona',
      USER_UPDATED: 'Cambió nombre o rol de una persona',
      USER_ACTIVATED: 'Activó a una persona',
      USER_DEACTIVATED: 'Desactivó a una persona',
      USER_PIN_RESET: 'Restableció un PIN',
      CUSTOMER_ANONYMIZED: 'Anonimizó a un cliente',
      LEGAL_DOCUMENT_PUBLISHED: 'Publicó una versión del aviso o de los términos',
    },
    campos: {
      nombre: 'Nombre',
      rol: 'Rol',
      activo: 'Activo',
      estado: 'Estado',
      precio_centavos: 'Precio',
      pin: 'PIN',
      anonimizado: 'Anonimizado',
      tipo: 'Tipo',
      version: 'Versión',
      cuenta: 'Cuenta',
    },
    errores: {
      INVALID_AUDIT_INPUT: {
        mensaje: 'La búsqueda no es válida.',
        queHacer: 'Revisa las fechas.',
      },
      AUDIT_REJECTED: {
        mensaje: 'Tu cuenta no puede ver la bitácora.',
        queHacer: 'Entra con una cuenta de administrador.',
      },
      AUDIT_UNAVAILABLE: {
        mensaje: 'No hay conexión con el servidor.',
        queHacer: 'Conéctate a internet e intenta de nuevo.',
      },
    },
  },
  legal: {
    titulo: 'Aviso de privacidad',
    descripcion:
      'Es el texto que se le informa a cada cliente al registrarlo. Editarlo crea una versión nueva; las anteriores se conservan.',
    cargando: 'Cargando aviso…',
    vigente: 'Versión vigente',
    versionN: 'Versión',
    desde: 'rige desde',
    sinAviso: 'Todavía no hay aviso de privacidad publicado. Escribe el texto y publícalo.',
    borradorAviso: 'Este texto es un borrador y falta que lo revise el asesor de ZAMMIR.',
    nuevaVersion: 'Publicar una versión nueva',
    texto: 'Texto del aviso',
    publicar: 'Publicar versión nueva',
    publicando: 'Publicando…',
    publicado: 'Versión publicada.',
    historial: 'Versiones anteriores',
    errores: {
      BODY_REQUIRED: {
        mensaje: 'Falta el texto del aviso.',
        queHacer: 'Escríbelo antes de publicar.',
      },
      NOT_FOUND: {
        mensaje: 'Todavía no hay aviso publicado.',
        queHacer: 'Publica el primero.',
      },
      NOT_AUTHORIZED: {
        mensaje: 'Tu cuenta no puede editar el aviso de privacidad.',
        queHacer: 'Entra con una cuenta de administrador.',
      },
      LEGAL_UNAVAILABLE: {
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
    avisoVigente: 'Aviso de privacidad que se le informa (versión',
    verAviso: 'Ver el aviso',
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
  sincronizacion: {
    guardadoEnLaTablet: 'Guardado en la tablet',
    enviado: 'Enviado',
    pendientes: (n: number): string => (n === 1 ? '1 pendiente' : `${String(n)} pendientes`),
    sinInternetPendientes: (n: number): string =>
      `Hay ${String(n)} ${n === 1 ? 'documento' : 'documentos'} por enviar. Se enviarán solos al volver el internet.`,
    sinEnviarDesde: (horas: number): string =>
      `Hay documentos sin enviar desde hace ${String(horas)} ${horas === 1 ? 'hora' : 'horas'}. Conéctate a internet.`,
    problema: 'Hay un problema con un documento. Avisa a soporte.',
    necesitaInternet: 'Para hacer esto necesitas internet.',
  },
  seccionVacia: {
    descripcion: 'Esta sección estará lista pronto.',
  },
} as const;
