import { IMPORT_COLUMNS } from './analyze';

const BOM = String.fromCharCode(0xfeff);

/** Filas de ejemplo con datos inventados: muestran cómo se llena cada tipo de producto. */
const EJEMPLOS: readonly (readonly string[])[] = [
  [
    'EJ-VIDRIO-6',
    'Vidrio claro de 6 mm (ejemplo)',
    'Vidrio claro / flotado',
    'a medida',
    'm²',
    '280.00',
    'no',
    '',
    '',
    '12',
    'no',
    'Vidrio flotado transparente, cortado a la medida',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'EJ-ESPEJO-4',
    'Espejo de 4 mm (ejemplo)',
    'Espejo',
    'a medida',
    'm²',
    '320.00',
    'no',
    '',
    '',
    '',
    'no',
    'Ejemplo con medida máxima: no se cotiza una pieza de más de 1800 × 2600 mm',
    '',
    '',
    '',
    '1800',
    '2600',
    '',
    '',
    '',
  ],
  [
    'EJ-PERFIL',
    'Zoclo de aluminio (ejemplo)',
    'Aluminio y cancelería',
    'a medida',
    'metro lineal',
    '90.00',
    'no',
    '',
    'largo',
    '',
    'no',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'EJ-REPARACION',
    'Reparación de ventana a domicilio (ejemplo)',
    'Servicios',
    'servicio',
    'servicio',
    '350.00',
    'no',
    '',
    '',
    '',
    'si',
    'Cambio de felpa, carretillas o seguro; el precio se fija según el trabajo',
    '',
    '',
    '',
    '',
    '',
    'visita',
    '',
    '',
  ],
];

function celda(texto: string): string {
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Plantilla descargable en CSV UTF-8 con marca BOM (para que Excel respete los acentos), con el
 *  encabezado y cuatro filas de ejemplo que se borran antes de subir el catálogo real. */
export function catalogImportTemplate(): string {
  const filas = [IMPORT_COLUMNS, ...EJEMPLOS];
  return `${BOM}${filas.map((fila) => fila.map(celda).join(',')).join('\r\n')}\r\n`;
}
