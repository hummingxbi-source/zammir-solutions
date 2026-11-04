import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import {
  balanceCents,
  convertQuoteToWorkOrder,
  filterWorkOrders,
  summarizeOrders,
  type Customer,
  type CustomerId,
  type ManageCustomersDeps,
  type OrderDeps,
  type Payment,
  type Quote,
  type QuoteActor,
  type WorkOrder,
  type WorkOrderStatus,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { EtiquetaDeEstado, type TonoDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { Indicador } from '../../../shared/ui/Indicador';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { Campo } from '../../../shared/ui/Campo';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { formatearPesos } from '../../../shared/ui/formatos';
import type { AutorizacionDeAdministrador } from '../../quotes/ui/DialogoDeDescuento';
import { DetalleDeOrden, type FotosDeLaOrden, type Persona } from './DetalleDeOrden';

const t = textos.ordenes;

const ESTADOS: readonly WorkOrderStatus[] = [
  'WAITING',
  'IN_PROCESS',
  'READY',
  'DELIVERED',
  'CANCELLED',
];

const TONO_DE_ESTADO: Record<WorkOrderStatus, TonoDeEstado> = {
  WAITING: 'espera',
  IN_PROCESS: 'proceso',
  READY: 'listo',
  DELIVERED: 'entregado',
  CANCELLED: 'cancelado',
};

export interface OrdenesProps {
  readonly deps: OrderDeps;
  /** Quién usa la tablet ahora; `null` si nadie ha entrado con su PIN. */
  readonly actor: QuoteActor | null;
  readonly clientes: ManageCustomersDeps;
  readonly personas: readonly Persona[];
  readonly autorizacion: AutorizacionDeAdministrador;
  /** Pide que se envíe lo guardado. */
  readonly onPorEnviar?: () => void;
  /** Avisa cuando el envío cambia (llegó un folio definitivo o una orden de otra tablet). */
  readonly alCambiarElEnvio?: (aviso: () => void) => () => void;
  /** Fotos de la medición (S3-03). */
  readonly fotos?: FotosDeLaOrden;
  /** Comprobante de trabajo por WhatsApp (S3-09). */
  readonly onComprobante?: (orden: WorkOrder, cliente: Customer | null) => Promise<string | null>;
}

/** Pantalla de órdenes de trabajo: lista por estatus, cotizaciones aceptadas por convertir y detalle
 *  [RF-M3-*]. Funciona sin internet: todo se guarda en la tablet y sale solo al volver la conexión. */
export function Ordenes(props: OrdenesProps): ReactElement {
  const { deps, actor, clientes } = props;
  const [ordenes, setOrdenes] = useState<readonly WorkOrder[]>([]);
  const [pagos, setPagos] = useState<readonly Payment[]>([]);
  const [porConvertir, setPorConvertir] = useState<readonly Quote[]>([]);
  const [nombres, setNombres] = useState<ReadonlyMap<CustomerId, Customer>>(new Map());
  const [filtro, setFiltro] = useState<WorkOrderStatus | null>(null);
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [responsableFiltro, setResponsableFiltro] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [creando, setCreando] = useState<string | null>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [cargado, setCargado] = useState(false);

  const refrescar = useCallback(async () => {
    const todas = await deps.orders.list();
    setOrdenes([...todas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setPagos(await deps.payments.list());
    const cotizaciones = await deps.quotes.list();
    setPorConvertir(
      cotizaciones.filter(
        (q) =>
          q.status === 'ACCEPTED' &&
          (q.convertedWorkOrderId === undefined || q.convertedWorkOrderId === null),
      ),
    );
    const c = await clientes.customers.list();
    setNombres(new Map((c.ok ? c.value : []).map((x) => [x.id, x])));
    setCargado(true);
  }, [deps, clientes]);

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
          {t.sinPersona}
        </Aviso>
        <Link to="/entrar" className="acceso">
          {t.elegirPersona}
        </Link>
      </section>
    );
  }

  const pagosDe = (id: string): readonly Payment[] => pagos.filter((p) => p.targetId === id);
  const seleccionada = ordenes.find((o) => o.id === abierta);

  if (seleccionada !== undefined) {
    return (
      <DetalleDeOrden
        deps={deps}
        actor={actor}
        orden={seleccionada}
        pagos={pagosDe(seleccionada.id)}
        cliente={nombres.get(seleccionada.customerId) ?? null}
        personas={props.personas}
        autorizacion={props.autorizacion}
        onCambio={() => {
          void refrescar();
        }}
        onPorEnviar={() => props.onPorEnviar?.()}
        onVolver={() => {
          setAbierta(null);
          void refrescar();
        }}
        {...(props.fotos === undefined ? {} : { fotos: props.fotos })}
        {...(props.onComprobante === undefined
          ? {}
          : {
              onComprobante: (o: WorkOrder) =>
                props.onComprobante?.(o, nombres.get(o.customerId) ?? null) ??
                Promise.resolve(null),
            })}
      />
    );
  }

  async function convertir(q: Quote): Promise<void> {
    if (actor === null) {
      return;
    }
    setError(null);
    setCreando(q.id);
    const r = await convertQuoteToWorkOrder(deps, actor, q.id);
    setCreando(null);
    if (!r.ok) {
      setError(t.errores[r.error.code]);
      return;
    }
    props.onPorEnviar?.();
    await refrescar();
    setAbierta(r.value.id);
  }

  const visibles = filterWorkOrders(ordenes, {
    status: filtro,
    customerId: clienteFiltro,
    responsibleId: responsableFiltro,
    fromDate: desde,
    toDate: hasta,
  });
  const resumen = summarizeOrders(ordenes, (id) =>
    balanceCents(ordenes.find((o) => o.id === id)?.totalCents ?? 0, pagosDe(id)),
  );

  return (
    <section className="anima-entrada">
      <EncabezadoDePagina titulo={t.titulo} descripcion={t.descripcion} />
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}

      {actor.role === 'ADMIN' ? (
        <div className="indicadores">
          <Indicador
            rotulo={t.resumen.enProduccion}
            valor={formatearPesos(resumen.inProductionCents)}
          />
          <Indicador
            rotulo={t.resumen.porCobrar}
            valor={formatearPesos(resumen.readyBalanceCents)}
            tono="exito"
          />
        </div>
      ) : null}

      <div className="ordenes__lista">
        <Tarjeta rotulo={t.porConvertir.titulo}>
          {porConvertir.length === 0 ? (
            <p className="mostrador__vacio">{t.porConvertir.vacio}</p>
          ) : (
            <ul className="productos productos--filas">
              {porConvertir.map((q) => (
                <li key={q.id} className="porconvertir">
                  <span className="porconvertir__texto">
                    <strong>{nombres.get(q.customerId)?.name ?? '—'}</strong>
                    <span className="porconvertir__folio">{q.folio ?? q.tempFolio ?? ''}</span>
                  </span>
                  <Boton
                    aria-label={`${t.porConvertir.crear} · ${nombres.get(q.customerId)?.name ?? '—'} · ${q.folio ?? q.tempFolio ?? ''}`}
                    disabled={creando === q.id}
                    onClick={() => {
                      void convertir(q);
                    }}
                  >
                    {creando === q.id ? t.porConvertir.creando : t.porConvertir.crear}
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta rotulo={t.filtro.titulo}>
          <div className="filtros__chips" role="group" aria-label={t.filtro.titulo}>
            <button
              type="button"
              className="chip"
              aria-pressed={filtro === null}
              onClick={() => {
                setFiltro(null);
              }}
            >
              {t.filtro.todas} ({String(ordenes.length)})
            </button>
            {ESTADOS.map((estado) => (
              <button
                key={estado}
                type="button"
                className="chip"
                aria-pressed={filtro === estado}
                onClick={() => {
                  setFiltro(estado);
                }}
              >
                {t.estados[estado]} ({String(ordenes.filter((o) => o.status === estado).length)})
              </button>
            ))}
          </div>

          <div className="filtros__campos">
            <Seleccion
              etiqueta={t.filtro.cliente}
              value={clienteFiltro}
              opciones={[
                { valor: '', texto: t.filtro.todos },
                ...[...nombres.values()].map((c) => ({ valor: c.id, texto: c.name })),
              ]}
              onChange={(e) => {
                setClienteFiltro(e.target.value);
              }}
            />
            <Seleccion
              etiqueta={t.filtro.responsable}
              value={responsableFiltro}
              opciones={[
                { valor: '', texto: t.filtro.todos },
                ...props.personas.map((p) => ({ valor: p.id, texto: p.name })),
              ]}
              onChange={(e) => {
                setResponsableFiltro(e.target.value);
              }}
            />
            <Campo
              etiqueta={t.filtro.desde}
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
              }}
            />
            <Campo
              etiqueta={t.filtro.hasta}
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
              }}
            />
          </div>

          {cargado && ordenes.length === 0 ? (
            <EstadoVacio titulo={t.vacioTitulo} descripcion={t.vacio} icono="ordenes" />
          ) : null}
          {cargado && ordenes.length > 0 && visibles.length === 0 ? (
            <p className="mostrador__vacio">{t.filtro.sinResultados}</p>
          ) : null}
          {visibles.length > 0 ? (
            <table className="tabla tabla--apilada" aria-label={t.filtro.titulo}>
              <thead>
                <tr>
                  <th scope="col">{t.tabla.folio}</th>
                  <th scope="col">{t.tabla.cliente}</th>
                  <th scope="col">{t.tabla.estatus}</th>
                  <th scope="col" className="tabla__num">
                    {t.tabla.total}
                  </th>
                  <th scope="col" className="tabla__num">
                    {t.tabla.saldo}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((o) => {
                  const saldo = balanceCents(o.totalCents, pagosDe(o.id));
                  return (
                    <tr key={o.id}>
                      <th scope="row">
                        <Boton
                          variante="secundario"
                          onClick={() => {
                            setAbierta(o.id);
                          }}
                        >
                          {o.folio ?? o.tempFolio}
                        </Boton>
                      </th>
                      <td data-label={t.tabla.cliente}>{nombres.get(o.customerId)?.name ?? '—'}</td>
                      <td data-label={t.tabla.estatus}>
                        <EtiquetaDeEstado
                          tono={TONO_DE_ESTADO[o.status]}
                          texto={t.estados[o.status]}
                        />
                      </td>
                      <td data-label={t.tabla.total} className="tabla__num">
                        {formatearPesos(o.totalCents)}
                      </td>
                      <td data-label={t.tabla.saldo} className="tabla__num">
                        {o.status === 'CANCELLED' ? '—' : formatearPesos(saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </Tarjeta>
      </div>
    </section>
  );
}
