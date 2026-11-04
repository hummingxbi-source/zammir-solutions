import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { ActiveUserSession, QuoteActor } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Reportes, type ReportesProps } from './Reportes';

export type PrepararReportes = () => Promise<Omit<ReportesProps, 'actor'> | null>;

export interface ReportesEnLaTabletProps {
  readonly preparar: PrepararReportes;
  readonly session: ActiveUserSession;
}

/** Conecta los reportes con la tablet: quién la usa y lo guardado, sin pedir internet. */
export function ReportesEnLaTablet({ preparar, session }: ReportesEnLaTabletProps): ReactElement {
  const suscribir = useCallback((aviso: () => void) => session.subscribe(aviso), [session]);
  const leer = useCallback(() => session.state(), [session]);
  const estado = useSyncExternalStore(suscribir, leer);
  const [props, setProps] = useState<Omit<ReportesProps, 'actor'> | null | undefined>(undefined);

  useEffect(() => {
    void preparar().then(setProps);
  }, [preparar]);

  if (props === undefined) {
    return <p role="status">{textos.ordenes.cargando}</p>;
  }
  if (props === null) {
    return (
      <section>
        <h1>{textos.reportes.titulo}</h1>
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
  return <Reportes {...props} actor={actor} />;
}
