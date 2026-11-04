import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { asId, outboxCounterSaleStore, type QuoteActor } from '@zammir/core';

import { ResumenDelInicio } from '../modules/reports/ui/ResumenDelInicio';
import { PanelDeInicio } from '../shell/Paginas';
import { armarOrdenes } from './MuestraDeOrdenes';
import type { OrdenesProps } from '../modules/orders/ui/Ordenes';

/** Muestras del panel de inicio SOLO para desarrollo (`/muestras/inicio` como administrador y
 *  `/muestras/inicio-cajero` como cajero), con las mismas órdenes y pagos de ejemplo que la de Órdenes. */
export function MuestraDelInicio({
  comoCajero = false,
}: {
  readonly comoCajero?: boolean;
}): ReactElement {
  const [base, setBase] = useState<OrdenesProps | null>(null);
  useEffect(() => {
    void armarOrdenes().then(setBase);
  }, []);
  if (base === null) {
    return <p role="status">Armando la muestra…</p>;
  }
  const cajero = base.personas[0];
  const actor: QuoteActor | null =
    comoCajero && cajero !== undefined
      ? { userId: asId<'User'>(cajero.id), role: 'STAFF' }
      : base.actor;
  return (
    <PanelDeInicio
      interruptores={new Set()}
      resumen={
        <ResumenDelInicio
          deps={base.deps}
          sales={outboxCounterSaleStore(base.deps.outbox)}
          personas={base.personas}
          actor={actor}
        />
      }
    />
  );
}
