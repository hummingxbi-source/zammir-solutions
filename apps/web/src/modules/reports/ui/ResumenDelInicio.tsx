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
  type CashShift,
  type CounterSale,
  type Payment,
  type WorkOrder,
  type WorkOrderStatus,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Ayuda } from '../../../shared/ui/Ayuda';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { FlechaDeComparacion } from '../../../shared/ui/FlechaDeComparacion';
import {
  Dona,
  GraficaDeBarras,
  GraficaDeColumnas,
  GraficaDeLinea,
  type TonoDeGrafica,
} from '../../../shared/ui/Graficas';
import { Indicador } from '../../../shared/ui/Indicador';
import { PanelDeIndicadores } from '../../../shared/ui/PanelDeIndicadores';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { pesosCompactos } from '../../../shared/ui/graficas-util';
import { formatearPesos } from '../../../shared/ui/formatos';
import { formatearPorcentaje, type ReportesProps } from './Reportes';

const t = textos.inicio.resumen;

function horaDeMexico(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
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
  const idDeQuienUsa = props.actor?.userId ?? null;
  const [turno, setTurno] = useState<CashShift | null>(null);
  const [sinEnviar, setSinEnviar] = useState<number | null>(null);

  const refrescar = useCallback(async () => {
    const [p, o, v] = await Promise.all([
      deps.payments.list(),
      deps.orders.list(),
      props.sales.list(),
    ]);
    setPagos(p);
    setOrdenes(o);
    setVentas(v);
    setTurno(
      idDeQuienUsa === null || props.turnos === undefined
        ? null
        : await props.turnos.openFor(idDeQuienUsa),
    );
    setSinEnviar(props.porEnviar === undefined ? null : await props.porEnviar());
    setCargado(true);
  }, [deps, props.sales, idDeQuienUsa, props.turnos, props.porEnviar]);

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
  // Lo propio de quien cobra en la tablet: su turno de caja y lo que falta por enviar.
  const delCajero = (
    <>
      {props.turnos === undefined ? null : (
        <Tarjeta rotulo={t.miTurno} acciones={<Ayuda tema={t.miTurno}>{t.ayudaMiTurno}</Ayuda>}>
          {turno === null ? (
            <Indicador rotulo={t.sinTurno} valor="—" detalle={t.abrirEnElMostrador} />
          ) : (
            <Indicador
              rotulo={t.turnoAbierto(horaDeMexico(turno.openedAt))}
              valor={formatearPesos(turno.openingFloatCents)}
              detalle={t.fondoInicial}
              tono="exito"
            />
          )}
        </Tarjeta>
      )}
      {sinEnviar === null ? null : (
        <Tarjeta
          rotulo={t.porEnviar}
          acciones={<Ayuda tema={t.porEnviar}>{t.ayudaPorEnviar}</Ayuda>}
        >
          <Indicador
            rotulo={sinEnviar === 0 ? t.todoEnviado : t.operacionesSinEnviar(sinEnviar)}
            valor={String(sinEnviar)}
            detalle={sinEnviar === 0 ? t.nadaPendiente : t.saldranSolas}
            tono={sinEnviar === 0 ? 'exito' : 'neutro'}
          />
        </Tarjeta>
      )}
    </>
  );

  if (pagos.length === 0 && ordenes.length === 0 && ventas.length === 0) {
    const vacio = <EstadoVacio titulo={t.vacioTitulo} descripcion={t.vacio} icono="reportes" />;
    return actor.role === 'ADMIN' ? (
      vacio
    ) : (
      <div className="resumen">
        <div className="indicadores">{delCajero}</div>
        {vacio}
      </div>
    );
  }

  const ahora = deps.clock.now();
  const hoy = periodOf(ahora, 'DAY');
  const pendientes = ordersByStatus(ordenes).filter((e) => e.pending);
  const enProduccion = {
    count: pendientes.reduce((s, e) => s + e.count, 0),
    cents: pendientes.reduce((s, e) => s + e.valueCents, 0),
  };

  if (actor.role !== 'ADMIN') {
    const mios = collectionsByCashier({ payments: pagos, sales: ventas, now: ahora }).DAY.rows.find(
      (f) => f.userId === actor.userId,
    );
    return (
      <div className="resumen">
        <PanelDeIndicadores
          descripcion={t.tuTurno}
          items={[
            {
              clave: 'cobros',
              rotulo: t.tuTurno,
              valor: formatearPesos(mios?.totalCents ?? 0),
              tono: 'exito',
              detalle: t.cobros(mios?.count ?? 0),
              ayuda: <Ayuda tema={t.tuTurno}>{t.ayudaTuTurno}</Ayuda>,
            },
            {
              clave: 'efectivo',
              rotulo: t.efectivo,
              valor: formatearPesos(mios?.cashCents ?? 0),
              detalle: r.periodos.DAY,
            },
            {
              clave: 'transferencia',
              rotulo: t.transferencia,
              valor: formatearPesos(mios?.transferCents ?? 0),
              detalle: r.periodos.DAY,
            },
            {
              clave: 'produccion',
              rotulo: t.produccion,
              valor: formatearPesos(enProduccion.cents),
              detalle: t.trabajos(enProduccion.count),
            },
          ]}
        />
        <div className="indicadores">{delCajero}</div>
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

  const ultimos14 = tendencia.slice(-14).map((d) => d.totalCents);
  const cobrosDeHoy = collectionsByCashier({ payments: pagos, sales: ventas, now: ahora }).DAY.rows;
  const nombreDe = (id: string): string =>
    props.personas.find((p) => p.id === id)?.name ?? r.sinNombre;
  const TONO_DE_ESTATUS: Record<WorkOrderStatus, TonoDeGrafica> = {
    WAITING: 'aluminio',
    IN_PROCESS: 'laton',
    READY: 'exito',
    DELIVERED: 'acento',
    CANCELLED: 'peligro',
  };

  return (
    <div className="resumen">
      <PanelDeIndicadores
        descripcion={t.resumenDelDia}
        items={[
          {
            clave: 'hoy',
            rotulo: t.hoy,
            valor: formatearPesos(c.currentCents),
            tono: 'exito',
            ayuda: <Ayuda tema={t.hoy}>{t.ayudaVentas}</Ayuda>,
            variacion: (
              <FlechaDeComparacion
                tendencia={c.trend}
                texto={
                  c.trend === 'NO_BASELINE'
                    ? r.comparativo.sinBaseCorta
                    : `${palabra} ${formatearPorcentaje(c.percentBps ?? 0)}`
                }
              />
            ),
            tendencia: ultimos14,
            tonoDeTendencia: 'exito',
            detalle: `${t.ayer}: ${formatearPesos(c.previousCents)}`,
          },
          {
            clave: 'porCobrar',
            rotulo: t.porCobrar,
            valor: formatearPesos(porCobrar),
            tono: atrasadas > 0 ? 'peligro' : 'neutro',
            ayuda: <Ayuda tema={t.porCobrar}>{t.ayudaPorCobrar}</Ayuda>,
            detalle: `${t.cuentas(cuentasAbiertas)} · ${cuentasAbiertas === 0 ? t.sinDeudas : t.atrasadas(atrasadas)}`,
          },
          {
            clave: 'produccion',
            rotulo: t.produccion,
            valor: formatearPesos(enProduccion.cents),
            detalle: t.trabajos(enProduccion.count),
          },
        ]}
      />

      <div className="tablero-datos">
        <Tarjeta
          clase="tablero-datos__ancho"
          rotulo={t.tendencia}
          acciones={<Ayuda tema={t.tendencia}>{t.ayudaTendencia}</Ayuda>}
        >
          <GraficaDeLinea
            descripcion={t.tendencia}
            formatear={formatearPesos}
            formatearEje={pesosCompactos}
            puntos={tendencia.map((d) => ({
              etiqueta: fechaCorta(d.day),
              valor: d.totalCents,
            }))}
          />
        </Tarjeta>
        <Tarjeta clase="tablero-datos__angosto" rotulo={t.mediosDePago}>
          <Dona
            descripcion={t.mediosDePago}
            formatear={formatearPesos}
            centro={{ valor: String(metodos.count), rotulo: t.cobrosDeHoy }}
            datos={[
              { etiqueta: t.efectivo, valor: metodos.cashCents, tono: 'acento' },
              { etiqueta: t.transferencia, valor: metodos.transferCents, tono: 'laton' },
            ]}
          />
        </Tarjeta>
        <Tarjeta rotulo={t.cobrosPorPersona}>
          {cobrosDeHoy.length === 0 ? (
            <p className="mostrador__vacio">{r.cajeros.vacio}</p>
          ) : (
            <GraficaDeColumnas
              descripcion={t.cobrosPorPersona}
              formatear={formatearPesos}
              datos={cobrosDeHoy.map((f) => ({
                etiqueta: nombreDe(f.userId),
                valor: f.totalCents,
              }))}
            />
          )}
        </Tarjeta>
        <Tarjeta rotulo={t.produccionPorEstatus}>
          <Dona
            descripcion={t.produccionPorEstatus}
            formatear={(n) => t.trabajos(n)}
            centro={{ valor: String(enProduccion.count), rotulo: t.activas }}
            datos={pendientes.map((e) => ({
              etiqueta: textos.ordenes.estados[e.status],
              valor: e.count,
              nota: formatearPesos(e.valueCents),
              tono: TONO_DE_ESTATUS[e.status],
            }))}
          />
        </Tarjeta>
        <Tarjeta clase="tablero-datos__completo" rotulo={t.antiguedad}>
          <GraficaDeBarras
            descripcion={t.antiguedad}
            formatear={formatearPesos}
            datos={cuentas.map((b) => ({
              etiqueta: b.undated
                ? r.cuentas.sinFecha
                : b.toDays === null
                  ? r.cuentas.desde(b.fromDays ?? 0)
                  : r.cuentas.entre(b.fromDays ?? 0, b.toDays),
              valor: b.balanceCents,
              tono: b.overdue ? 'peligro' : 'acento',
              nota: r.cuentas.cuantas(b.count),
            }))}
          />
        </Tarjeta>
      </div>
    </div>
  );
}
