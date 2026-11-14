import { useCallback, useSyncExternalStore } from 'react';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { PedirConectar } from '../../devices/ui/PedirConectar';
import type { ReactElement } from 'react';
import { useDatosDeLaTablet } from '../../../shared/ui/use-datos-de-la-tablet';
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
  const props = useDatosDeLaTablet(preparar);

  if (props === undefined) {
    return <p role="status">{textos.ordenes.cargando}</p>;
  }
  if (props === null) {
    return (
      <section className="anima-entrada">
        <EncabezadoDePagina titulo={textos.cuentas.titulo} />
        <Aviso tipo="error" queHacer={textos.personas.errores.NO_USERS_YET.queHacer}>
          {textos.cotizador.noLista}
        </Aviso>
        <PedirConectar>{textos.conectar.titulo}</PedirConectar>
      </section>
    );
  }
  const actor: QuoteActor | null =
    estado.kind === 'ACTIVE' ? { userId: estado.user.id, role: estado.user.role } : null;
  return <CuentasPorCobrar {...props} actor={actor} />;
}
