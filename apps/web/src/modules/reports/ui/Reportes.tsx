import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import {
  collectionsByCashier,
  collectionsByMethod,
  DEFAULT_OVERDUE_DAYS,
  dailyIncomeTrend,
  defaultPermissionPolicy,
  ordersByStatus,
  PERIOD_KINDS,
  periodOf,
  receivablesAgingReport,
  salesReport,
  topProducts,
  type CashShiftStore,
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
import { Ayuda } from '../../../shared/ui/Ayuda';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { FlechaDeComparacion } from '../../../shared/ui/FlechaDeComparacion';
import {
  Dona,
  GraficaDeBarras,
  GraficaDeColumnas,
  GraficaDeLinea,
  type TonoDeGrafica,
} from '../../../shared/ui/Graficas';
import { PanelDeIndicadores } from '../../../shared/ui/PanelDeIndicadores';
import { Pestanas } from '../../../shared/ui/Pestanas';
import { Tabla } from '../../../shared/ui/Tabla';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { pesosCompactos } from '../../../shared/ui/graficas-util';
import { formatearPesos } from '../../../shared/ui/formatos';

const t = textos.reportes;

const TONO_DE_ESTATUS: Record<WorkOrderStatus, TonoDeGrafica> = {
  WAITING: 'aluminio',
  IN_PROCESS: 'laton',
  READY: 'exito',
  DELIVERED: 'acento',
  CANCELLED: 'peligro',
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
  /** Turnos de caja de la tablet: el inicio del cajero muestra el suyo abierto. */
  readonly turnos?: Pick<CashShiftStore, 'openFor'>;
  /** Cuántas operaciones siguen sin enviarse al servidor: el inicio del cajero lo muestra. */
  readonly porEnviar?: () => Promise<number>;
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

function diaYMes(dia: string): string {
  const [, m, d] = dia.split('-');
  return `${d ?? ''}/${m ?? ''}`;
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

  const tendencia = dailyIncomeTrend({ payments: pagos, sales: ventas, now: ahora });
  const activos = pendientes.reduce((n, e) => n + e.count, 0);

  return (
    <section className="anima-entrada reportes">
      <EncabezadoDePagina
        titulo={t.titulo}
        acciones={<Ayuda tema={t.ventas.titulo}>{t.ventas.base}</Ayuda>}
      />

      <PanelDeIndicadores
        descripcion={t.ventas.titulo}
        items={PERIOD_KINDS.map((k) => {
          const r = ventasPorPeriodo[k];
          const c = r.comparison;
          const palabra =
            c.trend === 'UP'
              ? t.comparativo.sube
              : c.trend === 'DOWN'
                ? t.comparativo.baja
                : t.comparativo.igual;
          return {
            clave: k,
            rotulo: t.periodos[k],
            valor: formatearPesos(c.currentCents),
            variacion: (
              <FlechaDeComparacion
                tendencia={c.trend}
                texto={
                  c.trend === 'NO_BASELINE'
                    ? t.comparativo.sinBaseCorta
                    : `${palabra} ${formatearPorcentaje(c.percentBps ?? 0)}`
                }
              />
            ),
            detalle: `${t.ventas.anterior}: ${formatearPesos(c.previousCents)} · ${etiquetaDelPeriodo(r.previous)}`,
          };
        })}
      />

      <Tarjeta rotulo={t.tendencia}>
        <GraficaDeLinea
          descripcion={t.tendencia}
          formatear={formatearPesos}
          formatearEje={pesosCompactos}
          puntos={tendencia.map((d) => ({ etiqueta: diaYMes(d.day), valor: d.totalCents }))}
        />
      </Tarjeta>

      <div className="tablero-datos">
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
          <Dona
            descripcion={t.trabajos.titulo}
            formatear={(n) => textos.inicio.resumen.trabajos(n)}
            centro={{ valor: String(activos), rotulo: textos.inicio.resumen.activas }}
            datos={estatus.map((e) => ({
              etiqueta: textos.ordenes.estados[e.status],
              valor: e.count,
              nota: formatearPesos(e.valueCents),
              tono: TONO_DE_ESTATUS[e.status],
            }))}
          />
          <p className="reportes__pie">
            {t.trabajos.pendientes}: {String(activos)} ·{' '}
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

      <div className="reportes__cobros">
        <h2 className="rotulo reportes__seccion">{t.cobros.titulo}</h2>
        <Pestanas
          etiqueta={t.cobros.periodo}
          pestanas={periodosDeLista.map((p) => ({ id: p.id, texto: p.texto }))}
          activa={periodoDeMetodo}
          onCambiar={(id) => {
            setPeriodoDeMetodo(id === 'DAY' ? 'DAY' : id === 'WEEK' ? 'WEEK' : 'MONTH');
          }}
        />
        <p className="reportes__periodo">{etiquetaDelPeriodo(periodoMetodo)}</p>
      </div>

      <div className="tablero-datos tablero-datos--apila">
        <Tarjeta clase="tablero-datos__angosto" rotulo={t.metodos.titulo}>
          <Dona
            descripcion={t.metodos.titulo}
            formatear={formatearPesos}
            centro={{ valor: String(metodos.count), rotulo: t.metodos.cobros.toLowerCase() }}
            datos={[
              { etiqueta: t.metodos.efectivo, valor: metodos.cashCents, tono: 'acento' },
              { etiqueta: t.metodos.transferencia, valor: metodos.transferCents, tono: 'laton' },
            ]}
          />
          <p className="reportes__pie">
            {t.metodos.total}: {formatearPesos(metodos.totalCents)}
          </p>
        </Tarjeta>

        <Tarjeta clase="tablero-datos__ancho" rotulo={t.cajeros.titulo}>
          {cajeros[periodoDeMetodo].rows.length === 0 ? (
            <p className="mostrador__vacio">{t.cajeros.vacio}</p>
          ) : (
            <>
              <GraficaDeColumnas
                descripcion={t.cajeros.titulo}
                formatear={formatearPesos}
                datos={cajeros[periodoDeMetodo].rows.map((r) => ({
                  etiqueta: nombre(r.userId),
                  valor: r.totalCents,
                }))}
              />
              <Tabla
                descripcion={`${t.cajeros.titulo}: ${t.periodos[periodoDeMetodo]}`}
                claveDeFila={(f) => f.clave}
                filas={[
                  ...cajeros[periodoDeMetodo].rows.map((r) => ({
                    clave: r.userId,
                    nombre: nombre(r.userId),
                    cash: r.cashCents,
                    transfer: r.transferCents,
                    total: r.totalCents,
                  })),
                  {
                    clave: '__todas',
                    nombre: t.cajeros.todos,
                    cash: cajeros[periodoDeMetodo].totals.cashCents,
                    transfer: cajeros[periodoDeMetodo].totals.transferCents,
                    total: cajeros[periodoDeMetodo].totals.totalCents,
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
            </>
          )}
        </Tarjeta>
      </div>
    </section>
  );
}
