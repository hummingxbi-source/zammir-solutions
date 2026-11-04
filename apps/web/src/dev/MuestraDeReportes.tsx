import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { outboxCounterSaleStore } from '@zammir/core';

import { CuentasPorCobrar } from '../modules/receivables/ui/CuentasPorCobrar';
import { Reportes } from '../modules/reports/ui/Reportes';
import { armarOrdenes } from './MuestraDeOrdenes';
import type { OrdenesProps } from '../modules/orders/ui/Ordenes';

/** Muestras de Reportes y de Cuentas por cobrar SOLO para desarrollo (`/muestras/reportes` y
 *  `/muestras/cuentas`), con las mismas órdenes y pagos de ejemplo que la muestra de Órdenes. */
function useOrdenes(): OrdenesProps | null {
  const [props, setProps] = useState<OrdenesProps | null>(null);
  useEffect(() => {
    void armarOrdenes().then(setProps);
  }, []);
  return props;
}

export function MuestraDeReportes(): ReactElement {
  const base = useOrdenes();
  if (base === null) {
    return <p role="status">Armando la muestra…</p>;
  }
  return (
    <Reportes
      deps={base.deps}
      sales={outboxCounterSaleStore(base.deps.outbox)}
      personas={base.personas}
      actor={base.actor}
    />
  );
}

export function MuestraDeCuentas(): ReactElement {
  const base = useOrdenes();
  if (base === null) {
    return <p role="status">Armando la muestra…</p>;
  }
  return (
    <CuentasPorCobrar
      deps={base.deps}
      actor={base.actor}
      clientes={base.clientes}
      negocio="ZAMMIR (datos de prueba)"
      abrirEnlace={() => undefined}
    />
  );
}
