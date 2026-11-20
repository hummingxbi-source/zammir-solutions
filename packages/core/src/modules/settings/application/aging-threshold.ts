import { err, ok, type Result } from '../../../shared-kernel/result';
import type { SettingsError } from '../domain/business-settings';

/** Cota técnica, no regla de negocio: evita capturar un número absurdo por error. El valor lo decide Luis [PD-33]. */
export const MAX_AGING_THRESHOLD_DAYS = 365;

export type AgingThresholdErrorCode = 'NOT_AUTHORIZED' | 'INVALID' | SettingsError['code'];

export interface AgingThresholdError {
  readonly code: AgingThresholdErrorCode;
}

/** Puerto: días a partir de los cuales se resalta una cuenta por cobrar [RF-M6-01, PD-33]. */
export interface AgingThresholdStore {
  read(): Promise<Result<number, AgingThresholdError>>;
  write(dias: number): Promise<Result<void, AgingThresholdError>>;
}

/** Interpreta lo que se escribió: un entero de 1 a 365, sin letras ni decimales. */
export function parseAgingThreshold(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d{1,3}$/.test(limpio)) {
    return null;
  }
  const dias = Number(limpio);
  return dias >= 1 && dias <= MAX_AGING_THRESHOLD_DAYS ? dias : null;
}

/** Guarda el umbral nuevo. Solo un administrador lo cambia. */
export async function saveAgingThreshold(
  store: AgingThresholdStore,
  actor: { readonly role: string | null },
  texto: string,
): Promise<Result<number, AgingThresholdError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const dias = parseAgingThreshold(texto);
  if (dias === null) {
    return err({ code: 'INVALID' });
  }
  const r = await store.write(dias);
  return r.ok ? ok(dias) : r;
}

/** Adaptador en memoria, para pruebas. */
export function inMemoryAgingThreshold(inicial: number): AgingThresholdStore & {
  current(): number;
} {
  let actual = inicial;
  return {
    read: () => Promise.resolve(ok(actual)),
    write: (dias) => {
      actual = dias;
      return Promise.resolve(ok(undefined));
    },
    current: () => actual,
  };
}
