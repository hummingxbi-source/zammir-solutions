import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { textos } from '../shared/i18n/textos';

/** ¿Hay internet ahora? Se actualiza cuando el navegador avisa que cambió. */
export function useHayInternet(): boolean {
  const [hay, setHay] = useState(() => navigator.onLine);
  useEffect(() => {
    const encender = (): void => {
      setHay(true);
    };
    const apagar = (): void => {
      setHay(false);
    };
    window.addEventListener('online', encender);
    window.addEventListener('offline', apagar);
    return () => {
      window.removeEventListener('online', encender);
      window.removeEventListener('offline', apagar);
    };
  }, []);
  return hay;
}

/** Franja visible solo cuando no hay internet. Dice que se puede seguir trabajando [RF-UX-06]. */
export function IndicadorDeConexion(): ReactElement | null {
  const hayInternet = useHayInternet();
  if (hayInternet) {
    return null;
  }
  return (
    <p role="status" className="aviso-conexion">
      <strong>{textos.conexion.sinInternet}</strong> {textos.conexion.puedesSeguir}
    </p>
  );
}
