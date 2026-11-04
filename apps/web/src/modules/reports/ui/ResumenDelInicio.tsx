import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  collectionsByCashier,
  collectionsByMethod,
  DEFAULT_OVERDUE_DAYS,
  dailyIncomeTrend,
  ordersByStatus,
  periodOf,
  receivablesAgingReport,
  salesReport,
  type CounterSale,
  type Payment,
  type WorkOrder,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Ayuda } from '../../../shared/ui/Ayuda';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { FlechaDeComparacion } from '../../../shared/ui/FlechaDeComparacion';
import { GraficaDeBarras, GraficaDeLinea } from '../../../shared/ui/Graficas';
import { Indicador } from '../../../shared/ui/Indicador';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { formatearPesos } from '../../../shared/ui/formatos';
import { formatearPorcentaje, type ReportesProps } from './Reportes';

const t = textos.inicio.resumen;
const r = textos.reportes;

export type ResumenDelInicioProps = ReportesProps;

function fechaCorta(dia: string): string {
  const [, m, d] = dia.split('-');
  return `${d ?? ''}/${m ?? ''}`;
}

/** Lo que se ve al abrir la aplicación, según quién entró: el administrador ve las ventas de hoy y sus medios de
 *  pago, lo que le deben, la producción y la tendencia del último mes; el cajero, lo que él cobró hoy y la
 *  producción pendiente [D5, PD-31, RF-UX-01]. Lee lo guardado en la tablet; sin datos enseña qué hacer. */
