import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { ActiveUserSession, QuoteActor } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Mostrador, type MostradorProps } from './Mostrador';

export type PrepararMostrador = () => Promise<Omit<MostradorProps, 'actor'> | null>;

export interface MostradorEnLaTabletProps {
  /** Reúne lo que el mostrador necesita (configuración bajada, cola de salida, personas); `null` si la
   *  tablet todavía no está lista. */
  readonly preparar: PrepararMostrador;
  readonly session: ActiveUserSession;
}

/** Conecta el mostrador con la tablet: quién la usa (la persona que entró con su PIN) y lo guardado,
 *  sin pedir internet [RF-M4-*]. */
export function MostradorEnLaTablet({ preparar, session }: MostradorEnLaTabletProps): ReactElement {
  const suscribir = useCallback((aviso: () => void) => session.subscribe(aviso), [session]);
  const leer = useCallback(() => session.state(), [session]);
  const estado = useSyncExternalStore(suscribir, leer);
  const [props, setProps] = useState<Omit<MostradorProps, 'actor'> | null | undefined>(undefined);

  useEffect(() => {
    void preparar().then(setProps);
  }, [preparar]);

  if (props === undefined) {
    return <p role="status">{textos.mostrador.cargando}</p>;
  }
  if (props === null) {
    return (
      <section>
        <h1>{textos.mostrador.titulo}</h1>
        <Aviso tipo="error" queHacer={textos.personas.errores.NO_USERS_YET.queHacer}>
          {textos.cotizador.noLista}
        </Aviso>
        <Link to="/conectar" className="acceso">
          {textos.conectar.titulo}
        </Link>
      </section>
    );
  }
  const actor: QuoteActor | null =
    estado.kind === 'ACTIVE' ? { userId: estado.user.id, role: estado.user.role } : null;
  return <Mostrador {...props} actor={actor} />;
}
