import type { DeviceId } from '../../../shared-kernel/id';

export type DeviceStatus = 'ACTIVE' | 'REVOKED';

/** Una tablet registrada [RF-M8-02]. Un dispositivo revocado deja de operar y de enviar. */
export interface Device {
  readonly id: DeviceId;
  readonly name: string;
  /** Serie de folios temporales del dispositivo (1, 2, …) [RN-16]. */
  readonly tempSeries: number;
  readonly status: DeviceStatus;
  readonly createdAt: Date;
  /** Última vez que envió operaciones; `null` si todavía no ha enviado. */
  readonly lastSentAt: Date | null;
  readonly revokedAt: Date | null;
}

/** Código de un solo uso que el administrador entrega para registrar una tablet.
 *  El texto del código solo existe en este momento: después se guarda únicamente su hash. */
export interface IssuedRegistrationCode {
  readonly code: string;
  readonly expiresAt: Date;
}

export type DeviceErrorCode =
  /** Quien lo intenta no es administrador. */
  | 'NOT_AUTHORIZED'
  /** Datos mal escritos: nombre en blanco, código en blanco, vigencia no válida. */
  | 'INVALID_INPUT'
  /** El código no existe, ya se usó o ya venció. No se distingue cuál, para no dar pistas. */
  | 'CODE_INVALID'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICES_UNAVAILABLE';

export interface DeviceError {
  readonly code: DeviceErrorCode;
}
