import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { ActiveUserSession } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Boton } from '../../../shared/ui/Boton';

/** Cada cuánto se revisa si ya pasó el tiempo sin actividad. */
const REVISION_MS = 5_000;

/** Muestra quién está usando la tablet y permite cambiar de usuario. También vigila la actividad:
 *  cada toque o tecla renueva el tiempo y, pasado el límite, la tablet vuelve a la pantalla de
 *  personas sin cerrar la sesión del dispositivo [RF-M4-08]. */
export function PersonaActiva({
  session,
}: {
  readonly session: ActiveUserSession;
}): ReactElement | null {
  const suscribir = useCallback((aviso: () => void) => session.subscribe(aviso), [session]);
  const leer = useCallback(() => session.state(), [session]);
  const estado = useSyncExternalStore(suscribir, leer);
  const navegar = useNavigate();

  useEffect(() => {
    const tocar = (): void => {
      session.touch();
    };
    window.addEventListener('pointerdown', tocar);
    window.addEventListener('keydown', tocar);
    const reloj = window.setInterval(() => {
      session.check();
    }, REVISION_MS);
    return () => {
      window.removeEventListener('pointerdown', tocar);
      window.removeEventListener('keydown', tocar);
      window.clearInterval(reloj);
    };
  }, [session]);

  // Solo al pasar de activa a bloqueada (cambiar de usuario o inactividad), no al abrir la aplicación.
  const bloqueada = estado.kind === 'LOCKED';
  const estabaActiva = useRef(false);
  useEffect(() => {
    if (bloqueada && estabaActiva.current) {
      void navegar('/entrar');
    }
    estabaActiva.current = !bloqueada;
  }, [bloqueada, navegar]);

  if (estado.kind === 'LOCKED') {
    return null;
  }
  return (
    <div className="persona-activa" role="status">
      <span>
        {textos.personas.activa} <strong>{estado.user.name}</strong>
      </span>
      <Boton
        variante="secundario"
        onClick={() => {
          session.switchUser();
        }}
      >
        {textos.personas.cambiarDeUsuario}
      </Boton>
    </div>
  );
}
