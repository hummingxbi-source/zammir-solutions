import { err, normalizePhone, ok, type Result } from '@zammir/core';

/** Formatos de pantalla y documentos [RN-22]: dinero `$1,234.50`, fecha `27 oct 2026`, teléfono de 10 dígitos. */

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;
const ZONA_NEGOCIO = 'America/Mexico_City';

/** Dinero a partir de centavos enteros; solo se usa aritmética entera [RN-05]. */
export function formatearPesos(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError('Los centavos deben ser un número entero seguro');
  }
  const signo = centavos < 0 ? '-' : '';
  const absolutos = Math.abs(centavos);
  const pesos = Math.floor(absolutos / 100);
  const restantes = String(absolutos % 100).padStart(2, '0');
  const conComas = String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${signo}$${conComas}.${restantes}`;
}

/** Fecha en hora de México, con el mes abreviado en minúsculas [RN-17]. */
export function formatearFecha(instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_NEGOCIO,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(instante);
  const valor = (tipo: string): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? Number.NaN);
  const mes = MESES[valor('month') - 1];
  if (mes === undefined) {
    throw new RangeError('Fecha inválida');
  }
  return `${String(valor('day'))} ${mes} ${String(valor('year'))}`;
}

export type ErrorTelefono = 'TELEFONO_DEBE_TENER_10_DIGITOS';

/** Teléfono de 10 dígitos: quita espacios, guiones y paréntesis (y la clave de país +52) y exige
 *  exactamente 10 dígitos. La regla vive en el núcleo; aquí solo se conserva el nombre de error de la interfaz. */
export function normalizarTelefono(texto: string): Result<string, ErrorTelefono> {
  const telefono = normalizePhone(texto);
  return telefono.ok ? ok(telefono.value) : err('TELEFONO_DEBE_TENER_10_DIGITOS');
}

/** Fecha y hora en hora de México: `30 oct 2026, 13:45` [RN-17]. */
export function formatearFechaHora(instante: Date): string {
  const hora = new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA_NEGOCIO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante);
  return `${formatearFecha(instante)}, ${hora}`;
}
