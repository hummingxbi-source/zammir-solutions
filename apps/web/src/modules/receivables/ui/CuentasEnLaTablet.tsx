import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { ActiveUserSession, QuoteActor } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { CuentasPorCobrar, type CuentasPorCobrarProps } from './CuentasPorCobrar';

export type PrepararCuentas = () => Promise<Omit<CuentasPorCobrarProps, 'actor'> | null>;

export interface CuentasEnLaTabletProps {
  readonly preparar: PrepararCuentas;
  readonly session: ActiveUserSession;
}

/** Conecta las cuentas por cobrar con la tablet: quién la usa y lo guardado, sin pedir internet. */
export function CuentasEnLaTablet({ preparar, session }: CuentasEnLaTabletProps): ReactElement {
  const suscribir = useCallback((aviso: () => void) => session.subscribe(aviso), [session]);
  const leer = useCallback(() => session.state(), [session]);
  const estado = useSyncExternalStore(suscribir, leer);
  const [props, setProps] = useState<Omit<CuentasPorCobrarProps, 'actor'> | null | undefined>(
    undefined,
  );

  useEffect(() => {
    void preparar().then(setProps);
  }, [preparar]);

  if (props === undefined) {
    return <p role="status">{textos.ordenes.cargando}</p>;
  }
  if (props === null) {
    return (
      <section>
        <h1>{textos.cuentas.titulo}</h1>
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
  return <CuentasPorCobrar {...props} actor={actor} />;
}
