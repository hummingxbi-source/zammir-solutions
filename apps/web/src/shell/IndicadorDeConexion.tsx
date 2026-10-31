import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { isStale, type SyncEngine } from '@zammir/core';

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

export interface SincronizacionVisible {
  readonly engine: SyncEngine;
  /** Horas sin enviar antes de avisar; `null` mientras la configuración no se haya bajado. */
  readonly staleHours: number | null;
  /** Hora actual, para comparar con la antigüedad de lo pendiente (llega por prop para probarlo). */
  readonly ahora: () => Date;
}

const SIN_MOTOR = {
  subscribe: (): (() => void) => () => undefined,
  status: () => null,
};

/** Franja de estado siempre visible cuando importa [RF-UX-06]: sin internet (se puede seguir
 *  trabajando), cuántos documentos faltan por enviar, aviso si llevan mucho sin salir y aviso de
 *  soporte si un documento tiene problemas. Con internet y sin pendientes no muestra nada. */
export function IndicadorDeConexion({
  sincronizacion,
}: {
  readonly sincronizacion?: SincronizacionVisible | undefined;
}): ReactElement | null {
  const hayInternet = useHayInternet();
  const fuente = sincronizacion?.engine;
  const estado = useSyncExternalStore(
    fuente === undefined ? SIN_MOTOR.subscribe : (aviso) => fuente.subscribe(aviso),
    fuente === undefined ? SIN_MOTOR.status : () => fuente.status(),
  );

  const pendientes = estado?.pending ?? 0;
  const detenida = estado?.state === 'STOPPED';
  const horasLimite = sincronizacion?.staleHours ?? null;
  const atrasada =
    sincronizacion !== undefined &&
    horasLimite !== null &&
    estado !== null &&
    isStale(estado.oldestPendingSince, sincronizacion.ahora(), horasLimite);

  if (hayInternet && pendientes === 0 && !detenida) {
    return null;
  }

  return (
    <div role="status" className="aviso-conexion">
      {!hayInternet ? (
        <p>
          <strong>{textos.conexion.sinInternet}</strong> {textos.conexion.puedesSeguir}
        </p>
      ) : null}
      {pendientes > 0 ? (
        <p>
          <strong>{textos.sincronizacion.pendientes(pendientes)}</strong>{' '}
          {!hayInternet ? textos.sincronizacion.sinInternetPendientes(pendientes) : null}
        </p>
      ) : null}
      {atrasada ? <p>{textos.sincronizacion.sinEnviarDesde(horasLimite)}</p> : null}
      {detenida ? <p>{textos.sincronizacion.problema}</p> : null}
    </div>
  );
}
