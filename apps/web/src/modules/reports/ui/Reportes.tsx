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
  type ComparisonMode,
  type CounterSale,
  type CounterSaleStore,
  type OrderDeps,
  type Payment,
  type Period,
  type PeriodKind,
  type QuoteActor,
  type WorkOrder,
  type WorkOrderStatus,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EtiquetaDeEstado, type TonoDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { FlechaDeComparacion } from '../../../shared/ui/FlechaDeComparacion';
import { GraficaDeBarras } from '../../../shared/ui/Graficas';
import { Indicador } from '../../../shared/ui/Indicador';
import { Pestanas } from '../../../shared/ui/Pestanas';
import { Tabla } from '../../../shared/ui/Tabla';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { formatearPesos } from '../../../shared/ui/formatos';

const t = textos.reportes;

const TONO_DE_ESTADO: Record<WorkOrderStatus, TonoDeEstado> = {
  WAITING: 'espera',
  IN_PROCESS: 'proceso',
  READY: 'listo',
  DELIVERED: 'entregado',
  CANCELLED: 'cancelado',
};

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
  const antiguedad = receivablesAgingReport({
    orders: ordenes,
    payments: pagos,
    now: ahora,
    overdueDays: umbral,
  });
  const cajeros = collectionsByCashier({ payments: pagos, sales: ventas, now: ahora });
  const periodoMetodo = periodOf(ahora, periodoDeMetodo);
  const metodos = collectionsByMethod({ payments: pagos, sales: ventas, period: periodoMetodo });
  const nombre = (id: string): string =>
    props.personas.find((p) => p.id === id)?.name ?? t.sinNombre;
  const pendientes = estatus.filter((e) => e.pending);

  const periodosDeLista: readonly { id: PeriodKind; texto: string }[] = PERIOD_KINDS.map((k) => ({
    id: k,
    texto: t.periodos[k],
  }));

  return (
    <section className="anima-entrada reportes">
      <EncabezadoDePagina titulo={t.titulo} />

      <h2 className="rotulo reportes__seccion">{t.ventas.titulo}</h2>
      <p className="reportes__base">{t.ventas.base}</p>
      <div className="indicadores">
        {PERIOD_KINDS.map((k) => {
          const r = ventasPorPeriodo[k];
          const c = r.comparison;
          const palabra =
            c.trend === 'UP'
              ? t.comparativo.sube
              : c.trend === 'DOWN'
                ? t.comparativo.baja
                : t.comparativo.igual;
          return (
            <Tarjeta key={k} rotulo={t.periodos[k]}>
              <Indicador
                rotulo={etiquetaDelPeriodo(r.period)}
                valor={formatearPesos(c.currentCents)}
                detalle={`${t.ventas.anterior}: ${formatearPesos(c.previousCents)} · ${etiquetaDelPeriodo(r.previous)}`}
              />
              <div className="reportes__comparacion">
                <FlechaDeComparacion
                  tendencia={c.trend}
                  texto={
                    c.trend === 'NO_BASELINE'
                      ? t.comparativo.sinBase
                      : `${palabra} ${formatearPorcentaje(c.percentBps ?? 0)}`
                  }
                />
              </div>
            </Tarjeta>
          );
        })}
      </div>

      <div className="reportes__rejilla">
        <Tarjeta rotulo={t.productos.titulo}>
          <Pestanas
            etiqueta={t.productos.periodo}
            pestanas={[
              { id: 'WEEK', texto: t.periodos.WEEK },
              { id: 'MONTH', texto: t.periodos.MONTH },
            ]}
            activa={periodoDeProductos}
            onCambiar={(id) => {
              setPeriodoDeProductos(id === 'WEEK' ? 'WEEK' : 'MONTH');
            }}
          />
          <p className="reportes__periodo">{etiquetaDelPeriodo(productos.period)}</p>
          {productos.byAmount.length === 0 ? (
            <p className="mostrador__vacio">{t.productos.vacio}</p>
          ) : (
            <>
              <h3 className="rotulo reportes__subtitulo">{t.productos.porImporte}</h3>
              <GraficaDeBarras
                descripcion={t.productos.porImporte}
                formatear={formatearPesos}
                datos={productos.byAmount.map((p) => ({ etiqueta: p.name, valor: p.amountCents }))}
              />
              <h3 className="rotulo reportes__subtitulo">{t.productos.porCantidad}</h3>
              <GraficaDeBarras
                descripcion={t.productos.porCantidad}
                formatear={(n) => String(n)}
                datos={productos.byQuantity.map((p) => ({
                  etiqueta: p.name,
                  valor: p.quantity,
                  tono: 'laton',
                }))}
              />
            </>
          )}
        </Tarjeta>

        <Tarjeta rotulo={t.trabajos.titulo}>
          <Tabla
            descripcion={t.trabajos.titulo}
            claveDeFila={(e) => e.status}
            filas={estatus}
            columnas={[
              {
                clave: 'estatus',
                rotulo: t.trabajos.estatus,
                celda: (e) => (
                  <EtiquetaDeEstado
                    tono={TONO_DE_ESTADO[e.status]}
                    texto={textos.ordenes.estados[e.status]}
                  />
                ),
              },
              {
                clave: 'trabajos',
                rotulo: t.trabajos.trabajos,
                numerica: true,
                celda: (e) => String(e.count),
              },
              {
                clave: 'valor',
                rotulo: t.trabajos.valor,
                numerica: true,
                celda: (e) => formatearPesos(e.valueCents),
              },
            ]}
          />
          <p className="reportes__pie">
            {t.trabajos.pendientes}: {String(pendientes.reduce((s, e) => s + e.count, 0))} ·{' '}
            {formatearPesos(pendientes.reduce((s, e) => s + e.valueCents, 0))}
          </p>
        </Tarjeta>
      </div>

      <Tarjeta rotulo={t.cuentas.titulo}>
        <GraficaDeBarras
          descripcion={t.cuentas.titulo}
          formatear={formatearPesos}
          datos={antiguedad.map((b) => ({
            etiqueta: b.undated
              ? t.cuentas.sinFecha
              : b.toDays === null
                ? t.cuentas.desde(b.fromDays ?? 0)
                : t.cuentas.entre(b.fromDays ?? 0, b.toDays),
            valor: b.balanceCents,
            tono: b.overdue ? 'peligro' : 'acento',
            nota: t.cuentas.cuantas(b.count),
          }))}
        />
        <p className="reportes__pie">{t.cuentas.leyenda(umbral)}</p>
      </Tarjeta>

      <Tarjeta rotulo={t.cajeros.titulo}>
        {PERIOD_KINDS.map((k) => (
          <div key={k} className="reportes__periodo-bloque">
            <h3 className="reportes__subtitulo">
              {t.periodos[k]}
              <small> · {etiquetaDelPeriodo(cajeros[k].period)}</small>
            </h3>
            {cajeros[k].rows.length === 0 ? (
              <p className="mostrador__vacio">{t.cajeros.vacio}</p>
            ) : (
              <Tabla
                descripcion={`${t.cajeros.titulo}: ${t.periodos[k]}`}
                claveDeFila={(f) => f.clave}
                filas={[
                  ...cajeros[k].rows.map((r) => ({
                    clave: r.userId,
                    nombre: nombre(r.userId),
                    cash: r.cashCents,
                    transfer: r.transferCents,
                    total: r.totalCents,
                  })),
                  {
                    clave: '__todas',
                    nombre: t.cajeros.todos,
                    cash: cajeros[k].totals.cashCents,
                    transfer: cajeros[k].totals.transferCents,
                    total: cajeros[k].totals.totalCents,
                  },
                ]}
                columnas={[
                  { clave: 'persona', rotulo: t.cajeros.persona, celda: (f) => f.nombre },
                  {
                    clave: 'efectivo',
                    rotulo: t.metodos.efectivo,
                    numerica: true,
                    celda: (f) => formatearPesos(f.cash),
                  },
                  {
                    clave: 'transferencia',
                    rotulo: t.metodos.transferencia,
                    numerica: true,
                    celda: (f) => formatearPesos(f.transfer),
                  },
                  {
                    clave: 'total',
                    rotulo: t.metodos.total,
                    numerica: true,
                    celda: (f) => formatearPesos(f.total),
                  },
                ]}
              />
            )}
          </div>
        ))}
      </Tarjeta>

      <Tarjeta rotulo={t.metodos.titulo}>
        <Pestanas
          etiqueta={t.metodos.periodo}
          pestanas={periodosDeLista.map((p) => ({ id: p.id, texto: p.texto }))}
          activa={periodoDeMetodo}
          onCambiar={(id) => {
            setPeriodoDeMetodo(id === 'DAY' ? 'DAY' : id === 'WEEK' ? 'WEEK' : 'MONTH');
          }}
        />
        <p className="reportes__periodo">{etiquetaDelPeriodo(periodoMetodo)}</p>
        <div className="indicadores">
          <Indicador rotulo={t.metodos.efectivo} valor={formatearPesos(metodos.cashCents)} />
          <Indicador
            rotulo={t.metodos.transferencia}
            valor={formatearPesos(metodos.transferCents)}
          />
          <Indicador
            rotulo={t.metodos.total}
            valor={formatearPesos(metodos.totalCents)}
            tono="exito"
            detalle={`${t.metodos.cobros}: ${String(metodos.count)}`}
          />
        </div>
      </Tarjeta>
    </section>
  );
}