export function ResumenDelInicio(props: ResumenDelInicioProps): ReactElement | null {
  const { deps, actor } = props;
  const [pagos, setPagos] = useState<readonly Payment[]>([]);
  const [ordenes, setOrdenes] = useState<readonly WorkOrder[]>([]);
  const [ventas, setVentas] = useState<readonly CounterSale[]>([]);
  const [cargado, setCargado] = useState(false);

  const refrescar = useCallback(async () => {
    const [p, o, v] = await Promise.all([
      deps.payments.list(),
      deps.orders.list(),
      props.sales.list(),
    ]);
    setPagos(p);
    setOrdenes(o);
    setVentas(v);
    setCargado(true);
  }, [deps, props.sales]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const { alCambiarElEnvio } = props;
  useEffect(() => alCambiarElEnvio?.(() => void refrescar()), [alCambiarElEnvio, refrescar]);

  if (actor === null) {
    return null;
  }
  if (!cargado) {
    return <p role="status">{t.cargando}</p>;
  }
  if (pagos.length === 0 && ordenes.length === 0 && ventas.length === 0) {
    return <EstadoVacio titulo={t.vacioTitulo} descripcion={t.vacio} icono="reportes" />;
  }

  const ahora = deps.clock.now();
  const hoy = periodOf(ahora, 'DAY');
  const pendientes = ordersByStatus(ordenes).filter((e) => e.pending);
  const enProduccion = {
    count: pendientes.reduce((s, e) => s + e.count, 0),
    cents: pendientes.reduce((s, e) => s + e.valueCents, 0),
  };
  const produccion = (
    <Indicador
      rotulo={r.trabajos.pendientes}
      valor={formatearPesos(enProduccion.cents)}
      detalle={t.trabajos(enProduccion.count)}
    />
  );

  if (actor.role !== 'ADMIN') {
    const mios = collectionsByCashier({ payments: pagos, sales: ventas, now: ahora }).DAY.rows.find(
      (f) => f.userId === actor.userId,
    );
    return (
      <div className="resumen">
        <div className="indicadores">
          <Tarjeta rotulo={t.tuTurno} acciones={<Ayuda tema={t.tuTurno}>{t.ayudaTuTurno}</Ayuda>}>
            <Indicador
              rotulo={r.periodos.DAY}
              valor={formatearPesos(mios?.totalCents ?? 0)}
              detalle={t.cobros(mios?.count ?? 0)}
              tono="exito"
            />
          </Tarjeta>
          <Tarjeta rotulo={t.efectivo}>
            <Indicador rotulo={r.periodos.DAY} valor={formatearPesos(mios?.cashCents ?? 0)} />
          </Tarjeta>
          <Tarjeta rotulo={t.transferencia}>
            <Indicador rotulo={r.periodos.DAY} valor={formatearPesos(mios?.transferCents ?? 0)} />
          </Tarjeta>
          <Tarjeta rotulo={t.produccion}>{produccion}</Tarjeta>
        </div>
      </div>
    );
  }

  const dia = salesReport({ payments: pagos, sales: ventas, now: ahora }).DAY;
  const c = dia.comparison;
  const palabra =
    c.trend === 'UP'
      ? r.comparativo.sube
      : c.trend === 'DOWN'
        ? r.comparativo.baja
        : r.comparativo.igual;
  const metodos = collectionsByMethod({ payments: pagos, sales: ventas, period: hoy });
  const cuentas = receivablesAgingReport({
    orders: ordenes,
    payments: pagos,
    now: ahora,
    overdueDays: props.diasDeAtraso ?? DEFAULT_OVERDUE_DAYS,
  });
  const porCobrar = cuentas.reduce((s, b) => s + b.balanceCents, 0);
  const cuentasAbiertas = cuentas.reduce((s, b) => s + b.count, 0);
  const atrasadas = cuentas.filter((b) => b.overdue).reduce((s, b) => s + b.count, 0);
  const tendencia = dailyIncomeTrend({ payments: pagos, sales: ventas, now: ahora });

  return (
    <div className="resumen">
      <div className="indicadores">
        <Tarjeta rotulo={t.hoy} acciones={<Ayuda tema={t.hoy}>{t.ayudaVentas}</Ayuda>}>
          <Indicador
            rotulo={fechaCorta(hoy.start)}
            valor={formatearPesos(c.currentCents)}
            detalle={`${t.ayer}: ${formatearPesos(c.previousCents)}`}
            tono="exito"
          />
          <div className="reportes__comparacion">
            <FlechaDeComparacion
              tendencia={c.trend}
              texto={
                c.trend === 'NO_BASELINE'
                  ? r.comparativo.sinBase
                  : `${palabra} ${formatearPorcentaje(c.percentBps ?? 0)}`
              }
            />
          </div>
        </Tarjeta>
        <Tarjeta
          rotulo={t.porCobrar}
          acciones={<Ayuda tema={t.porCobrar}>{t.ayudaPorCobrar}</Ayuda>}
        >
          <Indicador
            rotulo={t.cuentas(cuentasAbiertas)}
            valor={formatearPesos(porCobrar)}
            detalle={cuentasAbiertas === 0 ? t.sinDeudas : t.atrasadas(atrasadas)}
            tono={atrasadas > 0 ? 'peligro' : 'neutro'}
          />
        </Tarjeta>
        <Tarjeta rotulo={t.produccion}>{produccion}</Tarjeta>
      </div>

      <div className="reportes__rejilla">
        <Tarjeta rotulo={t.mediosDePago}>
          <GraficaDeBarras
            descripcion={t.mediosDePago}
            formatear={formatearPesos}
            datos={[
              { etiqueta: t.efectivo, valor: metodos.cashCents, tono: 'exito' },
              { etiqueta: t.transferencia, valor: metodos.transferCents, tono: 'acento' },
            ]}
          />
          <p className="reportes__pie">{t.cobros(metodos.count)}</p>
        </Tarjeta>
        <Tarjeta
          rotulo={t.tendencia}
          acciones={<Ayuda tema={t.tendencia}>{t.ayudaTendencia}</Ayuda>}
        >
          <GraficaDeLinea
            descripcion={t.tendencia}
            formatear={formatearPesos}
            puntos={tendencia.map((d) => ({
              etiqueta: fechaCorta(d.day),
              valor: d.totalCents,
            }))}
          />
        </Tarjeta>
      </div>
    </div>
  );
}
