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
  ],
  [
    'EJ-INSTALACION',
    'Instalación a domicilio (ejemplo)',
    'Servicios',
    'servicio',
    'servicio',
    '350.00',
    'no',
    '',
    '',
    '',
  ],
];

function celda(texto: string): string {
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Plantilla descargable en CSV UTF-8 con marca BOM (para que Excel respete los acentos), con el
 *  encabezado y tres filas de ejemplo que se borran antes de subir el catálogo real. */
export function catalogImportTemplate(): string {
  const filas = [IMPORT_COLUMNS, ...EJEMPLOS];
  return `${BOM}${filas.map((fila) => fila.map(celda).join(',')).join('\r\n')}\r\n`;
}
