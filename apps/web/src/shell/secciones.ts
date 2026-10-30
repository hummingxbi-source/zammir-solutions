import { textos } from '../shared/i18n/textos';

/** Interruptores de lo que el cliente puede activar (P1: portal de seguimiento, P2: existencias).
 *  Apagados por defecto: sus secciones no aparecen en la navegación [docs/producto/ALCANCE.md §3]. */
export type Interruptor = 'P1' | 'P2';

export type GrupoSeccion = 'principal' | 'secundaria';

export interface Seccion {
  readonly id: string;
  readonly ruta: string;
  readonly texto: string;
  readonly grupo: GrupoSeccion;
  /** Si existe, la sección solo se muestra con ese interruptor encendido. */
  readonly interruptor?: Interruptor;
  /** Solo la ven los administradores con sesión (matriz de permisos). */
  readonly soloAdministrador?: boolean;
}

const s = textos.navegacion.secciones;

/** Navegación en el orden real del trabajo [RF-UX-01]:
 *  Catálogo → Cotizador → Órdenes de trabajo → Mostrador → Reportes.
 *  Clientes, cuentas por cobrar, usuarios y configuración van en un menú secundario. */
export const SECCIONES: readonly Seccion[] = [
  { id: 'catalogo', ruta: '/catalogo', texto: s.catalogo, grupo: 'principal' },
  { id: 'cotizador', ruta: '/cotizador', texto: s.cotizador, grupo: 'principal' },
  { id: 'ordenes', ruta: '/ordenes', texto: s.ordenes, grupo: 'principal' },
  { id: 'mostrador', ruta: '/mostrador', texto: s.mostrador, grupo: 'principal' },
  {
    id: 'reportes',
    ruta: '/reportes',
    texto: s.reportes,
    grupo: 'principal',
    soloAdministrador: true,
  },
  { id: 'clientes', ruta: '/clientes', texto: s.clientes, grupo: 'secundaria' },
  {
    id: 'cuentas-por-cobrar',
    ruta: '/cuentas-por-cobrar',
    texto: s.cuentasPorCobrar,
    grupo: 'secundaria',
    soloAdministrador: true,
  },
  {
    id: 'usuarios',
    ruta: '/usuarios',
    texto: s.usuarios,
    grupo: 'secundaria',
    soloAdministrador: true,
  },
  {
    id: 'configuracion',
    ruta: '/configuracion',
    texto: s.configuracion,
    grupo: 'secundaria',
    soloAdministrador: true,
  },
];

/** Secciones de un grupo que se deben mostrar con los interruptores actuales. */
export function seccionesVisibles(
  grupo: GrupoSeccion,
  interruptores: ReadonlySet<Interruptor>,
  secciones: readonly Seccion[] = SECCIONES,
): Seccion[] {
  return secciones.filter(
    (seccion) =>
      seccion.grupo === grupo &&
      (seccion.interruptor === undefined || interruptores.has(seccion.interruptor)),
  );
}
