import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import type { ActiveUserSession } from '@zammir/core';

/** Si esta tablet ya tiene su registro. Se vuelve a revisar al cambiar de pantalla, para que el botón
 *  "Conectar esta tablet" desaparezca en cuanto queda conectada (y vuelva si se olvida el registro).
 *  Sin almacén (aplicación sin servidor) no hay nada que conectar. */
export function useTabletConectada(almacen: { load(): Promise<unknown> } | null): boolean {
  const { pathname } = useLocation();
  const [conectada, setConectada] = useState(false);
  useEffect(() => {
    if (almacen === null) {
      return;
    }
    let vigente = true;
    void almacen.load().then((credenciales) => {
      if (vigente) {
        setConectada(credenciales !== null);
      }
    });
    return () => {
      vigente = false;
    };
  }, [almacen, pathname]);
  return conectada;
}

/** El nombre de quien está usando la tablet, o `null` si nadie ha entrado. */
export function useNombreDeLaPersona(sesion: ActiveUserSession | null): string | null {
  const suscribir = useCallback(
    (aviso: () => void) => (sesion === null ? () => undefined : sesion.subscribe(aviso)),
    [sesion],
  );
  const leer = useCallback((): string | null => {
    if (sesion === null) {
      return null;
    }
    const estado = sesion.state();
    return estado.kind === 'ACTIVE' ? estado.user.name : null;
  }, [sesion]);
  return useSyncExternalStore(suscribir, leer);
}

/** Si alguien ya entró con su PIN en esta tablet. */
export function useHayPersona(sesion: ActiveUserSession | null): boolean {
  const suscribir = useCallback(
    (aviso: () => void) => (sesion === null ? () => undefined : sesion.subscribe(aviso)),
    [sesion],
  );
  const leer = useCallback(() => sesion !== null && sesion.state().kind === 'ACTIVE', [sesion]);
  return useSyncExternalStore(suscribir, leer);
}
