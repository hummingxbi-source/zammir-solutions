import type { UserId } from '../../../shared-kernel/id';
import type { Result } from '../../../shared-kernel/result';
import type { PinVerifier } from '../domain/pin';
import type { AppUser, UserError } from '../domain/user';

/** Puerto: guardar y comparar PIN sin guardar nunca el PIN [ADR-0013]. La comparación es en tiempo
 *  constante. El núcleo no toca `crypto`: el adaptador real usa WebCrypto (PBKDF2-HMAC-SHA256). */
export interface PinHasher {
  /** Genera un verificador con sal propia y `iterations` vueltas. */
  hash(pin: string, iterations: number): Promise<PinVerifier>;
  verify(pin: string, verifier: PinVerifier): Promise<boolean>;
}

/** Puerto: usuarios del mostrador. Nada se borra: se desactivan [RN-18]. Quien lo implementa deja la
 *  entrada de bitácora de cada cambio en el mismo paso que el cambio [RN-19]:
 *  alta, cambio de nombre o rol, activar o desactivar y restablecer el PIN. */
export interface UserRepository {
  create(usuario: AppUser): Promise<Result<AppUser, UserError>>;
  update(usuario: AppUser): Promise<Result<AppUser, UserError>>;
  get(id: UserId): Promise<Result<AppUser, UserError>>;
  list(): Promise<Result<readonly AppUser[], UserError>>;
}
