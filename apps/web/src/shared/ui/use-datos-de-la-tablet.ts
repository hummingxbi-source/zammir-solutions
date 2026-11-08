import { useEffect, useState } from 'react';

/** Cada cuánto se vuelve a mirar la copia guardada en la tablet mientras todavía no está lista. */
export const REINTENTO_DE_LA_TABLET_MS = 3_000;

/** Reúne lo que una pantalla necesita de la tablet (catálogo, personas y configuración guardados). Mientras la tablet
 *  no está lista (`null`: la primera vez baja sus datos al conectarse) vuelve a intentar sola cada pocos segundos y
 *  cuando regresa la conexión, así la persona no tiene que reabrir la aplicación. Ya lista, refresca al volver la
 *  conexión. `undefined` solo mientras hace el primer intento. */
export function useDatosDeLaTablet<T>(
  preparar: () => Promise<T | null>,
  cadaMs: number = REINTENTO_DE_LA_TABLET_MS,
): T | null | undefined {
  const [datos, setDatos] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const intentar = async (): Promise<void> => {
      let resultado: T | null;
      try {
        resultado = await preparar();
      } catch {
        resultado = null;
      }
      if (!vivo) {
        return;
      }
      setDatos(resultado);
      if (resultado === null) {
        temporizador = setTimeout(() => {
          void intentar();
        }, cadaMs);
      }
    };
    const alVolverLaRed = (): void => {
      clearTimeout(temporizador);
      void intentar();
    };

    window.addEventListener('online', alVolverLaRed);
    void intentar();
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      window.removeEventListener('online', alVolverLaRed);
    };
  }, [preparar, cadaMs]);

  return datos;
}
