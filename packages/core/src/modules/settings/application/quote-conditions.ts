import { err, ok, type Result } from '../../../shared-kernel/result';
import type { SettingsError } from '../domain/business-settings';

/** Cuántas condiciones caben en el documento y cuánto puede medir cada una. */
export const MAX_QUOTE_CONDITIONS = 10;
export const MAX_CONDITION_LENGTH = 300;

export type QuoteConditionsErrorCode =
  'NOT_AUTHORIZED' | 'EMPTY' | 'TOO_MANY' | 'TOO_LONG' | SettingsError['code'];

export interface QuoteConditionsError {
  readonly code: QuoteConditionsErrorCode;
}

/** Puerto: las condiciones que se copian a cada cotización al emitirla [RN-13]. */
export interface QuoteConditionsStore {
  read(): Promise<Result<string, QuoteConditionsError>>;
  write(texto: string): Promise<Result<void, QuoteConditionsError>>;
}

/** Cada línea no vacía es una condición. */
export function conditionLines(texto: string): readonly string[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

/** Guarda las condiciones nuevas. Solo un administrador las cambia; las cotizaciones ya emitidas
 *  conservan el texto que tenían [RN-13]. */
export async function saveQuoteConditions(
  store: QuoteConditionsStore,
  actor: { readonly role: string | null },
  texto: string,
): Promise<Result<string, QuoteConditionsError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const lineas = conditionLines(texto);
  if (lineas.length === 0) {
    return err({ code: 'EMPTY' });
  }
  if (lineas.length > MAX_QUOTE_CONDITIONS) {
    return err({ code: 'TOO_MANY' });
  }
  if (lineas.some((l) => l.length > MAX_CONDITION_LENGTH)) {
    return err({ code: 'TOO_LONG' });
  }
  const normalizado = lineas.join('\n');
  const r = await store.write(normalizado);
  return r.ok ? ok(normalizado) : r;
}

/** Adaptador en memoria, para pruebas. */
export function inMemoryQuoteConditions(inicial: string): QuoteConditionsStore & {
  current(): string;
} {
  let actual = inicial;
  return {
    read: () => Promise.resolve(ok(actual)),
    write: (texto) => {
      actual = texto;
      return Promise.resolve(ok(undefined));
    },
    current: () => actual,
  };
}
