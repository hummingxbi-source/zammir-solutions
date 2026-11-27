import { money, type Money } from '../../../../shared-kernel/money/money';
import { parseMoney } from '../../../../shared-kernel/money/parse-money';

/** Ajustes del cobro que se capturan por producto: redondeo de medidas, mínimos y medida máxima
 *  [RF-M1-14]. `null` es apagado: así quedan mientras ZAMMIR no los capture [RN-02, PD-02]. */
export interface ChargeAdjustments {
  readonly measureStepMm: number | null;
  readonly minAreaMm2: number | null;
  readonly minAmountCents: Money | null;
  readonly maxWidthMm: number | null;
  readonly maxHeightMm: number | null;
}

export type AdjustmentField = keyof ChargeAdjustments;

export const NO_ADJUSTMENTS: ChargeAdjustments = {
  measureStepMm: null,
  minAreaMm2: null,
  minAmountCents: null,
  maxWidthMm: null,
  maxHeightMm: null,
};

/** Qué ajustes admite cada regla. Por pieza y servicio no hay ninguno. Por metro lineal con base en el
 *  largo, el único máximo es el del largo, que se guarda como `maxWidthMm`. */
export function adjustmentFieldsFor(
  ruleId: string,
  basis: 'LENGTH' | 'PERIMETER' | null = null,
): readonly AdjustmentField[] {
  if (ruleId === 'AREA') {
    return ['measureStepMm', 'minAreaMm2', 'minAmountCents', 'maxWidthMm', 'maxHeightMm'];
  }
  if (ruleId === 'LINEAR') {
    return basis === 'LENGTH'
      ? ['measureStepMm', 'minAmountCents', 'maxWidthMm']
      : ['measureStepMm', 'minAmountCents', 'maxWidthMm', 'maxHeightMm'];
  }
  return [];
}

function enteroPositivo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : null;
}

/** Lee los ajustes de los parámetros guardados; lo que falta o no es válido se toma como apagado. */
export function readAdjustments(ruleParams: unknown): ChargeAdjustments {
  if (typeof ruleParams !== 'object' || ruleParams === null) {
    return NO_ADJUSTMENTS;
  }
  const p = ruleParams as Partial<Record<AdjustmentField, unknown>>;
  const minimo = enteroPositivo(p.minAmountCents);
  const centavos = minimo === null ? null : money(minimo);
  return {
    measureStepMm: enteroPositivo(p.measureStepMm),
    minAreaMm2: enteroPositivo(p.minAreaMm2),
    minAmountCents: centavos?.ok === true ? centavos.value : null,
    maxWidthMm: enteroPositivo(p.maxWidthMm),
    maxHeightMm: enteroPositivo(p.maxHeightMm),
  };
}

/** Los parámetros de la regla con sus ajustes: solo los que la regla admite y están encendidos, para no
 *  guardar llaves vacías. `base` trae lo demás de la regla (la base del metro lineal). */
export function paramsWithAdjustments(
  ruleId: string,
  base: Readonly<Record<string, unknown>>,
  ajustes: ChargeAdjustments,
): Record<string, unknown> {
  // Sin base de largo, el metro lineal es por perímetro (la regla exige una de las dos).
  const basis = base.basis === 'LENGTH' ? 'LENGTH' : 'PERIMETER';
  const parametros: Record<string, unknown> = { ...base };
  for (const campo of adjustmentFieldsFor(ruleId, basis)) {
    const valor = ajustes[campo];
    if (valor !== null) {
      parametros[campo] = valor;
    }
  }
  return parametros;
}

// ── Texto capturado (formulario e importación) ──────────────────────────────────────────────────

/** Lo que se escribe en pantalla o en el archivo: milímetros enteros, el área en m² con hasta
 *  3 decimales y el mínimo en pesos. Vacío es apagado. */
export type AdjustmentTexts = Readonly<Record<AdjustmentField, string>>;

