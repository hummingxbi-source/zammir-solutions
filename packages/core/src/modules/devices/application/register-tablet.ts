import type { Clock } from '../../../shared-kernel/clock';
import type { DeviceId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';

/** Sesión que el servidor le da a la tablet al registrarla; es la identidad del dispositivo. */
export interface DeviceSession {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface RegisteredDevice {
  readonly id: DeviceId;
  readonly name: string;
  /** Serie de folios temporales de esta tablet (T1, T2…) [RN-16]. */
  readonly tempSeries: number;
}

/** Lo que la tablet guarda de sí misma después de registrarse. */
export interface DeviceCredentials {
  readonly device: RegisteredDevice;
  readonly session: DeviceSession;
  readonly registeredAt: Date;
}

export type RegisterTabletErrorCode =
  /** Falta el código o el nombre. */
  | 'INVALID_INPUT'
  /** El código no existe, ya se usó o ya venció. */
  | 'CODE_INVALID'
  /** Esta tablet ya está registrada: para registrarla de nuevo, primero hay que olvidar el registro. */
  | 'ALREADY_REGISTERED'
  /** No hubo conexión con el servidor. */
  | 'NETWORK_UNAVAILABLE'
  /** El servidor no pudo completar el registro. */
  | 'DEVICES_UNAVAILABLE';

export interface RegisterTabletError {
  readonly code: RegisterTabletErrorCode;
}

/** Puerto: pide al servidor registrar esta tablet con un código de un solo uso [RF-M8-02, ADR-0013]. */
export interface DeviceRegistrar {
  register(entrada: {
    readonly code: string;
    readonly name: string;
  }): Promise<
    Result<
      { readonly device: RegisteredDevice; readonly session: DeviceSession },
      RegisterTabletError
    >
  >;
}

/** Puerto: dónde la tablet guarda sus credenciales (en el propio equipo). */
export interface DeviceCredentialsStore {
  load(): Promise<DeviceCredentials | null>;
  save(credenciales: DeviceCredentials): Promise<void>;
  /** Olvida el registro (por ejemplo, cuando el administrador revocó la tablet). */
  clear(): Promise<void>;
}

export interface RegisterTabletDeps {
  readonly registrar: DeviceRegistrar;
  readonly store: DeviceCredentialsStore;
  readonly clock: Clock;
}

/** El código se teclea a mano: se ignoran espacios y guiones y no importan las mayúsculas. */
export function normalizeRegistrationCode(texto: string): string {
  return texto.replace(/[\s-]/g, '').toUpperCase();
}

/** Registra esta tablet con el código que le dio un administrador y guarda sus credenciales.
 *  Una tablet ya registrada no se vuelve a registrar sin olvidar primero el registro anterior. */
export async function registerTablet(
  deps: RegisterTabletDeps,
  entrada: { readonly code: string; readonly name: string },
): Promise<Result<DeviceCredentials, RegisterTabletError>> {
  const code = normalizeRegistrationCode(entrada.code);
  const name = entrada.name.trim();
  if (code === '' || name === '') {
    return err({ code: 'INVALID_INPUT' });
  }
  if ((await deps.store.load()) !== null) {
    return err({ code: 'ALREADY_REGISTERED' });
  }
  const registrada = await deps.registrar.register({ code, name });
  if (!registrada.ok) {
    return registrada;
  }
  const credenciales: DeviceCredentials = {
    device: registrada.value.device,
    session: registrada.value.session,
    registeredAt: deps.clock.now(),
  };
  await deps.store.save(credenciales);
  return ok(credenciales);
}
