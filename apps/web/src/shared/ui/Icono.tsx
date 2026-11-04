import type { ReactElement } from 'react';

/** Íconos de línea del oficio: un solo juego, trazo de 1.75 y puntas redondeadas, en una cuadrícula de 24.
 *  Son decorativos (el texto siempre va al lado), por eso se ocultan a los lectores de pantalla. */
const TRAZOS = {
  inicio: 'M4 11l8-7 8 7 M6 10v10h12V10 M10 20v-6h4v6',
  catalogo: 'M21 8l-9-5-9 5v8l9 5 9-5V8z M3 8l9 5 9-5 M12 13v8',
  cotizador: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  ordenes: 'M4 5h16v14H4z M4 10h16 M10 10v9',
  mostrador: 'M3 6h18v12H3z M3 10h18 M7 15h3',
  reportes: 'M5 20V11 M12 20V4 M19 20v-7',
  clientes: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c0-4 3.6-7 8-7s8 3 8 7',
  cuentas: 'M12 3v18 M16.5 7.5H10a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H7.5',
  usuarios:
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6 M16 4.6a3.5 3.5 0 010 6.4 M18 14.2c2 .7 3.5 2.4 3.5 5.8',
  configuracion: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4',
  imprimir: 'M7 8V3h10v5 M7 17H4v-7h16v7h-3 M7 14h10v7H7z',
  whatsapp:
    'M4 20l1.4-4.2A8 8 0 1112 20a8 8 0 01-3.8-1 M9 9c0 3 3 6 6 6l1-2-2-1-1 1c-1-.4-2-1.4-2.4-2.4l1-1-1-2z',
  ayuda:
    'M12 21a9 9 0 100-18 9 9 0 000 18z M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.5 M12 17.2v.1',
  cerrar: 'M6 6l12 12 M18 6L6 18',
  verificar: 'M5 12.5l4.5 4.5L19 7.5',
  flechaArriba: 'M12 19V5 M6 11l6-6 6 6',
  flechaAbajo: 'M12 5v14 M6 13l6 6 6-6',
  igual: 'M5 9h14 M5 15h14',
  nube: 'M7 18a4.5 4.5 0 01-.5-9A6 6 0 0118 10.5 3.75 3.75 0 0117.5 18H7z',
  sinConexion:
    'M3 3l18 18 M7 18a4.5 4.5 0 01-.5-9 6 6 0 012-2.8 M17.5 18a3.75 3.75 0 00.5-7.5 6 6 0 00-4.3-4.3',
  advertencia: 'M12 4l9.5 16.5h-19L12 4z M12 10v4.5 M12 17.2v.1',
  informacion: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 11v5 M12 7.8v.1',
  vacio: 'M4 8l8-4 8 4v9l-8 4-8-4V8z M4 8l8 4 8-4 M12 12v9',
} as const;

export type NombreDeIcono = keyof typeof TRAZOS;

export interface IconoProps {
  readonly nombre: NombreDeIcono;
  /** Lado en píxeles (20 por omisión). */
  readonly tamano?: number;
}

export function Icono({ nombre, tamano = 20 }: IconoProps): ReactElement {
  return (
    <svg
      className="icono"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}

/** Ícono de cada sección de la navegación; las que no tienen uno propio usan el de inicio. */
export function iconoDeSeccion(id: string): NombreDeIcono {
  switch (id) {
    case 'catalogo':
    case 'cotizador':
    case 'ordenes':
    case 'mostrador':
    case 'reportes':
    case 'clientes':
    case 'usuarios':
    case 'configuracion':
      return id;
    case 'cuentas-por-cobrar':
      return 'cuentas';
    default:
      return 'inicio';
  }
}
