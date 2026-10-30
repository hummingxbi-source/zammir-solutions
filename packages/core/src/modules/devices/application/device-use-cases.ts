import type { DeviceId } from '../../../shared-kernel/id';
import { err, type Result } from '../../../shared-kernel/result';
import type { Actor } from '../../identity/domain/auth';
import type { Device, DeviceError, IssuedRegistrationCode } from '../domain/device';
import type { DeviceRepository } from './ports';

export interface DeviceDeps {
  readonly devices: DeviceRepository;
}

function noEsAdministrador(actor: Actor): boolean {
  return actor.role !== 'ADMIN';
}

export function issueRegistrationCode(
  deps: DeviceDeps,
  actor: Actor,
  validityMinutes: number,
): Promise<Result<IssuedRegistrationCode, DeviceError>> {
  if (noEsAdministrador(actor)) {
    return Promise.resolve(err({ code: 'NOT_AUTHORIZED' }));
  }
  if (!Number.isInteger(validityMinutes) || validityMinutes <= 0) {
    return Promise.resolve(err({ code: 'INVALID_INPUT' }));
  }
  return deps.devices.issueCode(validityMinutes);
}

export function listDevices(
  deps: DeviceDeps,
  actor: Actor,
): Promise<Result<readonly Device[], DeviceError>> {
  if (noEsAdministrador(actor)) {
    return Promise.resolve(err({ code: 'NOT_AUTHORIZED' }));
  }
  return deps.devices.list();
}

export function revokeDevice(
  deps: DeviceDeps,
  actor: Actor,
  id: DeviceId,
): Promise<Result<Device, DeviceError>> {
  if (noEsAdministrador(actor)) {
    return Promise.resolve(err({ code: 'NOT_AUTHORIZED' }));
  }
  return deps.devices.revoke(id);
}

/** Canje del código por una tablet. Lo ejecuta el servidor, no una persona con sesión. */
export function redeemRegistrationCode(
  deps: DeviceDeps,
  entrada: { readonly code: string; readonly name: string; readonly authUserId: string },
): Promise<Result<Device, DeviceError>> {
  const code = entrada.code.trim();
  const name = entrada.name.trim();
  if (code === '' || name === '' || entrada.authUserId.trim() === '') {
    return Promise.resolve(err({ code: 'INVALID_INPUT' }));
  }
  return deps.devices.redeemCode({ code, name, authUserId: entrada.authUserId });
}
