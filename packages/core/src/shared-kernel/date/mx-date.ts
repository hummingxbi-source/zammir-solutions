const ZONA_DE_NEGOCIO = 'America/Mexico_City';

/** Fecha calendario (`2026-10-30`) de un instante en hora de México [RN-17]. Días, vigencias y años de
 *  folio se cuentan con esta fecha, no con la de UTC. */
export function mexicoDate(instante: Date): string {
  // El formato "en-CA" entrega año-mes-día.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_DE_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/** Suma días naturales a una fecha calendario `AAAA-MM-DD` (aritmética de calendario, sin horas). */
export function addDays(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const base = Date.UTC(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1) + dias * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}
