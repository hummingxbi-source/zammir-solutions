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
  seccionVacia: {
    descripcion: 'Esta sección estará lista pronto.',
  },
} as const;
