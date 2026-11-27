import { useCallback, useEffect, useMemo, useState } from 'react';
import { PedirEntrarConPin } from '../../identity/ui/PedirEntrarConPin';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  addTicketLineExtra,
  removeTicketLineExtra,
  formatMaxMeasure,
  addToTicket,
  balanceCents,
  cancelCounterSale,
  chargeCounterSale,
  EMPTY_TICKET,
  formatMoney,
  mexicoDate,
  money,
  parseLength,
  parseMoney,
  planRefunds,
  registerWorkOrderPayment,
  removeFromTicket,
  searchProducts,
  shareQuote,
  setTicketLinePrice,
  setTicketQuantity,
  ticketTotals,
  type Authorization,
  type CashDeps,
  type CounterDeps,
  type CounterSale,
  type Customer,
  type CustomerId,
  type DocumentPrinter,
  type DocumentRenderer,
  type ManageCustomersDeps,
  type OrderDeps,
  type Payment,
  type PaymentRowInput,
  type PriceRegistry,
  type ProductReader,
  type QuoteActor,
  type QuoteDocument,
  type SellableProduct,
  type ShareService,
  type Ticket,
  type WorkOrder,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { AccionesDelDocumento } from '../../documents/ui/AccionesDelDocumento';
import { imprimirDocumento } from '../../documents/ui/imprimir-documento';
import { marcarComoImpresa, yaSeImprimio } from '../../documents/ui/registro-de-impresiones';
import { comprobanteDeVenta, type ComprobanteDeVentaDeps } from './comprobante-de-venta';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { EtiquetaDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { PanelDeIndicadores } from '../../../shared/ui/PanelDeIndicadores';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { CampoNumerico } from '../../../shared/ui/Campo';
import { Campo } from '../../../shared/ui/Campo';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { formatearPesos } from '../../../shared/ui/formatos';
import { DialogoDeAutorizacion } from '../../orders/ui/DialogoDeAutorizacion';
import { TurnoDeCaja, type HojaDelCorte, type Persona } from './TurnoDeCaja';
import { DialogoDeCobro } from '../../orders/ui/DialogoDeCobro';
import type { AutorizacionDeAdministrador } from '../../quotes/ui/DialogoDeDescuento';

const t = textos.mostrador;
// Los cargos extra se ven y se capturan igual que en el cotizador [RF-M1-17].
const tx = textos.cotizador.extras;

/** Medida máxima aceptada al capturar (10 m), igual que en el cotizador. */
const MEDIDA_MAXIMA_MM = 10_000;

/** Lo que el mostrador necesita para sacar el comprobante de una venta. */
export interface ComprobanteDelMostrador {
  readonly deps: ComprobanteDeVentaDeps;
  readonly renderer: DocumentRenderer;
  readonly share: ShareService;
  readonly impresora?: DocumentPrinter;
}

export interface MostradorProps {
  readonly deps: CounterDeps;
  /** Turno de caja y corte [S3-16 a S3-19]. */
  readonly cash: CashDeps;
  readonly personas: readonly Persona[];
  /** Para cobrar el saldo de una orden desde el mostrador [RF-M4-05]. */
  readonly orderDeps: OrderDeps;
  /** Quién usa la tablet ahora; `null` si nadie ha entrado con su PIN. */
  readonly actor: QuoteActor | null;
  readonly catalogo: ProductReader;
  readonly clientes: ManageCustomersDeps;
  readonly registry: PriceRegistry;
  readonly taxRateBps: number;
  readonly autorizacion: AutorizacionDeAdministrador;
  /** Comprobante en hoja carta de una venta: enviarlo por WhatsApp o imprimirlo [S4-37, ADR-0040]. */
  readonly comprobante?: ComprobanteDelMostrador;
  /** Hoja del corte de caja en tamaño carta [S4-39, ADR-0040]. */
  readonly corteEnCarta?: HojaDelCorte;
  readonly onPorEnviar?: () => void;
  readonly alCambiarElEnvio?: (aviso: () => void) => () => void;
}

type Dialogo =
  | { readonly tipo: 'cobrar-ticket' }
  | { readonly tipo: 'cobrar-saldo'; readonly orden: WorkOrder }
  | {
      readonly tipo: 'cancelar';
      readonly venta: CounterSale;
      /** Lo que se le devuelve al cliente, por medio de pago [RF-M4-10]. */
      readonly devolucion: string;
    }
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
  // Cargo extra de una línea del ticket (canto, perforación…) [RF-M1-17].
  const [extraDe, setExtraDe] = useState<string | null>(null);
  const [extraId, setExtraId] = useState('');
  const [cantidadExtra, setCantidadExtra] = useState('1');
  // Precio abierto [RF-M1-10]: la línea a la que se le está fijando el precio y lo que se escribió.
  const [precioDe, setPrecioDe] = useState<string | null>(null);
  const [precioTexto, setPrecioTexto] = useState('');
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ultima, setUltima] = useState<{ id: string; folio: string; cambio: number } | null>(null);
  const [ventas, setVentas] = useState<readonly CounterSale[]>([]);
  const [ordenes, setOrdenes] = useState<readonly WorkOrder[]>([]);
  const [pagos, setPagos] = useState<readonly Payment[]>([]);
  const [clientes, setClientes] = useState<ReadonlyMap<CustomerId, Customer>>(new Map());
  const [version, setVersion] = useState(0);

  const lineDeps = useMemo(() => ({ registry, taxRateBps }), [registry, taxRateBps]);

  const refrescar = useCallback(async () => {
    setVentas(await deps.sales.list());
    setOrdenes(await orderDeps.orders.list());
    setPagos(await orderDeps.payments.list());
    const c = await props.clientes.customers.list();
    setClientes(new Map((c.ok ? c.value : []).map((x) => [x.id, x])));
    setVersion((v) => v + 1);
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

  // Los cargos extra no se venden solos: se agregan a una línea del ticket [RF-M1-09, RF-M1-17].
  const extrasDelCatalogo = useMemo(
    () => (productos ?? []).filter((p) => p.kind === 'EXTRA'),
    [productos],
  );
  const encontrados = useMemo(
    () =>
      searchProducts(
        (productos ?? []).filter((p) => p.kind !== 'EXTRA'),
        { text: busqueda },
      ).slice(0, 12),
    [productos, busqueda],
  );

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

  function agregarExtra(lineId: string): void {
    const extra = extrasDelCatalogo.find((p) => p.id === extraId);
    if (extra === undefined) {
      return;
    }
    const piezas = Number(cantidadExtra);
    const r = addTicketLineExtra(
      ticket,
      lineId,
      extra,
      Number.isInteger(piezas) ? piezas : 0,
      lineDeps,
    );
    if (r.ok) {
      setTicket(r.value);
      setExtraDe(null);
      setExtraId('');
      setCantidadExtra('1');
      setError(null);
    } else {
      mostrarError(r.error.code);
    }
  }

  function quitarExtra(lineId: string, productId: SellableProduct['id']): void {
    const r = removeTicketLineExtra(ticket, lineId, productId, lineDeps);
    if (r.ok) {
      setTicket(r.value);
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

  function fijarPrecio(id: string): void {
    const linea = ticket.lines.find((l) => l.id === id);
    const monto = parseMoney(precioTexto);
    if (linea === undefined || !monto.ok || monto.value < linea.catalogPriceCents) {
      setError({
        mensaje: t.ticket.precioDebajo(cobra(linea?.catalogPriceCents ?? 0)),
        queHacer: t.ticket.precioDebajoQueHacer,
      });
      return;
    }
    const r = setTicketLinePrice(ticket, id, monto.value, lineDeps);
    if (r.ok) {
      setTicket(r.value);
      setPrecioDe(null);
      setError(null);
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
    setUltima({
      id: r.value.sale.id,
      folio: r.value.sale.tempFolio,
      cambio: r.value.plan.changeCents,
    });
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

  /** Arma el comprobante en hoja carta de una venta con lo que hay en la tablet [RF-M4-04, ADR-0040]. */
  function comprobanteDe(venta: CounterSale): QuoteDocument | null {
    if (props.comprobante === undefined) {
      return null;
    }
    const cliente = venta.customerId === null ? undefined : clientes.get(venta.customerId);
    return comprobanteDeVenta(props.comprobante.deps, {
      venta,
      pagos: pagos.filter((p) => p.targetType === 'COUNTER_SALE' && p.targetId === venta.id),
      cliente: cliente ?? null,
      cajero: props.personas.find((x) => x.id === venta.userId)?.name ?? '',
    });
  }

  /** Manda el comprobante por WhatsApp: con el menú de compartir del dispositivo y, si no, con un enlace. */
  async function enviarComprobante(idDeVenta: string): Promise<void> {
    const venta = ventas.find((v) => v.id === idDeVenta);
    const documento = venta === undefined ? null : comprobanteDe(venta);
    if (venta === undefined || documento === null || props.comprobante === undefined) {
      return;
    }
    setAviso(textos.documento.acciones.preparando);
    const cliente = venta.customerId === null ? undefined : clientes.get(venta.customerId);
    const mensaje = textos.documento.venta.mensajeWhatsApp(
      cliente?.name ?? '',
      venta.folio ?? venta.tempFolio,
      cobra(venta.totalCents),
    );
    const r = await shareQuote(
      { renderer: props.comprobante.renderer, share: props.comprobante.share },
      documento,
      mensaje,
    );
    if (r.ok) {
      setError(null);
      setAviso(
        r.value === 'SHARED'
          ? textos.cotizador.acciones.compartida
          : r.value === 'FALLBACK'
            ? textos.cotizador.acciones.respaldo
            : null,
      );
    } else {
      setAviso(null);
      setError(textos.documento.acciones.errorDeImpresion);
    }
  }

  /** Abre la impresión del comprobante; la segunda vez que se imprime una venta sale marcada COPIA. */
  async function imprimirComprobanteDeVenta(idDeVenta: string): Promise<void> {
    const venta = ventas.find((v) => v.id === idDeVenta);
    const documento = venta === undefined ? null : comprobanteDe(venta);
    if (venta === undefined || documento === null) {
      return;
    }
    setAviso(null);
    const falla = await imprimirDocumento(props.comprobante?.impresora, documento, {
      copia: yaSeImprimio(venta.id),
    });
    if (falla !== null) {
      setError(falla);
      return;
    }
    marcarComoImpresa(venta.id);
    setError(null);
    setAviso(textos.documento.acciones.impresionAbierta);
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
  const completadasHoy = ventasDeHoy.filter((v) => v.status === 'COMPLETED');
  const canceladasHoy = ventasDeHoy.filter((v) => v.status !== 'COMPLETED');
  const vendidoHoy = completadasHoy.reduce((suma, v) => suma + v.totalCents, 0);
  const conSaldo = ordenes.filter((o) => o.status !== 'CANCELLED' && saldoDe(o) > 0);

  return (
    <section className="anima-entrada mostrador">
      <EncabezadoDePagina titulo={t.titulo} descripcion={t.descripcion} />
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      {ultima !== null ? (
        <div role="status" className="aviso aviso--exito mostrador__cobrada">
          <span>
            <strong>{t.cobrada.titulo}</strong> · {t.cobrada.folioProvisional} {ultima.folio} ·{' '}
            {t.cobrada.guardada}
            {ultima.cambio > 0 ? ` · ${t.cobrada.cambio} ${formatearPesos(ultima.cambio)}` : ''}
          </span>
          {props.comprobante !== undefined ? (
            <AccionesDelDocumento
              onEnviar={() => enviarComprobante(ultima.id)}
              onImprimir={() => imprimirComprobanteDeVenta(ultima.id)}
            />
          ) : null}
        </div>
      ) : null}

      <TurnoDeCaja
        cash={props.cash}
        actor={persona}
        personas={props.personas}
        autorizacion={props.autorizacion}
        version={version}
        {...(props.corteEnCarta === undefined ? {} : { hoja: props.corteEnCarta })}
        {...(props.onPorEnviar === undefined ? {} : { onPorEnviar: props.onPorEnviar })}
      >
        <div className="mostrador__rejilla">
          <div className="mostrador__venta">
            <Tarjeta rotulo={t.venta.titulo}>
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
                  {busqueda !== '' && encontrados.length === 0 ? (
                    <p>{t.venta.sinResultados}</p>
                  ) : null}
                  <ul className="productos">
                    {encontrados.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="producto"
                          onClick={() => {
                            elegirProducto(p);
                          }}
                        >
                          <span className="producto__nombre">{p.name}</span>
                          {p.description === undefined ? null : (
                            <span className="producto__descripcion">{p.description}</span>
                          )}
                          <span className="producto__precio">{cobra(p.listPrice)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <form className="formulario" onSubmit={agregar}>
                  <p className="mostrador__elegido">
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
                          className="campo__entrada"
                          value={unidad}
                          onChange={(e) => {
                            setUnidad(e.target.value === 'm' ? 'm' : 'cm');
                          }}
                        >
                          <option value="cm">{t.venta.cm}</option>
                          <option value="m">{t.venta.m}</option>
                        </select>
                      </div>
                      <div className="formulario__par">
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
                      </div>
                      {formatMaxMeasure(elegido.ruleParams, unidad) === null ? null : (
                        <p className="formulario__ayuda">
                          {t.venta.medidaMaxima} {formatMaxMeasure(elegido.ruleParams, unidad)}
                        </p>
                      )}
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
                  <div className="formulario__acciones">
                    <Boton type="submit">{t.venta.agregar}</Boton>
                    <Boton
                      variante="secundario"
                      onClick={() => {
                        setElegido(null);
                      }}
                    >
                      {t.venta.cancelar}
                    </Boton>
                  </div>
                </form>
              )}
            </Tarjeta>

            <Tarjeta rotulo={t.saldos.titulo}>
              {conSaldo.length === 0 ? (
                <p className="mostrador__vacio">{t.saldos.vacio}</p>
              ) : (
                <ul className="productos productos--filas">
                  {conSaldo.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="producto producto--fila"
                        onClick={() => {
                          setError(null);
                          setAviso(null);
                          setDialogo({ tipo: 'cobrar-saldo', orden: o });
                        }}
                      >
                        <span className="producto__nombre">
                          {t.saldos.cobrar} · {o.folio ?? o.tempFolio} ·{' '}
                          {clientes.get(o.customerId)?.name ?? '—'}
                        </span>
                        <span className="producto__precio">{formatearPesos(saldoDe(o))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>

          <div className="mostrador__lateral">
            <Tarjeta rotulo={t.ticket.titulo}>
              {ticket.lines.length === 0 ? (
                <p className="mostrador__vacio">{t.ticket.vacio}</p>
              ) : (
                <>
                  <ul className="ticket">
                    {ticket.lines.map((l) => (
                      <li key={l.id} className="ticket__linea">
                        <div className="ticket__datos">
                          <strong className="ticket__nombre">{l.name}</strong>
                          <span className="ticket__detalle">
                            {l.detail}
                            {l.isOpenPrice === true && l.unitPriceCents > l.catalogPriceCents
                              ? ` · ${t.ticket.precioFijado}`
                              : ''}
                          </span>
                        </div>
                        <span className="ticket__importe">{cobra(l.lineTotalCents)}</span>
                        {precioDe === l.id ? (
                          <form
                            className="ticket__precio"
                            aria-label={`${t.ticket.fijarPrecio}: ${l.name}`}
                            onSubmit={(e) => {
                              e.preventDefault();
                              fijarPrecio(l.id);
                            }}
                          >
                            <p>{t.ticket.referencia(cobra(l.catalogPriceCents))}</p>
                            <CampoNumerico
                              etiqueta={t.ticket.precioPorUnidad}
                              value={precioTexto}
                              onChange={(e) => {
                                setPrecioTexto(e.target.value);
                              }}
                            />
                            <Boton type="submit">{t.ticket.fijarPrecio}</Boton>
                            <Boton
                              variante="secundario"
                              onClick={() => {
                                setPrecioDe(null);
                              }}
                            >
                              {t.ticket.cancelarPrecio}
                            </Boton>
                          </form>
                        ) : null}
                        <div className="ticket__acciones">
                          {l.isOpenPrice === true ? (
                            <Boton
                              variante="secundario"
                              onClick={() => {
                                setPrecioDe(l.id);
                                setPrecioTexto('');
                              }}
                            >
                              {t.ticket.fijarPrecio}
                            </Boton>
                          ) : null}
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
                          <span
                            className="ticket__cantidad"
                            aria-label={`${t.venta.cantidad}: ${l.name}`}
                          >
                            {String(l.quantity)}
                          </span>
                          <Boton
                            variante="secundario"
                            aria-label={`${t.ticket.mas}: ${l.name}`}
                            onClick={() => {
                              cambiarCantidad(l.id, l.quantity + 1);
                            }}
                          >
                            +
                          </Boton>
                          {extrasDelCatalogo.length > 0 ? (
                            <Boton
                              variante="secundario"
                              aria-label={`${tx.agregar} · ${l.name}`}
                              onClick={() => {
                                setExtraDe(extraDe === l.id ? null : l.id);
                                setExtraId(extrasDelCatalogo[0]?.id ?? '');
                              }}
                            >
                              {tx.agregar}
                            </Boton>
                          ) : null}
                          <Boton
                            variante="secundario"
                            onClick={() => {
                              setTicket(removeFromTicket(ticket, l.id));
                            }}
                          >
                            {t.ticket.quitar}
                          </Boton>
                        </div>
                        {(l.extras ?? []).length > 0 ? (
                          <div className="ticket__extras">
                            {(l.extras ?? []).map((x) => (
                              <Boton
                                key={x.productId}
                                variante="secundario"
                                aria-label={`${tx.quitar} ${x.name} · ${l.name}`}
                                onClick={() => {
                                  quitarExtra(l.id, x.productId);
                                }}
                              >
                                {tx.quitar} {x.name} ({cobra(x.amountCents)})
                              </Boton>
                            ))}
                          </div>
                        ) : null}
                        {extraDe === l.id ? (
                          <div
                            className="ticket__extra"
                            role="group"
                            aria-label={tx.titulo(l.name)}
                          >
                            <Seleccion
                              etiqueta={tx.cual}
                              value={extraId}
                              opciones={extrasDelCatalogo.map((p) => ({
                                valor: p.id,
                                texto: `${p.name} · ${cobra(p.listPrice)} ${tx.porUnidad[p.chargeUnit] ?? ''}`,
                              }))}
                              onChange={(e) => {
                                setExtraId(e.target.value);
                              }}
                            />
                            {extrasDelCatalogo.find((p) => p.id === extraId)?.chargeUnit ===
                            'PIECE' ? (
                              <CampoNumerico
                                etiqueta={tx.cuantas}
                                entero
                                value={cantidadExtra}
                                onChange={(e) => {
                                  setCantidadExtra(e.target.value);
                                }}
                              />
                            ) : null}
                            <Boton
                              onClick={() => {
                                agregarExtra(l.id);
                              }}
                            >
                              {tx.confirmar}
                            </Boton>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <dl className="ticket__totales">
                    <dt>{t.ticket.subtotal}</dt>
                    <dd>{cobra(totales.subtotalCents)}</dd>
                    <dt>{t.ticket.iva}</dt>
                    <dd>{cobra(totales.taxCents)}</dd>
                    <dt className="ticket__total-rotulo">{t.ticket.total}</dt>
                    <dd className="cifra ticket__total">{cobra(totales.totalCents)}</dd>
                  </dl>
                  {dialogo === null ? (
                    <div className="ticket__cobrar">
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
            </Tarjeta>
          </div>
        </div>

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
            explicacion={
              dialogo.devolucion === ''
                ? t.hoy.motivoCancelar
                : `${t.hoy.motivoCancelar} ${t.hoy.seDevuelve(dialogo.devolucion)}`
            }
            pedirMotivo
            pedirPin={persona.role !== 'ADMIN'}
            autorizacion={props.autorizacion}
            onContinuar={(motivo, permiso) => cancelar(dialogo.venta, motivo, permiso)}
            onCancelar={() => {
              setDialogo(null);
            }}
          />
        ) : null}

        <Tarjeta rotulo={t.hoy.titulo}>
          {ventasDeHoy.length === 0 ? (
            <EstadoVacio titulo={t.hoy.vacioTitulo} descripcion={t.hoy.vacio} icono="mostrador" />
          ) : (
            <>
              <PanelDeIndicadores
                compacto
                descripcion={t.hoy.resumen}
                items={[
                  {
                    clave: 'vendido',
                    rotulo: t.hoy.vendido,
                    valor: cobra(vendidoHoy),
                    tono: 'exito',
                  },
                  {
                    clave: 'tickets',
                    rotulo: t.hoy.ticketsRotulo,
                    valor: String(completadasHoy.length),
                  },
                  {
                    clave: 'canceladas',
                    rotulo: t.hoy.canceladas,
                    valor: String(canceladasHoy.length),
                    tono: canceladasHoy.length === 0 ? 'neutro' : 'peligro',
                    detalle: canceladasHoy.length === 0 ? t.hoy.ninguna : t.hoy.noSuman,
                  },
                ]}
              />
              <table className="tabla tabla--apilada" aria-label={t.hoy.titulo}>
                <thead>
                  <tr>
                    <th scope="col">{t.hoy.folio}</th>
                    <th scope="col">{t.hoy.hora}</th>
                    <th scope="col" className="tabla__num">
                      {t.hoy.total}
                    </th>
                    <th scope="col">{t.hoy.estado}</th>
                    <th scope="col">
                      <span className="solo-lectores">{t.hoy.acciones}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ventasDeHoy.map((v) => (
                    <tr key={v.id}>
                      <th scope="row">{v.folio ?? v.tempFolio}</th>
                      <td data-label={t.hoy.hora}>{horaDeMexico(v.issuedAt)}</td>
                      <td data-label={t.hoy.total} className="tabla__num">
                        {cobra(v.totalCents)}
                      </td>
                      <td data-label={t.hoy.estado}>
                        <EtiquetaDeEstado
                          tono={v.status === 'COMPLETED' ? 'listo' : 'cancelado'}
                          texto={v.status === 'COMPLETED' ? t.hoy.completada : t.hoy.cancelada}
                        />
                      </td>
                      <td className="tabla__acciones">
                        {props.comprobante !== undefined ? (
                          <AccionesDelDocumento
                            onEnviar={() => enviarComprobante(v.id)}
                            onImprimir={() => imprimirComprobanteDeVenta(v.id)}
                          />
                        ) : null}
                        {v.status === 'COMPLETED' && dialogo === null ? (
                          <Boton
                            variante="peligro-suave"
                            onClick={() => {
                              setError(null);
                              void deps.payments.listByTarget(v.id).then((pagos) => {
                                setDialogo({
                                  tipo: 'cancelar',
                                  venta: v,
                                  devolucion: planRefunds(pagos)
                                    .map((d) =>
                                      t.hoy.devolucion(
                                        formatearPesos(d.amountCents),
                                        d.method === 'CASH',
                                      ),
                                    )
                                    .join(' y '),
                                });
                              });
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
            </>
          )}
        </Tarjeta>
      </TurnoDeCaja>
    </section>
  );
}
