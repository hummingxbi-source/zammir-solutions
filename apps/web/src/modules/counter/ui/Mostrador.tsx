import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import { Link } from 'react-router';
import {
  addToTicket,
  balanceCents,
  cancelCounterSale,
  chargeCounterSale,
  EMPTY_TICKET,
  formatMoney,
  mexicoDate,
  money,
  parseLength,
  registerWorkOrderPayment,
  removeFromTicket,
  searchProducts,
  setTicketQuantity,
  ticketTotals,
  type Authorization,
  type CounterDeps,
  type CounterSale,
  type Customer,
  type CustomerId,
  type ManageCustomersDeps,
  type OrderDeps,
  type Payment,
  type PaymentRowInput,
  type PriceRegistry,
  type ProductReader,
  type QuoteActor,
  type SellableProduct,
  type Ticket,
  type WorkOrder,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { CampoNumerico } from '../../../shared/ui/Campo';
import { Campo } from '../../../shared/ui/Campo';
import { formatearPesos } from '../../../shared/ui/formatos';
import { DialogoDeAutorizacion } from '../../orders/ui/DialogoDeAutorizacion';
import { DialogoDeCobro } from '../../orders/ui/DialogoDeCobro';
import type { AutorizacionDeAdministrador } from '../../quotes/ui/DialogoDeDescuento';

const t = textos.mostrador;

/** Medida máxima aceptada al capturar (10 m), igual que en el cotizador. */
const MEDIDA_MAXIMA_MM = 10_000;

export interface MostradorProps {
  readonly deps: CounterDeps;
  /** Para cobrar el saldo de una orden desde el mostrador [RF-M4-05]. */
  readonly orderDeps: OrderDeps;
  /** Quién usa la tablet ahora; `null` si nadie ha entrado con su PIN. */
  readonly actor: QuoteActor | null;
  readonly catalogo: ProductReader;
  readonly clientes: ManageCustomersDeps;
  readonly registry: PriceRegistry;
  readonly taxRateBps: number;
  readonly autorizacion: AutorizacionDeAdministrador;
  readonly onPorEnviar?: () => void;
  readonly alCambiarElEnvio?: (aviso: () => void) => () => void;
}

type Dialogo =
  | { readonly tipo: 'cobrar-ticket' }
  | { readonly tipo: 'cobrar-saldo'; readonly orden: WorkOrder }
  | { readonly tipo: 'cancelar'; readonly venta: CounterSale }
  | null;

function cobra(centavos: number): string {
  const m = money(centavos);
  return m.ok ? formatMoney(m.value) : '';
}

function horaDeMexico(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Mostrador: venta rápida con ticket actual, cobro (efectivo con cambio, transferencia o mixto), cobro de
 *  saldos de órdenes y las ventas del día [RF-M4-*]. Funciona sin internet: todo se guarda en la tablet. */
export function Mostrador(props: MostradorProps): ReactElement {
  const { deps, orderDeps, actor, catalogo, registry, taxRateBps } = props;
  const [productos, setProductos] = useState<readonly SellableProduct[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<SellableProduct | null>(null);
  const [unidad, setUnidad] = useState<'cm' | 'm'>('cm');
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [ticket, setTicket] = useState<Ticket>(EMPTY_TICKET);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ultima, setUltima] = useState<{ folio: string; cambio: number } | null>(null);
  const [ventas, setVentas] = useState<readonly CounterSale[]>([]);
  const [ordenes, setOrdenes] = useState<readonly WorkOrder[]>([]);
  const [pagos, setPagos] = useState<readonly Payment[]>([]);
  const [clientes, setClientes] = useState<ReadonlyMap<CustomerId, Customer>>(new Map());

  const lineDeps = useMemo(() => ({ registry, taxRateBps }), [registry, taxRateBps]);

  const refrescar = useCallback(async () => {
    setVentas(await deps.sales.list());
    setOrdenes(await orderDeps.orders.list());
    setPagos(await orderDeps.payments.list());
    const c = await props.clientes.customers.list();
    setClientes(new Map((c.ok ? c.value : []).map((x) => [x.id, x])));
  }, [deps.sales, orderDeps, props.clientes]);

  useEffect(() => {
    void catalogo.listSellable().then((r) => {
      setProductos(r.ok ? r.value : []);
    });
  }, [catalogo]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const { alCambiarElEnvio } = props;
  useEffect(() => alCambiarElEnvio?.(() => void refrescar()), [alCambiarElEnvio, refrescar]);

  const encontrados = useMemo(
    () => searchProducts(productos ?? [], { text: busqueda }).slice(0, 12),
    [productos, busqueda],
  );

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
  const persona = actor;

  function mostrarError(codigo: string): void {
    const claveMostrador = codigo in t.errores;
    const claveOrdenes = codigo in textos.ordenes.errores;
    setError(
      claveMostrador
        ? t.errores[codigo as keyof typeof t.errores]
        : claveOrdenes
          ? textos.ordenes.errores[codigo as keyof typeof textos.ordenes.errores]
          : textos.ordenes.errores.STORAGE_FAILED,
    );
  }

  function agregar(evento: SyntheticEvent): void {
    evento.preventDefault();
    if (elegido === null) {
      return;
    }
    setError(null);
    const necesitaMedidas =
      elegido.chargeUnit === 'SQUARE_METER' || elegido.chargeUnit === 'LINEAR_METER';
    const w = necesitaMedidas ? parseLength(ancho, unidad, MEDIDA_MAXIMA_MM) : null;
    const hRequerido = elegido.chargeUnit === 'SQUARE_METER';
    const h =
      hRequerido || (necesitaMedidas && alto.trim() !== '')
        ? parseLength(alto, unidad, MEDIDA_MAXIMA_MM)
        : null;
    if ((w !== null && !w.ok) || (h !== null && !h.ok)) {
      mostrarError('MEASURE_INVALID');
      return;
    }
    const piezas = Number(cantidad);
    const r = addToTicket(
      ticket,
      elegido,
      {
        id: deps.idGenerator.newId<'Line'>(),
        widthMm: w?.ok === true ? w.value : null,
        heightMm: h?.ok === true ? h.value : null,
        quantity: Number.isInteger(piezas) ? piezas : 0,
        displayUnit: unidad,
      },
      lineDeps,
    );
    if (!r.ok) {
      mostrarError(r.error.code);
      return;
    }
    setTicket(r.value);
    setElegido(null);
    setAncho('');
    setAlto('');
    setCantidad('1');
    setUltima(null);
  }

  function elegirProducto(p: SellableProduct): void {
    setError(null);
    const medidas = p.chargeUnit === 'SQUARE_METER' || p.chargeUnit === 'LINEAR_METER';
    if (medidas) {
      setElegido(p);
      return;
    }
    const r = addToTicket(
      ticket,
      p,
      {
        id: deps.idGenerator.newId<'Line'>(),
        widthMm: null,
        heightMm: null,
        quantity: 1,
        displayUnit: 'cm',
      },
      lineDeps,
    );
    if (r.ok) {
      setTicket(r.value);
      setUltima(null);
    } else {
      mostrarError(r.error.code);
    }
  }

  function cambiarCantidad(id: string, nueva: number): void {
    const r = setTicketQuantity(ticket, id, nueva, lineDeps);
    if (r.ok) {
      setTicket(r.value);
    } else {
      mostrarError(r.error.code);
    }
  }

  async function cobrarTicket(filas: readonly PaymentRowInput[]): Promise<string | null> {
    const r = await chargeCounterSale(deps, persona, { ticket, customerId: null, rows: filas });
    if (!r.ok) {
      return r.error.code;
    }
    setTicket(EMPTY_TICKET);
    setDialogo(null);
    setError(null);
    setUltima({ folio: r.value.sale.tempFolio, cambio: r.value.plan.changeCents });
    props.onPorEnviar?.();
    await refrescar();
    return null;
  }

  async function cobrarSaldo(
    orden: WorkOrder,
    filas: readonly PaymentRowInput[],
  ): Promise<string | null> {
    const r = await registerWorkOrderPayment(orderDeps, persona, orden.id, filas);
    if (!r.ok) {
      return r.error.code;
    }
    setDialogo(null);
    setError(null);
    setAviso(textos.ordenes.cobro.registrado);
    props.onPorEnviar?.();
    await refrescar();
    return null;
  }

  async function cancelar(
    venta: CounterSale,
    motivo: string,
    permiso?: Authorization,
  ): Promise<string | null> {
    const r = await cancelCounterSale(deps, persona, venta.id, motivo, permiso);
    if (!r.ok) {
      return r.error.code;
    }
    setDialogo(null);
    props.onPorEnviar?.();
    await refrescar();
    return null;
  }

  const totales = ticketTotals(ticket);
  const medidas = elegido?.chargeUnit === 'SQUARE_METER' || elegido?.chargeUnit === 'LINEAR_METER';
  const hoy = mexicoDate(deps.clock.now());
  const ventasDeHoy = ventas
    .filter((v) => mexicoDate(new Date(v.issuedAt)) === hoy)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const saldoDe = (o: WorkOrder): number =>
    balanceCents(
      o.totalCents,
      pagos.filter((p) => p.targetId === o.id),
    );
  const conSaldo = ordenes.filter((o) => o.status !== 'CANCELLED' && saldoDe(o) > 0);

  return (
    <section className="anima-entrada" aria-labelledby="titulo-mostrador">
      <h1 id="titulo-mostrador">{t.titulo}</h1>
      <p>{t.descripcion}</p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      {ultima !== null ? (
        <div role="status" className="aviso aviso--exito">
          <strong>{t.cobrada.titulo}</strong> · {t.cobrada.folioProvisional} {ultima.folio} ·{' '}
          {t.cobrada.guardada}
          {ultima.cambio > 0 ? ` · ${t.cobrada.cambio} ${formatearPesos(ultima.cambio)}` : ''}
        </div>
      ) : null}

      <h2>{t.venta.titulo}</h2>
      {elegido === null ? (
        <>
          <Campo
            etiqueta={t.venta.buscar}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
            }}
          />
          {productos !== null && productos.length === 0 ? (
            <Aviso tipo="error">{t.venta.catalogoVacio}</Aviso>
          ) : null}
          {busqueda !== '' && encontrados.length === 0 ? <p>{t.venta.sinResultados}</p> : null}
          <ul className="accesos">
            {encontrados.map((p) => (
              <li key={p.id}>
                <Boton
                  variante="secundario"
                  onClick={() => {
                    elegirProducto(p);
                  }}
                >
                  {p.name} · {cobra(p.listPrice)}
                </Boton>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form onSubmit={agregar}>
          <p>
            <strong>{elegido.name}</strong> · {cobra(elegido.listPrice)}
          </p>
          {medidas ? (
            <>
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="unidad-mostrador">
                  {t.venta.unidad}
                </label>
                <select
                  id="unidad-mostrador"
                  value={unidad}
                  onChange={(e) => {
                    setUnidad(e.target.value === 'm' ? 'm' : 'cm');
                  }}
                >
                  <option value="cm">{t.venta.cm}</option>
                  <option value="m">{t.venta.m}</option>
                </select>
              </div>
              <CampoNumerico
                etiqueta={`${t.venta.ancho} (${unidad})`}
                value={ancho}
                onChange={(e) => {
                  setAncho(e.target.value);
                }}
              />
              <CampoNumerico
                etiqueta={`${t.venta.alto} (${unidad})`}
                value={alto}
                onChange={(e) => {
                  setAlto(e.target.value);
                }}
              />
            </>
          ) : null}
          <CampoNumerico
            etiqueta={t.venta.cantidad}
            entero
            value={cantidad}
            onChange={(e) => {
              setCantidad(e.target.value);
            }}
          />
          <Boton type="submit">{t.venta.agregar}</Boton>
          <Boton
            variante="secundario"
            onClick={() => {
              setElegido(null);
            }}
          >
            {t.venta.cancelar}
          </Boton>
        </form>
      )}

      <h2>{t.ticket.titulo}</h2>
      {ticket.lines.length === 0 ? (
        <p>{t.ticket.vacio}</p>
      ) : (
        <>
          <ul className="lineas">
            {ticket.lines.map((l) => (
              <li key={l.id}>
                <strong>{l.name}</strong> · {l.detail} · {cobra(l.lineTotalCents)}
                <div className="acciones">
                  <Boton
                    variante="secundario"
                    aria-label={`${t.ticket.menos}: ${l.name}`}
                    disabled={l.quantity <= 1}
                    onClick={() => {
                      cambiarCantidad(l.id, l.quantity - 1);
                    }}
                  >
                    −
                  </Boton>
                  <span aria-label={`${t.venta.cantidad}: ${l.name}`}>{String(l.quantity)}</span>
                  <Boton
                    variante="secundario"
                    aria-label={`${t.ticket.mas}: ${l.name}`}
                    onClick={() => {
                      cambiarCantidad(l.id, l.quantity + 1);
                    }}
                  >
                    +
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      setTicket(removeFromTicket(ticket, l.id));
                    }}
                  >
                    {t.ticket.quitar}
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
          <dl className="documento__totales">
            <dt>{t.ticket.subtotal}</dt>
            <dd>{cobra(totales.subtotalCents)}</dd>
            <dt>{t.ticket.iva}</dt>
            <dd>{cobra(totales.taxCents)}</dd>
            <dt>{t.ticket.total}</dt>
            <dd>{cobra(totales.totalCents)}</dd>
          </dl>
          {dialogo === null ? (
            <div className="acciones">
              <Boton
                onClick={() => {
                  setError(null);
                  setDialogo({ tipo: 'cobrar-ticket' });
                }}
              >
                {t.ticket.cobrar}
              </Boton>
              <Boton
                variante="secundario"
                onClick={() => {
                  setTicket(EMPTY_TICKET);
                }}
              >
                {t.ticket.vaciar}
              </Boton>
            </div>
          ) : null}
        </>
      )}

      {dialogo?.tipo === 'cobrar-ticket' ? (
        <DialogoDeCobro
          saldoCents={totales.totalCents}
          sugeridoCents={null}
          onRegistrar={cobrarTicket}
          onCancelar={() => {
            setDialogo(null);
          }}
        />
      ) : null}
      {dialogo?.tipo === 'cobrar-saldo' ? (
        <DialogoDeCobro
          saldoCents={saldoDe(dialogo.orden)}
          sugeridoCents={null}
          onRegistrar={(filas) => cobrarSaldo(dialogo.orden, filas)}
          onCancelar={() => {
            setDialogo(null);
          }}
        />
      ) : null}
      {dialogo?.tipo === 'cancelar' ? (
        <DialogoDeAutorizacion
          titulo={t.hoy.cancelar}
          explicacion={t.hoy.motivoCancelar}
          pedirMotivo
          pedirPin={persona.role !== 'ADMIN'}
          autorizacion={props.autorizacion}
          onContinuar={(motivo, permiso) => cancelar(dialogo.venta, motivo, permiso)}
          onCancelar={() => {
            setDialogo(null);
          }}
        />
      ) : null}

      <h2>{t.saldos.titulo}</h2>
      {conSaldo.length === 0 ? (
        <p>{t.saldos.vacio}</p>
      ) : (
        <ul className="accesos">
          {conSaldo.map((o) => (
            <li key={o.id}>
              <Boton
                variante="secundario"
                onClick={() => {
                  setError(null);
                  setAviso(null);
                  setDialogo({ tipo: 'cobrar-saldo', orden: o });
                }}
              >
                {t.saldos.cobrar} · {o.folio ?? o.tempFolio} ·{' '}
                {clientes.get(o.customerId)?.name ?? '—'} · {formatearPesos(saldoDe(o))}
              </Boton>
            </li>
          ))}
        </ul>
      )}

      <h2>{t.hoy.titulo}</h2>
      {ventasDeHoy.length === 0 ? (
        <p>{t.hoy.vacio}</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.hoy.folio}</th>
              <th>{t.hoy.hora}</th>
              <th>{t.hoy.total}</th>
              <th>{t.hoy.estado}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ventasDeHoy.map((v) => (
              <tr key={v.id}>
                <td>{v.folio ?? v.tempFolio}</td>
                <td>{horaDeMexico(v.issuedAt)}</td>
                <td>{cobra(v.totalCents)}</td>
                <td>{v.status === 'COMPLETED' ? t.hoy.completada : t.hoy.cancelada}</td>
                <td>
                  {v.status === 'COMPLETED' && dialogo === null ? (
                    <Boton
                      variante="peligro"
                      onClick={() => {
                        setError(null);
                        setDialogo({ tipo: 'cancelar', venta: v });
                      }}
                    >
                      {t.hoy.cancelar}
                    </Boton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
