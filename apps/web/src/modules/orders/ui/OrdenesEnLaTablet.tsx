import { useCallback, useSyncExternalStore } from 'react';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { PedirConectar } from '../../devices/ui/PedirConectar';
import type { ReactElement } from 'react';
import { useDatosDeLaTablet } from '../../../shared/ui/use-datos-de-la-tablet';
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
  const props = useDatosDeLaTablet(preparar);

  if (props === undefined) {
    return <p role="status">{textos.ordenes.cargando}</p>;
  }
  if (props === null) {
    return (
      <section className="anima-entrada">
        <EncabezadoDePagina titulo={textos.ordenes.titulo} />
        <Aviso tipo="error" queHacer={textos.personas.errores.NO_USERS_YET.queHacer}>
          {textos.cotizador.noLista}
        </Aviso>
        <PedirConectar>{textos.conectar.titulo}</PedirConectar>
      </section>
    );
  }
  const actor: QuoteActor | null =
    estado.kind === 'ACTIVE' ? { userId: estado.user.id, role: estado.user.role } : null;
  return <Ordenes {...props} actor={actor} />;
}
