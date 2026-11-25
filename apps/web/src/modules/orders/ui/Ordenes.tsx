import { useCallback, useEffect, useState } from 'react';
import { PedirEntrarConPin } from '../../identity/ui/PedirEntrarConPin';
import type { ReactElement } from 'react';
import {
  balanceCents,
  convertQuoteToWorkOrder,
  filterWorkOrders,
  isWorkOrderLate,
  mexicoDate,
  partNumber,
  partsOf,
  pendingQuoteLines,
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
import { Ventana } from '../../../shared/ui/Ventana';
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
  readonly onImprimirComprobante?: (
    orden: WorkOrder,
    cliente: Customer | null,
  ) => Promise<string | null>;
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
  // La cotización que se va a convertir: antes se pide la fecha estimada de entrega [RF-M3-09].
  const [porFechar, setPorFechar] = useState<Quote | null>(null);
  const [fechaDeEntrega, setFechaDeEntrega] = useState('');
  const [soloAtrasadas, setSoloAtrasadas] = useState(false);
  // Entrega por partes [RF-M3-10]: qué líneas van en esta parte.
  const [porPartes, setPorPartes] = useState(false);
  const [lineasElegidas, setLineasElegidas] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [cargado, setCargado] = useState(false);

  const refrescar = useCallback(async () => {
    const todas = await deps.orders.list();
    setOrdenes([...todas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setPagos(await deps.payments.list());
    const cotizaciones = await deps.quotes.list();
    setPorConvertir(
      cotizaciones.filter(
        // Aceptadas con líneas que todavía no pasan a una orden (incluye las que van por partes).
        (q) => q.status === 'ACCEPTED' && pendingQuoteLines(q).length > 0,
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
      <section className="anima-entrada">
        <EncabezadoDePagina titulo={t.titulo} />
        <Aviso tipo="error" queHacer={textos.cotizador.sinPersona}>
          {t.sinPersona}
        </Aviso>
        <PedirEntrarConPin>{t.elegirPersona}</PedirEntrarConPin>
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
        partes={partsOf(seleccionada, ordenes)}
        onAbrirOrden={(id) => {
          setAbierta(id);
        }}
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
              onImprimirComprobante: (o: WorkOrder) =>
                props.onImprimirComprobante?.(o, nombres.get(o.customerId) ?? null) ??
                Promise.resolve('PRINT_UNAVAILABLE'),
            })}
      />
    );
  }

  const hoy = mexicoDate(deps.clock.now());

  function pedirFecha(q: Quote): void {
    setError(null);
    setFechaDeEntrega('');
    const pendientes = pendingQuoteLines(q);
    // Si ya salió una parte, lo que sigue también es una parte.
    setPorPartes(pendientes.length < q.lines.length);
    setLineasElegidas(new Set(pendientes.map((l) => l.id)));
    setPorFechar(q);
  }

  async function convertir(q: Quote, fecha: string): Promise<void> {
    if (actor === null) {
      return;
    }
    setError(null);
    setCreando(q.id);
    const r = await convertQuoteToWorkOrder(deps, actor, q.id, {
      estimatedDeliveryDate: fecha,
      ...(porPartes ? { inParts: true, lineIds: [...lineasElegidas] } : {}),
    });
    setCreando(null);
    if (!r.ok) {
      setError(t.errores[r.error.code]);
      return;
    }
    setPorFechar(null);
    props.onPorEnviar?.();
    await refrescar();
    setAbierta(r.value.id);
  }

  const atrasadas = ordenes.filter((o) => isWorkOrderLate(o, hoy)).length;
  const visibles = filterWorkOrders(ordenes, {
    overdue: soloAtrasadas ? { today: hoy } : null,
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
                    {pendingQuoteLines(q).length < q.lines.length ? (
                      <EtiquetaDeEstado
                        tono="aviso"
                        texto={t.partes.faltan(pendingQuoteLines(q).length)}
                      />
                    ) : null}
                  </span>
                  <Boton
                    aria-label={`${t.porConvertir.crear} · ${nombres.get(q.customerId)?.name ?? '—'} · ${q.folio ?? q.tempFolio ?? ''}`}
                    disabled={creando === q.id}
                    onClick={() => {
                      pedirFecha(q);
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
                setSoloAtrasadas(false);
              }}
            >
              {t.filtro.todas} ({String(ordenes.length)})
            </button>
            <button
              type="button"
              className="chip chip--peligro"
              aria-pressed={soloAtrasadas}
              onClick={() => {
                setSoloAtrasadas(!soloAtrasadas);
              }}
            >
              {t.filtro.atrasadas} ({String(atrasadas)})
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
                        {partNumber(o, ordenes) !== null ? (
                          <>
                            {' '}
                            <EtiquetaDeEstado
                              tono="neutro"
                              texto={t.partes.parte(partNumber(o, ordenes) ?? 0)}
                            />
                          </>
                        ) : null}
                        {isWorkOrderLate(o, hoy) ? (
                          <>
                            {' '}
                            <EtiquetaDeEstado tono="peligro" texto={t.atrasada} />
                          </>
                        ) : null}
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

      {porFechar !== null ? (
        <Ventana
          titulo={t.fechaDeEntrega.titulo}
          onCerrar={() => {
            setPorFechar(null);
          }}
          acciones={
            <>
              <Boton
                variante="secundario"
                onClick={() => {
                  setPorFechar(null);
                }}
              >
                {t.fechaDeEntrega.cancelar}
              </Boton>
              <Boton
                disabled={
                  fechaDeEntrega === '' ||
                  creando === porFechar.id ||
                  (porPartes && lineasElegidas.size === 0)
                }
                onClick={() => {
                  void convertir(porFechar, fechaDeEntrega);
                }}
              >
                {creando === porFechar.id ? t.porConvertir.creando : t.fechaDeEntrega.crear}
              </Boton>
            </>
          }
        >
          <p>
            {t.fechaDeEntrega.ayuda(
              nombres.get(porFechar.customerId)?.name ?? '—',
              porFechar.folio ?? porFechar.tempFolio ?? '',
            )}
          </p>
          <Campo
            etiqueta={t.fechaDeEntrega.etiqueta}
            type="date"
            min={hoy}
            required
            value={fechaDeEntrega}
            onChange={(e) => {
              setFechaDeEntrega(e.target.value);
            }}
          />
          <label className="casilla">
            <input
              type="checkbox"
              checked={porPartes}
              // Si ya salió una parte, lo que sigue también lo es.
              disabled={pendingQuoteLines(porFechar).length < porFechar.lines.length}
              onChange={(e) => {
                setPorPartes(e.target.checked);
              }}
            />
            {t.partes.preguntar}
          </label>
          {porPartes ? (
            <fieldset className="partes__lineas">
              <legend>{t.partes.queLineas}</legend>
              {pendingQuoteLines(porFechar).map((l) => (
                <label key={l.id} className="casilla">
                  <input
                    type="checkbox"
                    checked={lineasElegidas.has(l.id)}
                    onChange={(e) => {
                      const nuevas = new Set(lineasElegidas);
                      if (e.target.checked) {
                        nuevas.add(l.id);
                      } else {
                        nuevas.delete(l.id);
                      }
                      setLineasElegidas(nuevas);
                    }}
                  />
                  {l.name} · {l.detail} · {formatearPesos(l.lineTotalCents)}
                </label>
              ))}
            </fieldset>
          ) : null}
          {error !== null ? (
            <Aviso tipo="error" queHacer={error.queHacer}>
              {error.mensaje}
            </Aviso>
          ) : null}
        </Ventana>
      ) : null}
    </section>
  );
}
