import { asId, err, ok, type DeviceRegistrar, type RegisterTabletError } from '@zammir/core';

interface RespuestaDeRegistro {
  readonly dispositivo: { readonly id: string; readonly nombre: string; readonly serie: number };
  readonly sesion: { readonly access_token: string; readonly refresh_token: string };
}

interface RespuestaDeError {
  readonly error?: string;
}

export interface FunctionDeviceRegistrarOptions {
  /** Dirección de Supabase, sin diagonal final. */
  readonly url: string;
  readonly anonKey: string;
  /** Solo para pruebas. */
  readonly fetchImpl?: typeof fetch;
}

function aError(codigo: string | undefined, estado: number): RegisterTabletError {
  if (codigo === 'CODE_INVALID' || codigo === 'INVALID_INPUT') {
    return { code: codigo };
  }
  return {
    code:
      estado >= 500 || codigo === 'DEVICES_UNAVAILABLE' ? 'DEVICES_UNAVAILABLE' : 'INVALID_INPUT',
  };
}

/** Adaptador de DeviceRegistrar: llama a la función de servidor `registrar-dispositivo`, que canjea el
 *  código, crea la identidad de la tablet y devuelve su sesión. La tablet aún no tiene sesión, por eso
 *  la petición va solo con la llave pública. */
export function functionDeviceRegistrar(opciones: FunctionDeviceRegistrarOptions): DeviceRegistrar {
  const peticion = opciones.fetchImpl ?? fetch;
  return {
    async register({ code, name }) {
      let respuesta: Response;
      try {
        respuesta = await peticion(`${opciones.url}/functions/v1/registrar-dispositivo`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: opciones.anonKey,
            authorization: `Bearer ${opciones.anonKey}`,
          },
          body: JSON.stringify({ codigo: code, nombre: name }),
        });
      } catch {
        return err({ code: 'NETWORK_UNAVAILABLE' });
      }

      let cuerpo: unknown;
      try {
        cuerpo = await respuesta.json();
      } catch {
        return err({ code: 'DEVICES_UNAVAILABLE' });
      }
      if (!respuesta.ok) {
        return err(aError((cuerpo as RespuestaDeError).error, respuesta.status));
      }
      const datos = cuerpo as RespuestaDeRegistro;
      return ok({
        device: {
          id: asId<'Device'>(datos.dispositivo.id),
          name: datos.dispositivo.nombre,
          tempSeries: datos.dispositivo.serie,
        },
        session: {
          accessToken: datos.sesion.access_token,
          refreshToken: datos.sesion.refresh_token,
        },
      });
    },
  };
}
