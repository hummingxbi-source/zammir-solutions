import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import type { ActiveUserSession, QuoteActor } from '@zammir/core';

import type { PrepararReportes } from './ReportesEnLaTablet';
import { ResumenDelInicio, type ResumenDelInicioProps } from './ResumenDelInicio';

export interface ResumenDelInicioEnLaTabletProps {
  readonly preparar: PrepararReportes;
  readonly session: ActiveUserSession;
}

/** Conecta el resumen del inicio con la tablet: quién la usa y lo guardado. Si la tablet no está lista o
 *  nadie ha entrado, no muestra nada y el inicio sigue con sus accesos. */
export function ResumenDelInicioEnLaTablet({
  preparar,
  session,
}: ResumenDelInicioEnLaTabletProps): ReactElement | null {
  const suscribir = useCallback((aviso: () => void) => session.subscribe(aviso), [session]);
  const leer = useCallback(() => session.state(), [session]);
  const estado = useSyncExternalStore(suscribir, leer);
  const [props, setProps] = useState<Omit<ResumenDelInicioProps, 'actor'> | null>(null);

  useEffect(() => {
    void preparar().then(setProps);
  }, [preparar]);

  if (props === null || estado.kind !== 'ACTIVE') {
    return null;
  }
  const actor: QuoteActor = { userId: estado.user.id, role: estado.user.role };
  return <ResumenDelInicio {...props} actor={actor} />;
}
