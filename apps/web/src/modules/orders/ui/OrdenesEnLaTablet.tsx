import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { ActiveUserSession, QuoteActor } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Ordenes, type OrdenesProps } from './Ordenes';

export type PrepararOrdenes = () => Promise<Omit<OrdenesProps, 'actor'> | null>;

export interface OrdenesEnLaTabletProps {
  /** Reúne lo que las órdenes necesitan (configuración bajada, cola de salida, personas); `null` si la
   *  tablet todavía no está lista. */
  readonly preparar: PrepararOrdenes;
  readonly session: ActiveUserSession;
}

/** Conecta las órdenes con la tablet: quién la usa (la persona que entró con su PIN) y lo guardado,
 *  sin pedir internet [RF-M3-*]. */
export function OrdenesEnLaTablet({ preparar, session }: OrdenesEnLaTabletProps): ReactElement {
  const suscribir = useCallback((aviso: () => void) => session.subscribe(aviso), [session]);
  const leer = useCallback(() => session.state(), [session]);
  const estado = useSyncExternalStore(suscribir, leer);
  const [props, setProps] = useState<Omit<OrdenesProps, 'actor'> | null | undefined>(undefined);

  useEffect(() => {
    void preparar().then(setProps);
  }, [preparar]);

  if (props === undefined) {
    return <p role="status">{textos.ordenes.cargando}</p>;
  }
  if (props === null) {
    return (
      <section>
        <h1>{textos.ordenes.titulo}</h1>
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
  return <Ordenes {...props} actor={actor} />;
}
