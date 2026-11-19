import type { BusinessIdentity } from '@zammir/core';

type LogoDelNegocio = NonNullable<BusinessIdentity['logo']>;

/** Dónde vive el logo de ZAMMIR (PNG, de la marca vectorial de la aplicación). Es un archivo de la PWA:
 *  se guarda con ella y también se ve sin internet [ADR-0040]. Para cambiarlo basta reemplazar el archivo. */
export const RUTA_DEL_LOGO = '/logo-zammir.png';

let guardado: Promise<LogoDelNegocio | undefined> | null = null;

/** Baja el logo una sola vez y lo recuerda mientras la aplicación está abierta. Si no se puede (sin la
 *  copia guardada y sin internet), devuelve `undefined` y el documento sale sin logo en lugar de fallar. */
export function cargarLogoDeZammir(
  traer: typeof fetch = (...args) => fetch(...args),
): Promise<LogoDelNegocio | undefined> {
  guardado ??= traer(RUTA_DEL_LOGO)
    .then(async (respuesta) => {
      if (!respuesta.ok) {
        return undefined;
      }
      const bytes = new Uint8Array(await respuesta.arrayBuffer());
      return bytes.length === 0 ? undefined : { bytes, format: 'png' as const };
    })
    .catch(() => undefined)
    .then((logo) => {
      if (logo === undefined) {
        // No se recuerda el fallo: el siguiente documento vuelve a intentarlo.
        guardado = null;
      }
      return logo;
    });
  return guardado;
}

/** Los datos del negocio con el logo, si está disponible. */
export async function negocioConLogo(
  negocio: BusinessIdentity,
  traer?: typeof fetch,
): Promise<BusinessIdentity> {
  const logo = await cargarLogoDeZammir(traer);
  return logo === undefined ? negocio : { ...negocio, logo };
}

/** Solo para pruebas: olvida el logo recordado. */
export function olvidarLogoParaPruebas(): void {
  guardado = null;
}
