import { useCallback, useSyncExternalStore } from 'react';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { PedirConectar } from '../../devices/ui/PedirConectar';
import type { ReactElement } from 'react';
import { useDatosDeLaTablet } from '../../../shared/ui/use-datos-de-la-tablet';
import type { ActiveUserSession, QuoteActor } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Cotizador, type CotizadorProps } from './Cotizador';

export type PrepararCotizador = () => Promise<Omit<CotizadorProps, 'actor'> | null>;

export interface CotizadorEnLaTabletProps {
  /** Reúne lo que el cotizador necesita (configuración bajada, catálogo local, sesión de la tablet);
   *  `null` si la tablet todavía no está lista para cotizar. */
  readonly preparar: PrepararCotizador;
  readonly session: ActiveUserSession;
}

/** Conecta el cotizador con la tablet: quién la usa (la persona que entró con su PIN) y la
 *  configuración guardada, sin pedir internet [RF-M2-*]. */
export function CotizadorEnLaTablet({ preparar, session }: CotizadorEnLaTabletProps): ReactElement {
  const suscribir = useCallback((aviso: () => void) => session.subscribe(aviso), [session]);
  const leer = useCallback(() => session.state(), [session]);
  const estado = useSyncExternalStore(suscribir, leer);
  const props = useDatosDeLaTablet(preparar);

  if (props === undefined) {
    return <p role="status">{textos.personas.cargando}</p>;
  }
  if (props === null) {
    return (
      <section className="anima-entrada">
        <EncabezadoDePagina titulo={textos.cotizador.titulo} />
        <Aviso tipo="error" queHacer={textos.personas.errores.NO_USERS_YET.queHacer}>
          {textos.cotizador.noLista}
        </Aviso>
        <PedirConectar>{textos.conectar.titulo}</PedirConectar>
      </section>
    );
  }
  const actor: QuoteActor | null =
    estado.kind === 'ACTIVE' ? { userId: estado.user.id, role: estado.user.role } : null;
  return <Cotizador {...props} actor={actor} />;
}
