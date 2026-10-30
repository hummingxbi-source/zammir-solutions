import { err, ok, type Result } from '../../../shared-kernel/result';
import type { UserRole } from './auth';

export type PinErrorCode =
  /** No son solo dígitos, o no tiene de 4 a 6. */
  | 'PIN_FORMAT'
  /** Los administradores usan un PIN más largo para autorizar (configurable). */
  | 'PIN_TOO_SHORT_FOR_ADMIN'
  /** Un PIN fácil de adivinar: `0000`, `1234`, `4321`, `1212`… [ADR-0013]. */
  | 'PIN_TRIVIAL';

export interface PinError {
  readonly code: PinErrorCode;
}

export interface PinPolicy {
  /** Mínimo de dígitos del PIN de un administrador (propuesta: 6) [ADR-0013 punto 4]. */
  readonly adminMinDigits: number;
}

const MIN_DIGITOS = 4;
const MAX_DIGITOS = 6;

/** Verificador guardado en lugar del PIN: PBKDF2 con sal propia. Todo en texto base64. */
export interface PinVerifier {
  readonly salt: string;
  readonly iterations: number;
  readonly hash: string;
  readonly version: number;
}

function digitos(pin: string): number[] {
  return Array.from({ length: pin.length }, (_, i) => Number(pin.charAt(i)));
}

/** ¿Cada dígito sube (o baja) exactamente uno respecto al anterior? `1234`, `4321`, `345678`. */
function esSecuencia(pin: string): boolean {
  const d = digitos(pin);
  const paso = (d[1] ?? 0) - (d[0] ?? 0);
  return (
    (paso === 1 || paso === -1) &&
    d.every((digito, i) => i === 0 || digito - (d[i - 1] ?? 0) === paso)
  );
}

/** ¿Es un bloque que se repite? `0000`, `1212`, `123123`. */
function esRepeticion(pin: string): boolean {
  for (let largo = 1; largo <= pin.length / 2; largo += 1) {
    if (pin.length % largo === 0 && pin.slice(0, largo).repeat(pin.length / largo) === pin) {
      return true;
    }
  }
  return false;
}

/** Valida el PIN que se va a asignar. Los triviales se rechazan [ADR-0013]. */
export function validatePin(
  pin: string,
  role: UserRole,
  politica: PinPolicy,
): Result<void, PinError> {
  if (!/^\d+$/.test(pin) || pin.length < MIN_DIGITOS || pin.length > MAX_DIGITOS) {
    return err({ code: 'PIN_FORMAT' });
  }
  if (role === 'ADMIN' && pin.length < politica.adminMinDigits) {
    return err({ code: 'PIN_TOO_SHORT_FOR_ADMIN' });
  }
  if (esSecuencia(pin) || esRepeticion(pin)) {
    return err({ code: 'PIN_TRIVIAL' });
  }
  return ok(undefined);
}