export type AdjustmentTextErrorCode =
  | 'MEASURE_STEP_INVALID'
  | 'MIN_AREA_INVALID'
  | 'MIN_AMOUNT_INVALID'
  | 'MAX_WIDTH_INVALID'
  | 'MAX_HEIGHT_INVALID';

const ERROR_POR_CAMPO: Readonly<Record<AdjustmentField, AdjustmentTextErrorCode>> = {
  measureStepMm: 'MEASURE_STEP_INVALID',
  minAreaMm2: 'MIN_AREA_INVALID',
  minAmountCents: 'MIN_AMOUNT_INVALID',
  maxWidthMm: 'MAX_WIDTH_INVALID',
  maxHeightMm: 'MAX_HEIGHT_INVALID',
};

export interface AdjustmentTextError {
  readonly field: AdjustmentField;
  readonly code: AdjustmentTextErrorCode;
}

const MM2_POR_M2 = 1_000_000;

function milimetros(texto: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  return enteroPositivo(Number(texto));
}

/** "0.5" m² → 500 000 mm². Con texto y enteros, sin flotantes. */
function metrosCuadrados(texto: string): number | null {
  const partes = /^(\d+)(?:\.(\d{1,3}))?$/.exec(texto);
  if (partes === null) return null;
  const enteros = Number(partes[1]);
  const decimales = Number((partes[2] ?? '').padEnd(6, '0'));
  return enteroPositivo(enteros * MM2_POR_M2 + decimales);
}

function pesos(texto: string): Money | null {
  const r = parseMoney(texto);
  return r.ok && r.value > 0 ? r.value : null;
}

/** Convierte lo capturado en ajustes. Solo revisa los campos que la regla admite; los demás se apagan. */
export function parseAdjustmentTexts(
  textos: Partial<AdjustmentTexts>,
  campos: readonly AdjustmentField[],
): { readonly adjustments: ChargeAdjustments; readonly errors: readonly AdjustmentTextError[] } {
  const errores: AdjustmentTextError[] = [];
  const leer = <T>(campo: AdjustmentField, convertir: (t: string) => T | null): T | null => {
    const texto = (textos[campo] ?? '').trim();
    if (texto === '' || !campos.includes(campo)) return null;
    const valor = convertir(texto);
    if (valor === null) errores.push({ field: campo, code: ERROR_POR_CAMPO[campo] });
    return valor;
  };
  const adjustments: ChargeAdjustments = {
    measureStepMm: leer('measureStepMm', milimetros),
    minAreaMm2: leer('minAreaMm2', metrosCuadrados),
    minAmountCents: leer('minAmountCents', pesos),
    maxWidthMm: leer('maxWidthMm', milimetros),
    maxHeightMm: leer('maxHeightMm', milimetros),
  };
  return { adjustments, errors: errores };
}

function centavosATexto(centavos: number): string {
  return `${String(Math.floor(centavos / 100))}.${String(centavos % 100).padStart(2, '0')}`;
}

function mm2ATexto(mm2: number): string {
  const decimales = String(mm2 % MM2_POR_M2)
    .padStart(6, '0')
    .replace(/0+$/, '');
  const enteros = String(Math.floor(mm2 / MM2_POR_M2));
  return decimales === '' ? enteros : `${enteros}.${decimales}`;
}

/** Los ajustes guardados como texto para el formulario (el inverso de `parseAdjustmentTexts`). */
export function adjustmentsToTexts(ajustes: ChargeAdjustments): AdjustmentTexts {
  const mm = (v: number | null): string => (v === null ? '' : String(v));
  return {
    measureStepMm: mm(ajustes.measureStepMm),
    minAreaMm2: ajustes.minAreaMm2 === null ? '' : mm2ATexto(ajustes.minAreaMm2),
    minAmountCents: ajustes.minAmountCents === null ? '' : centavosATexto(ajustes.minAmountCents),
    maxWidthMm: mm(ajustes.maxWidthMm),
    maxHeightMm: mm(ajustes.maxHeightMm),
  };
}
