import { useCallback, useState } from 'react';

const CLAVE = 'zammir-barra-oculta';

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

/** Si la persona ocultó la barra de navegación para que la sección ocupe toda la pantalla. Se recuerda en
 *  esta tablet; si el navegador no deja guardarlo, solo dura mientras la aplicación está abierta. */
export function useBarraOculta(): { readonly oculta: boolean; readonly alternar: () => void } {
  const [oculta, setOculta] = useState<boolean>(leer);
  const alternar = useCallback(() => {
    setOculta((actual) => {
      const nueva = !actual;
      try {
        localStorage.setItem(CLAVE, nueva ? '1' : '0');
      } catch {
        // Sin almacenamiento: el cambio vale solo por ahora.
      }
      return nueva;
    });
  }, []);
  return { oculta, alternar };
}
