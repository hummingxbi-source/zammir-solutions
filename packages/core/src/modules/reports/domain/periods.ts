import { addDays, mexicoDate } from '../../../shared-kernel/date/mx-date';

/** Los periodos de todos los reportes: día, semana (lunes a domingo) y mes, siempre en hora de México
 *  [RN-17]. Las fechas son `AAAA-MM-DD` y los extremos van incluidos. */
export type PeriodKind = 'DAY' | 'WEEK' | 'MONTH';

export interface Period {
  readonly kind: PeriodKind;
  readonly start: string;
  readonly end: string;
}

/** Contra qué se compara un periodo en curso (PP-13 por aprobar): el periodo anterior completo (por
 *  omisión) o solo el mismo tramo del anterior (por ejemplo, los primeros 12 días del mes pasado). */
export type ComparisonMode = 'FULL_PERIOD' | 'SAME_SPAN';

function partes(fecha: string): { y: number; m: number; d: number } {
  const [y, m, d] = fecha.split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Lunes = 0 … domingo = 6. */
function diaDeLaSemana(fecha: string): number {
  const { y, m, d } = partes(fecha);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** El periodo de este tipo que contiene a esa fecha. */
export function periodContaining(dia: string, kind: PeriodKind): Period {
  if (kind === 'DAY') {
    return { kind, start: dia, end: dia };
  }
  if (kind === 'WEEK') {
    const inicio = addDays(dia, -diaDeLaSemana(dia));
    return { kind, start: inicio, end: addDays(inicio, 6) };
  }
  const { y, m } = partes(dia);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { kind, start: `${String(y)}-${pad(m)}-01`, end: `${String(y)}-${pad(m)}-${pad(ultimo)}` };
}

/** El periodo de este tipo que contiene a ese instante, con el día de México. */
export function periodOf(instante: Date, kind: PeriodKind): Period {
  return periodContaining(mexicoDate(instante), kind);
}

/** El periodo completo inmediatamente anterior. */
export function previousPeriod(periodo: Period): Period {
  return periodContaining(addDays(periodo.start, -1), periodo.kind);
}

function diasEntre(desde: string, hasta: string): number {
  const a = partes(desde);
  const b = partes(hasta);
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000,
  );
}

/** Con qué se compara el periodo en curso. En `SAME_SPAN` solo cuentan los primeros días del anterior, tantos
 *  como van transcurridos del actual (sin pasarse del anterior). */
export function comparisonPeriod(
  actual: Period,
  hoy: string,
  modo: ComparisonMode = 'FULL_PERIOD',
): Period {
  const anterior = previousPeriod(actual);
  if (modo === 'FULL_PERIOD') {
    return anterior;
  }
  const transcurridos = Math.max(1, diasEntre(actual.start, hoy) + 1);
  const fin = addDays(anterior.start, transcurridos - 1);
  return { ...anterior, end: fin < anterior.end ? fin : anterior.end };
}

/** ¿Este instante cae dentro del periodo, según el día de México? Un instante inválido no cae en ninguno. */
export function inPeriod(instanteIso: string, periodo: Period): boolean {
  const instante = new Date(instanteIso);
  if (Number.isNaN(instante.getTime())) {
    return false;
  }
  const dia = mexicoDate(instante);
  return dia >= periodo.start && dia <= periodo.end;
}
