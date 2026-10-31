import { useEffect, useMemo, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  addQuoteLine,
  applyQuoteDiscount,
  buildQuoteDocument,
  defaultPermissionPolicy,
  displayStatus,
  duplicateQuote,
  formatMoney,
  issueQuote,
  markQuote,
  money,
  parseLength,
  quoteTotals,
  removeQuoteLine,
  searchProducts,
  shareQuote,
  type Authorization,
  type BusinessIdentity,
  type Customer,
  type DocumentRenderer,
  type IssueQuoteDeps,
  type LengthUnit,
  type ProductReader,
  type Quote,
  type QuoteActor,
  type QuoteError,
  type SellableProduct,
  type ShareService,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';
import { DialogoDeDescuento, type AutorizacionDeAdministrador } from './DialogoDeDescuento';
import { VistaPreviaDeCotizacion } from './VistaPreviaDeCotizacion';

const t = textos.cotizador;
/** Medida máxima aceptada por línea: 10 m (configurable cuando se defina el máximo real). */
const MEDIDA_MAXIMA_MM = 10_000;

export interface EditorDeCotizacionProps {
  readonly deps: IssueQuoteDeps;
  readonly actor: QuoteActor;
  readonly quote: Quote;
  readonly cliente: Customer;
  readonly catalogo: ProductReader;
  readonly renderer: DocumentRenderer;
  readonly share: ShareService;
  readonly negocio: BusinessIdentity;
  readonly condicionesPorDefecto: string;
  readonly autorizacion: AutorizacionDeAdministrador;
  /** La cotización cambió (para refrescar la lista). */
  readonly onCambio: (quote: Quote) => void;
  /** Se guardó algo que debe salir al servidor: pide enviar. */
  readonly onPorEnviar: () => void;
  readonly onAbrir: (quote: Quote) => void;
  readonly onVolver: () => void;
}

function mensajeDe(error: QuoteError): { mensaje: string; queHacer: string } {
  return t.errores[error.code];
}

/** Arma o consulta una cotización: agrega conceptos con su cálculo a la vista, da descuentos con
 *  autorización, muestra el documento en vivo, la emite y la comparte [S2-09 a S2-15]. */
export function EditorDeCotizacion({
  deps,
  actor,
  quote,
  cliente,
  catalogo,
  renderer,
  share,
  negocio,
  condicionesPorDefecto,
  autorizacion,
  onCambio,
  onPorEnviar,
  onAbrir,
  onVolver,
}: EditorDeCotizacionProps): ReactElement {
  const [productos, setProductos] = useState<readonly SellableProduct[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<SellableProduct | null>(null);
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [unidad, setUnidad] = useState<LengthUnit>('cm');
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [descuentoDe, setDescuentoDe] = useState<string | null>(null);
  const [avisoCatalogoCerrado, setAvisoCatalogoCerrado] = useState(false);
  const [pestana, setPestana] = useState<'datos' | 'vista'>('datos');
  const [ocupado, setOcupado] = useState(false);

  const esBorrador = quote.status === 'DRAFT';

  useEffect(() => {
    void catalogo.listSellable().then((r) => {
      setProductos(r.ok ? r.value : []);
    });
  }, [catalogo]);

  const encontrados = useMemo(
    () => searchProducts(productos ?? [], { text: busqueda }).slice(0, 12),
    [productos, busqueda],
  );

  const documento = useMemo(
    () =>
      buildQuoteDocument({
        quote,
        customer: { name: cliente.name, phone: cliente.phone },
        business: negocio,
        privacyNotice: textos.documento.avisoAbreviado,
        defaultConditions: condicionesPorDefecto,
        now: deps.clock.now(),
        provisionalNote: textos.documento.folioProvisional,
        labels: textos.documento.rotulos,
      }),
    [quote, cliente, negocio, condicionesPorDefecto, deps.clock],
  );

  const totales = quoteTotals(quote.lines);
  const cobra = (centavos: number): string => {
    const m = money(centavos);
    return m.ok ? formatMoney(m.value) : '';
  };

  function aplicar(
    resultado: { ok: true; value: Quote } | { ok: false; error: QuoteError },
  ): boolean {
    if (!resultado.ok) {
      setError(mensajeDe(resultado.error));
      return false;
    }
    setError(null);
    onCambio(resultado.value);
    return true;
  }

  async function agregar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    if (elegido === null) {
      return;
    }
    const necesitaMedidas =
      elegido.chargeUnit === 'SQUARE_METER' || elegido.chargeUnit === 'LINEAR_METER';
    const w = necesitaMedidas ? parseLength(ancho, unidad, MEDIDA_MAXIMA_MM) : null;
    const hRequerido = elegido.chargeUnit === 'SQUARE_METER';
    const h =
      hRequerido || (necesitaMedidas && alto.trim() !== '')
        ? parseLength(alto, unidad, MEDIDA_MAXIMA_MM)
        : null;
    if ((w !== null && !w.ok) || (h !== null && !h.ok)) {
      setError(t.errores.MEASURE_INVALID);
      return;
    }
    const piezas = Number(cantidad);
    const r = await addQuoteLine(deps, actor, quote.id, elegido, {
      widthMm: w?.ok === true ? w.value : null,
      heightMm: h?.ok === true ? h.value : null,
      quantity: Number.isInteger(piezas) ? piezas : 0,
      displayUnit: unidad,
    });
    if (aplicar(r)) {
      setElegido(null);
      setAncho('');
      setAlto('');
      setCantidad('1');
    }
  }

  async function quitar(lineId: string): Promise<void> {
    aplicar(await removeQuoteLine(deps, actor, quote.id, lineId));
  }

  async function aplicarDescuento(
    lineId: string,
    precio: number,
    permiso?: Authorization,
  ): Promise<string | null> {
    const r = await applyQuoteDiscount(deps, actor, quote.id, lineId, precio, permiso);
    if (!r.ok) {
      return r.error.code;
    }
    onCambio(r.value);
    setDescuentoDe(null);
    return null;
  }

  async function emitir(): Promise<void> {
    setOcupado(true);
    const r = await issueQuote(deps, actor, quote.id);
    setOcupado(false);
    if (aplicar(r)) {
      onPorEnviar();
    }
  }

  async function marcar(estado: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    const r = await markQuote(deps, actor, quote.id, estado);
    if (aplicar(r)) {
      onPorEnviar();
    }
  }

  async function duplicar(): Promise<void> {
    const r = await duplicateQuote(deps, actor, quote.id, async (id) => {
      const p = await catalogo.findSellable(id as never);
      return p.ok ? p.value : null;
    });
    if (!r.ok) {
      setError(mensajeDe(r.error));
      return;
    }
    if (r.value.omitted.length > 0) {
      setAviso(`${t.acciones.omitidos} ${r.value.omitted.join(', ')}`);
    }
    onCambio(r.value.quote);
    onAbrir(r.value.quote);
  }

  async function compartir(): Promise<void> {
    setAviso(t.acciones.compartiendo);
    const total = cobra(totales.totalCents);
    const mensaje = textos.documento.mensajeWhatsApp(
      cliente.name,
      quote.folio ?? quote.tempFolio ?? '',
      total,
    );
    const r = await shareQuote({ renderer, share }, documento, mensaje);
    if (!r.ok) {
      setAviso(null);
      setError({
        mensaje: t.errores.STORAGE_FAILED.mensaje,
        queHacer: t.errores.STORAGE_FAILED.queHacer,
      });
      return;
    }
    setAviso(
      r.value === 'SHARED'
        ? t.acciones.compartida
        : r.value === 'FALLBACK'
          ? t.acciones.respaldo
          : null,
    );
  }

  const estado = displayStatus(quote, deps.clock.now());
  const lineaConDescuento =
    descuentoDe === null ? undefined : quote.lines.find((l) => l.id === descuentoDe);
  const pedirPin =
    defaultPermissionPolicy.check(actor.role, 'PRICE_OVERRIDE') === 'NEEDS_ADMIN_AUTHORIZATION';
  const medidas = elegido?.chargeUnit === 'SQUARE_METER' || elegido?.chargeUnit === 'LINEAR_METER';

  return (
    <section className="cotizador" aria-labelledby="titulo-editor-cotizacion">
      <Boton variante="secundario" onClick={onVolver}>
        {t.acciones.volver}
      </Boton>
      <h2 id="titulo-editor-cotizacion">
        {t.titulo} · {cliente.name}
      </h2>
      <p>
        <strong>{t.estados[estado]}</strong>
        {quote.tempFolio !== null ? (
          <>
            {' · '}
            {quote.folio ?? `${t.emitir.folioProvisional} ${quote.tempFolio}`}
            {' · '}
            {quote.syncStatus === 'SENT'
              ? textos.sincronizacion.enviado
              : textos.sincronizacion.guardadoEnLaTablet}
          </>
        ) : null}
      </p>

      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <div className="pestanas" role="tablist">
        <Boton
          variante={pestana === 'datos' ? 'primario' : 'secundario'}
          role="tab"
          aria-selected={pestana === 'datos'}
          onClick={() => {
            setPestana('datos');
          }}
        >
          {t.vistaPrevia.pestanaDatos}
        </Boton>
        <Boton
          variante={pestana === 'vista' ? 'primario' : 'secundario'}
          role="tab"
          aria-selected={pestana === 'vista'}
          onClick={() => {
            setPestana('vista');
          }}
        >
          {t.vistaPrevia.pestanaDocumento}
        </Boton>
      </div>

      <div className="cotizador__paneles" data-pestana={pestana}>
        <div className="cotizador__datos">
          {esBorrador ? (
            <>
              {productos !== null && productos.length === 0 && !avisoCatalogoCerrado ? (
                <Aviso tipo="error">
                  {t.catalogoVacio}{' '}
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      setAvisoCatalogoCerrado(true);
                    }}
                  >
                    {t.cerrarAviso}
                  </Boton>
                </Aviso>
              ) : null}
              <h3>{t.producto.titulo}</h3>
              {elegido === null ? (
                <>
                  <Campo
                    etiqueta={t.producto.buscar}
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                    }}
                  />
                  {busqueda !== '' && encontrados.length === 0 ? (
                    <p>{t.producto.sinResultados}</p>
                  ) : null}
                  <ul className="accesos">
                    {encontrados.map((p) => (
                      <li key={p.id}>
                        <Boton
                          variante="secundario"
                          onClick={() => {
                            setElegido(p);
                          }}
                        >
                          {p.name} · {cobra(p.listPrice)}
                        </Boton>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <form onSubmit={(e) => void agregar(e)}>
                  <p>
                    <strong>{elegido.name}</strong> · {cobra(elegido.listPrice)}
                  </p>
                  {medidas ? (
                    <>
                      <div className="campo">
                        <label className="campo__etiqueta" htmlFor="unidad-medidas">
                          {t.producto.unidad}
                        </label>
                        <select
                          id="unidad-medidas"
                          value={unidad}
                          onChange={(e) => {
                            setUnidad(e.target.value === 'm' ? 'm' : 'cm');
                          }}
                        >
                          <option value="cm">{t.producto.cm}</option>
                          <option value="m">{t.producto.m}</option>
                        </select>
                      </div>
                      <CampoNumerico
                        etiqueta={`${t.producto.ancho} (${unidad})`}
                        value={ancho}
                        onChange={(e) => {
                          setAncho(e.target.value);
                        }}
                      />
                      <CampoNumerico
                        etiqueta={`${t.producto.alto} (${unidad})`}
                        value={alto}
                        onChange={(e) => {
                          setAlto(e.target.value);
                        }}
                      />
                    </>
                  ) : null}
                  <CampoNumerico
                    etiqueta={t.producto.cantidad}
                    entero
                    value={cantidad}
                    onChange={(e) => {
                      setCantidad(e.target.value);
                    }}
                  />
                  <Boton type="submit">{t.producto.agregar}</Boton>
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      setElegido(null);
                    }}
                  >
                    {t.descuento.cancelar}
                  </Boton>
                </form>
              )}
            </>
          ) : null}

          <h3>{t.lineas.titulo}</h3>
          {quote.lines.length === 0 ? (
            <p>{t.lineas.vacio}</p>
          ) : (
            <ul className="lineas">
              {quote.lines.map((l) => (
                <li key={l.id}>
                  <strong>{l.name}</strong>
                  <br />
                  <small>{l.detail}</small>
                  {l.unitPriceCents < l.catalogPriceCents ? (
                    <small> · {t.lineas.conDescuento}</small>
                  ) : null}
                  {esBorrador ? (
                    <div>
                      <Boton
                        variante="secundario"
                        onClick={() => {
                          setDescuentoDe(l.id);
                        }}
                      >
                        {t.descuento.boton}
                      </Boton>
                      <Boton
                        variante="peligro"
                        onClick={() => {
                          void quitar(l.id);
                        }}
                      >
                        {t.producto.quitar}
                      </Boton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <dl className="documento__totales">
            <dt>{t.lineas.subtotal}</dt>
            <dd>{cobra(totales.subtotalCents)}</dd>
            <dt>{t.lineas.iva}</dt>
            <dd>{cobra(totales.taxCents)}</dd>
            <dt>
              <strong>{t.lineas.total}</strong>
            </dt>
            <dd>
              <strong>{cobra(totales.totalCents)}</strong>
            </dd>
          </dl>

          {lineaConDescuento !== undefined ? (
            <DialogoDeDescuento
              linea={lineaConDescuento}
              pedirPin={pedirPin}
              autorizacion={autorizacion}
              onAplicar={(precio, permiso) =>
                aplicarDescuento(lineaConDescuento.id, precio, permiso)
              }
              onCancelar={() => {
                setDescuentoDe(null);
              }}
            />
          ) : null}

          {esBorrador ? (
            <Boton disabled={ocupado || quote.lines.length === 0} onClick={() => void emitir()}>
              {ocupado ? t.emitir.emitiendo : t.emitir.boton}
            </Boton>
          ) : (
            <div>
              <Boton onClick={() => void compartir()}>{t.acciones.compartir}</Boton>
              {quote.status === 'SENT' ? (
                <>
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      void marcar('ACCEPTED');
                    }}
                  >
                    {t.acciones.aceptada}
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      void marcar('REJECTED');
                    }}
                  >
                    {t.acciones.rechazada}
                  </Boton>
                </>
              ) : null}
              <Boton variante="secundario" onClick={() => void duplicar()}>
                {t.acciones.duplicar}
              </Boton>
            </div>
          )}
        </div>

        <div className="cotizador__vista">
          <VistaPreviaDeCotizacion documento={documento} titulo={t.vistaPrevia.titulo} />
        </div>
      </div>
    </section>
  );
}
