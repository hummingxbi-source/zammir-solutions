import { err, ok, type Device, type DeviceError, type DeviceRepository } from '@zammir/core';
import { asId } from '@zammir/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Código de PostgreSQL cuando un rol no tiene permiso (privilegios o la comprobación de la función). */
const SIN_PERMISO = '42501';
const DATOS_NO_VALIDOS = '22023';

interface FilaDeDispositivo {
  readonly id: string;
  readonly name: string;
  readonly temp_series: number;
  readonly status: string;
  readonly created_at: string;
  readonly last_sent_at: string | null;
  readonly revoked_at: string | null;
}

function aDispositivo(fila: FilaDeDispositivo): Device {
  return {
    id: asId<'Device'>(fila.id),
    name: fila.name,
    tempSeries: fila.temp_series,
    status: fila.status === 'REVOKED' ? 'REVOKED' : 'ACTIVE',
    createdAt: new Date(fila.created_at),
    lastSentAt: fila.last_sent_at === null ? null : new Date(fila.last_sent_at),
    revokedAt: fila.revoked_at === null ? null : new Date(fila.revoked_at),
  };
}

function aError(error: { readonly code?: string; readonly message: string }): DeviceError {
  if (error.code === SIN_PERMISO) {
    return { code: 'NOT_AUTHORIZED' };
  }
  if (error.code === DATOS_NO_VALIDOS) {
    return { code: 'INVALID_INPUT' };
  }
  if (error.message === 'CODE_INVALID') {
    return { code: 'CODE_INVALID' };
  }
  if (error.message === 'DEVICE_NOT_FOUND') {
    return { code: 'DEVICE_NOT_FOUND' };
  }
  return { code: 'DEVICES_UNAVAILABLE' };
}

/** Adaptador de DeviceRepository sobre las funciones de la base (S0-16a).
 *  Generar, listar y revocar se usan con la sesión de un administrador; canjear, con la llave de servicio
 *  (desde la función de servidor), porque la tablet aún no tiene identidad. */
export function supabaseDeviceRepository(cliente: SupabaseClient): DeviceRepository {
  return {
    async issueCode(validityMinutes) {
      const respuesta = await cliente.rpc('create_device_registration_code', {
        p_validity_minutes: validityMinutes,
      });
      const { error } = respuesta;
      const data: unknown = respuesta.data;
      if (error !== null) {
        return err(aError(error));
      }
      const fila = (data as { code: string; expires_at: string }[] | null)?.[0];
      if (fila === undefined) {
        return err({ code: 'DEVICES_UNAVAILABLE' });
      }
      return ok({ code: fila.code, expiresAt: new Date(fila.expires_at) });
    },

    async redeemCode({ code, name, authUserId }) {
      const respuesta = await cliente.rpc('redeem_device_registration_code', {
        p_code: code,
        p_name: name,
        p_auth_user_id: authUserId,
      });
      const { error } = respuesta;
      const data: unknown = respuesta.data;
      if (error !== null) {
        return err(aError(error));
      }
      return ok(aDispositivo(data as FilaDeDispositivo));
    },

    async list() {
      const respuesta = await cliente
        .from('devices')
        .select('id, name, temp_series, status, created_at, last_sent_at, revoked_at')
        .order('temp_series');
      const { error } = respuesta;
      const data: unknown = respuesta.data;
      if (error !== null) {
        return err(aError(error));
      }
      return ok((data as FilaDeDispositivo[]).map(aDispositivo));
    },

    async revoke(id) {
      const respuesta = await cliente.rpc('revoke_device', { p_device_id: id });
      const { error } = respuesta;
      const data: unknown = respuesta.data;
      if (error !== null) {
        return err(aError(error));
      }
      return ok(aDispositivo(data as FilaDeDispositivo));
    },
  };
}
