import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import {
  collectionsByCashier,
  collectionsByMethod,
  DEFAULT_OVERDUE_DAYS,
  defaultPermissionPolicy,
  ordersByStatus,
  PERIOD_KINDS,
  periodOf,
  receivablesAgingReport,
  salesReport,
  topProducts,
  type Comparison,
  type ComparisonMode,
  type CounterSale,
  type CounterSaleStore,
  type OrderDeps,
  type Payment,
  type Period,
  type PeriodKind,
  type QuoteActor,
  type WorkOrder,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { formatearPesos } from '../../../shared/ui/formatos';

const t = textos.reportes;

export interface ReportesProps {
  readonly deps: Pick<OrderDeps, 'orders' | 'payments' | 'clock'>;
  readonly sales: CounterSaleStore;
  /** Nombres de las personas, para mostrar quién cobró. */
  readonly personas: readonly { readonly id: string; readonly name: string }[];
  readonly actor: QuoteActor | null;
  /** Días de atraso a partir de los cuales se resalta una cuenta (PD-33). */
  readonly diasDeAtraso?: number;
  /** Contra qué se compara cada periodo (PP-13 por aprobar: el periodo anterior completo). */
  readonly modoDeComparacion?: ComparisonMode;
  readonly alCambiarElEnvio?: (aviso: () => void) => () => void;
}

/** Porcentaje en puntos base como texto exacto, sin flotantes: 1250 → "12.50 %". */
export function formatearPorcentaje(bps: number): string {
  const absoluto = Math.abs(bps);
  return `${String(Math.floor(absoluto / 100))}.${String(absoluto % 100).padStart(2, '0')} %`;
}

function fechaCorta(dia: string): string {
  const [y, m, d] = dia.split('-');
  return `${d ?? ''}/${m ?? ''}/${y ?? ''}`;
}

function etiquetaDelPeriodo(p: Period): string {
  if (p.kind === 'DAY') {
    return fechaCorta(p.start);
  }
  if (p.kind === 'WEEK') {
    return `${fechaCorta(p.start)} – ${fechaCorta(p.end)}`;
  }
  const [y, m] = p.start.split('-');
  return `${t.meses[Number(m) - 1] ?? ''} ${y ?? ''}`;
}

function Tendencia({ c }: { readonly c: Comparison }): ReactElement {
  if (c.trend === 'NO_BASELINE') {
    return <span>{t.comparativo.sinBase}</span>;
  }
  const flecha = c.trend === 'UP' ? '▲' : c.trend === 'DOWN' ? '▼' : '=';
  const palabra =
    c.trend === 'UP' ? t.comparativo.sube : c.trend === 'DOWN' ? t.comparativo.baja : t.comparativo.igual;
  return (
    <span>
      <span aria-hidden="true">{flecha} </span>
      {palabra} {formatearPorcentaje(c.percentBps ?? 0)}
    </span>
  );
}

/** Reportes del negocio para administradores: ventas con comparativo, lo más vendido, trabajos por estatus,
 *  antigüedad de lo que se debe y cobros por persona y por método. Todo en hora de México y con tablas que
 *  se apilan en el celular [RF-M7-*]. Lee lo guardado en la tablet. */
export function Reportes(props: ReportesProps): ReactElement {
  const { deps, actor } = props;
  const [pagos, setPagos] = useState<readonly Payment[]>([]);
  const [ordenes, setOrdenes] = useState<readonly WorkOrder[]>([]);
  const [ventas, setVentas] = useState<readonly CounterSale[]>([]);
  const [periodoDeMetodo, setPeriodoDeMetodo] = useState<PeriodKind>('MONTH');
  const [periodoDeProductos, setPeriodoDeProductos] = useState<'WEEK' | 'MONTH'>('MONTH');

  const refrescar = useCallback(async () => {
    const [p, o, v] = await Promise.all([
      deps.payments.list(),
      deps.orders.list(),
      props.sales.list(),
    ]);
    setPagos(p);
    setOrdenes(o);
    setVentas(v);
  }, [deps, props.sales]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const { alCambiarElEnvio } = props;
  useEffect(() => alCambiarElEnvio?.(() => void refrescar()), [alCambiarElEnvio, refrescar]);

  if (actor === null) {
    return (
      <section>
        <h1>{t.titulo}</h1>
        <Aviso tipo="error" queHacer={textos.cotizador.sinPersona}>
          {textos.mostrador.sinPersona}
        </Aviso>
        <Link to="/entrar" className="acceso">
          {textos.mostrador.elegirPersona}
        </Link>
      </section>
    );
  }
  if (defaultPermissionPolicy.check(actor.role, 'REPORTS_AND_RECEIVABLES') === 'DENY') {
    return (
      <section>
        <h1>{t.titulo}</h1>
        <Aviso tipo="error" queHacer={t.soloAdministradores.queHacer}>
          {t.soloAdministradores.mensaje}
        </Aviso>
      </section>
    );
  }

  const ahora = deps.clock.now();
  const umbral = props.diasDeAtraso ?? DEFAULT_OVERDUE_DAYS;
  const ventasPorPeriodo = salesReport({
    payments: pagos,
    sales: ventas,
    now: ahora,
    ...(props.modoDeComparacion === undefined ? {} : { mode: props.modoDeComparacion }),
  });
  const productos = topProducts({
    sales: ventas,
    orders: ordenes,
    period: periodOf(ahora, periodoDeProductos),
  });
  const estatus = ordersByStatus(ordenes);
  const antiguedad = receivablesAgingReport({ orders: ordenes, payments: pagos, now: ahora, overdueDays: umbral });
  const cajeros = collectionsByCashier({ payments: pagos, sales: ventas, now: ahora });
  const periodoMetodo = periodOf(ahora, periodoDeMetodo);
  const metodos = collectionsByMethod({ payments: pagos, sales: ventas, period: periodoMetodo });
  const nombre = (id: string): string => props.personas.find((p) => p.id === id)?.name ?? t.sinNombre;
  const pendientes = estatus.filter((e) => e.pending);

  return (
    <section className="anima-entrada reportes" aria-labelledby="titulo-reportes">
      <h1 id="titulo-reportes">{t.titulo}</h1>

      <h2>{t.ventas.titulo}</h2>
      <p>{t.ventas.base}</p>
      <table className="tabla tabla--apilada">
        <thead>
          <tr>
            <th scope="col">{t.ventas.periodo}</th>
            <th scope="col">{t.ventas.ventas}</th>
            <th scope="col">{t.ventas.anterior}</th>
            <th scope="col">{t.ventas.comparativo}</th>
          </tr>
        </thead>
        <tbody>
          {PERIOD_KINDS.map((k) => {
            const r = ventasPorPeriodo[k];
            return (
              <tr key={k}>
                <th scope="row">
                  {t.periodos[k]}
                  <small> · {etiquetaDelPeriodo(r.period)}</small>
                </th>
                <td data-label={t.ventas.ventas}>{formatearPesos(r.comparison.currentCents)}</td>
                <td data-label={t.ventas.anterior}>
                  {formatearPesos(r.comparison.previousCents)}
                  <small> · {etiquetaDelPeriodo(r.previous)}</small>
                </td>
                <td data-label={t.ventas.comparativo}>
                  <Tendencia c={r.comparison} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>{t.productos.titulo}</h2>
      <p>
        <label>
          {t.productos.periodo}{' '}
          <select
            value={periodoDeProductos}
            onChange={(e) => {
              setPeriodoDeProductos(e.target.value === 'WEEK' ? 'WEEK' : 'MONTH');
            }}
          >
            <option value="WEEK">{t.periodos.WEEK}</option>
            <option value="MONTH">{t.periodos.MONTH}</option>
          </select>
        </label>{' '}
        <small>{etiquetaDelPeriodo(productos.period)}</small>
      </p>
      {productos.byAmount.length === 0 ? (
        <p>{t.productos.vacio}</p>
      ) : (
        <>
          <h3>{t.productos.porImporte}</h3>
          <table className="tabla tabla--apilada">
            <thead>
              <tr>
                <th scope="col">{t.productos.producto}</th>
                <th scope="col">{t.productos.importe}</th>
                <th scope="col">{t.productos.cantidad}</th>
              </tr>
            </thead>
            <tbody>
              {productos.byAmount.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.name}</th>
                  <td data-label={t.productos.importe}>{formatearPesos(p.amountCents)}</td>
                  <td data-label={t.productos.cantidad}>{String(p.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{t.productos.porCantidad}</h3>
          <table className="tabla tabla--apilada">
            <thead>
              <tr>
                <th scope="col">{t.productos.producto}</th>
                <th scope="col">{t.productos.cantidad}</th>
                <th scope="col">{t.productos.importe}</th>
              </tr>
            </thead>
            <tbody>
              {productos.byQuantity.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.name}</th>
                  <td data-label={t.productos.cantidad}>{String(p.quantity)}</td>
                  <td data-label={t.productos.importe}>{formatearPesos(p.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>{t.trabajos.titulo}</h2>
      <table className="tabla tabla--apilada">
        <thead>
          <tr>
            <th scope="col">{t.trabajos.estatus}</th>
            <th scope="col">{t.trabajos.trabajos}</th>
            <th scope="col">{t.trabajos.valor}</th>
          </tr>
        </thead>
        <tbody>
          {estatus.map((e) => (
            <tr key={e.status}>
              <th scope="row">{textos.ordenes.estados[e.status]}</th>
              <td data-label={t.trabajos.trabajos}>{String(e.count)}</td>
              <td data-label={t.trabajos.valor}>{formatearPesos(e.valueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {t.trabajos.pendientes}: {String(pendientes.reduce((s, e) => s + e.count, 0))} ·{' '}
        {formatearPesos(pendientes.reduce((s, e) => s + e.valueCents, 0))}
      </p>

      <h2>{t.cuentas.titulo}</h2>
      <table className="tabla tabla--apilada">
        <thead>
          <tr>
            <th scope="col">{t.cuentas.antiguedad}</th>
            <th scope="col">{t.cuentas.cuentas}</th>
            <th scope="col">{t.cuentas.saldo}</th>
          </tr>
        </thead>
        <tbody>
          {antiguedad.map((b) => (
            <tr key={`${String(b.fromDays)}-${String(b.undated)}`} className={b.overdue ? 'fila--atrasada' : undefined}>
              <th scope="row">
                {b.undated
                  ? t.cuentas.sinFecha
                  : b.toDays === null
                    ? t.cuentas.desde(b.fromDays ?? 0)
                    : t.cuentas.entre(b.fromDays ?? 0, b.toDays)}
                {b.overdue ? <strong> · {t.cuentas.atrasadas}</strong> : null}
              </th>
              <td data-label={t.cuentas.cuentas}>{String(b.count)}</td>
              <td data-label={t.cuentas.saldo}>{formatearPesos(b.balanceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t.cajeros.titulo}</h2>
      {PERIOD_KINDS.map((k) => (
        <div key={k}>
          <h3>
            {t.periodos[k]}
            <small> · {etiquetaDelPeriodo(cajeros[k].period)}</small>
          </h3>
          {cajeros[k].rows.length === 0 ? (
            <p>{t.cajeros.vacio}</p>
          ) : (
            <table className="tabla tabla--apilada">
              <thead>
                <tr>
                  <th scope="col">{t.cajeros.persona}</th>
                  <th scope="col">{t.metodos.efectivo}</th>
                  <th scope="col">{t.metodos.transferencia}</th>
                  <th scope="col">{t.metodos.total}</th>
                </tr>
              </thead>
              <tbody>
                {cajeros[k].rows.map((r) => (
                  <tr key={r.userId}>
                    <th scope="row">{nombre(r.userId)}</th>
                    <td data-label={t.metodos.efectivo}>{formatearPesos(r.cashCents)}</td>
                    <td data-label={t.metodos.transferencia}>{formatearPesos(r.transferCents)}</td>
                    <td data-label={t.metodos.total}>{formatearPesos(r.totalCents)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">{t.cajeros.todos}</th>
                  <td data-label={t.metodos.efectivo}>{formatearPesos(cajeros[k].totals.cashCents)}</td>
                  <td data-label={t.metodos.transferencia}>{formatearPesos(cajeros[k].totals.transferCents)}</td>
                  <td data-label={t.metodos.total}>{formatearPesos(cajeros[k].totals.totalCents)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      ))}

      <h2>{t.metodos.titulo}</h2>
      <p>
        <label>
          {t.metodos.periodo}{' '}
          <select
            value={periodoDeMetodo}
            onChange={(e) => {
              setPeriodoDeMetodo(
                e.target.value === 'DAY' ? 'DAY' : e.target.value === 'WEEK' ? 'WEEK' : 'MONTH',
              );
            }}
          >
            {PERIOD_KINDS.map((k) => (
              <option key={k} value={k}>
                {t.periodos[k]}
              </option>
            ))}
          </select>
        </label>{' '}
        <small>{etiquetaDelPeriodo(periodoMetodo)}</small>
      </p>
      <dl className="documento__totales">
        <dt>{t.metodos.efectivo}</dt>
        <dd>{formatearPesos(metodos.cashCents)}</dd>
        <dt>{t.metodos.transferencia}</dt>
        <dd>{formatearPesos(metodos.transferCents)}</dd>
        <dt>{t.metodos.total}</dt>
        <dd>{formatearPesos(metodos.totalCents)}</dd>
        <dt>{t.metodos.cobros}</dt>
        <dd>{String(metodos.count)}</dd>
      </dl>
    </section>
  );
}
