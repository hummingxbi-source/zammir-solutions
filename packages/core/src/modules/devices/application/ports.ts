import type { DeviceId } from '../../../shared-kernel/id';
import type { Result } from '../../../shared-kernel/result';
import type { Device, DeviceError, IssuedRegistrationCode } from '../domain/device';

export interface RedeemInput {
  readonly code: string;
  readonly name: string;
  /** Identidad que el servidor ya creó para la tablet en Supabase Auth. */
  readonly authUserId: string;
}

/** Puerto: dispositivos y códigos de registro.
 *  Quien lo implementa deja la entrada de bitácora de cada alta y cada baja en el mismo paso
 *  que el cambio, para que no exista uno sin la otra [RN-19]. */
export interface DeviceRepository {
  /** Solo administradores. Guarda únicamente el hash del código. */
  issueCode(validityMinutes: number): Promise<Result<IssuedRegistrationCode, DeviceError>>;
  /** Solo el servidor. Un código sirve una vez y mientras no venza. */
  redeemCode(entrada: RedeemInput): Promise<Result<Device, DeviceError>>;
  /** Solo administradores. */
  list(): Promise<Result<readonly Device[], DeviceError>>;
  /** Solo administradores. Revocar a un dispositivo ya revocado no cambia nada. */
  revoke(id: DeviceId): Promise<Result<Device, DeviceError>>;
}
