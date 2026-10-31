import { asId, type DeviceCredentials, type DeviceCredentialsStore } from '@zammir/core';

const CLAVE = 'zammir.credenciales-del-dispositivo';

interface Guardado {
  readonly device: { readonly id: string; readonly name: string; readonly tempSeries: number };
  readonly session: { readonly accessToken: string; readonly refreshToken: string };
  readonly registeredAt: string;
}

/** Credenciales de la tablet guardadas en el propio equipo (almacenamiento local del navegador).
 *  Si el almacenamiento no está disponible o lo guardado está dañado, se comporta como "no registrada". */
export function localCredentialsStore(
  almacenamiento: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): DeviceCredentialsStore {
  return {
    load() {
      try {
        const texto = almacenamiento.getItem(CLAVE);
        if (texto === null) {
          return Promise.resolve(null);
        }
        const datos = JSON.parse(texto) as Guardado;
        return Promise.resolve({
          device: {
            id: asId<'Device'>(datos.device.id),
            name: datos.device.name,
            tempSeries: datos.device.tempSeries,
          },
          session: datos.session,
          registeredAt: new Date(datos.registeredAt),
        });
      } catch {
        return Promise.resolve(null);
      }
    },

    save(credenciales: DeviceCredentials) {
      const guardado: Guardado = {
        device: credenciales.device,
        session: credenciales.session,
        registeredAt: credenciales.registeredAt.toISOString(),
      };
      try {
        almacenamiento.setItem(CLAVE, JSON.stringify(guardado));
      } catch {
        // Sin almacenamiento la tablet quedará como "no registrada" al reabrir; se avisa al usarla.
      }
      return Promise.resolve();
    },

    clear() {
      try {
        almacenamiento.removeItem(CLAVE);
      } catch {
        // Nada que borrar.
      }
      return Promise.resolve();
    },
  };
}
