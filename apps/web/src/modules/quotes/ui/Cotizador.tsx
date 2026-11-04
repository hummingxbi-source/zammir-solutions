import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import {
  createQuoteDraft,
  displayStatus,
  formatMoney,
  mexicoDate,
  money,
  quoteTotals,
  searchCustomers,
  type BusinessIdentity,
  type Customer,
  type CustomerId,
  type DocumentRenderer,
  type IssueQuoteDeps,
  type ManageCustomersDeps,
  type ProductReader,
  type Quote,
  type QuoteActor,
  type ShareService,
  type DocumentLegal,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { EtiquetaDeEstado, type TonoDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { Icono } from '../../../shared/ui/Icono';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { Campo } from '../../../shared/ui/Campo';
import { ClienteEnCotizador } from './ClienteEnCotizador';
import type { AutorizacionDeAdministrador } from './DialogoDeDescuento';
import { EditorDeCotizacion } from './EditorDeCotizacion';

const t = textos.cotizador;

export interface CotizadorProps {
  readonly deps: IssueQuoteDeps;
  /** Quién usa la tablet ahora; `null` si nadie ha entrado con su PIN. */
  readonly actor: QuoteActor | null;
  readonly catalogo: ProductReader;
  readonly clientes: ManageCustomersDeps;
  readonly renderer: DocumentRenderer;
  readonly share: ShareService;
  readonly negocio: BusinessIdentity;
  readonly condicionesPorDefecto: string;
  /** Aviso y términos para el pie del documento; sin esto se usa el aviso abreviado de prueba. */
  readonly legal?: DocumentLegal;
  readonly autorizacion: AutorizacionDeAdministrador;
  /** Pide que se envíe lo guardado (al emitir o marcar una cotización). */
  readonly onPorEnviar?: () => void;
  /** Avisa cuando el envío cambia (llegó un folio definitivo, salió una operación); devuelve cómo dejar de avisar. */
  readonly alCambiarElEnvio?: (aviso: () => void) => () => void;
}

function cobra(centavos: number): string {
  const m = money(centavos);
  return m.ok ? formatMoney(m.value) : '';
}

/** Pantalla del cotizador: lista de cotizaciones y borradores, cotización nueva y editor [RF-M2-*]. Funciona
 *  sin internet: todo se guarda en la tablet y sale solo al volver la conexión. */
export function Cotizador(props: CotizadorProps): ReactElement {
  const { deps, actor, clientes } = props;
  const [lista, setLista] = useState<readonly Quote[]>([]);
  const [abierta, setAbierta] = useState<Quote | null>(null);
  const [clienteAbierto, setClienteAbierto] = useState<Customer | null>(null);
  const [creando, setCreando] = useState(false);
  const [nombres, setNombres] = useState<ReadonlyMap<CustomerId, Customer>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const refrescar = useCallback(async () => {
    const todas = await deps.store.list();
    setLista([...todas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    // Una cotización ya emitida que está abierta recibe su folio definitivo en cuanto llega.
    setAbierta((actual) =>
      actual === null || actual.status === 'DRAFT'
        ? actual
        : (todas.find((q) => q.id === actual.id) ?? actual),
    );
    const r = await clientes.customers.list();
    setNombres(new Map((r.ok ? r.value : []).map((c) => [c.id, c])));
  }, [deps.store, clientes]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const { alCambiarElEnvio } = props;
  useEffect(() => alCambiarElEnvio?.(() => void refrescar()), [alCambiarElEnvio, refrescar]);

  if (actor === null) {
    return (
      <section>
        <h1>{t.titulo}</h1>
        <Aviso tipo="error" queHacer={t.sinPersona}>
          {textos.personas.errores.DEVICE_NOT_READY.mensaje}
        </Aviso>
        <Link to="/entrar" className="acceso">
          {t.elegirPersona}
        </Link>
      </section>
    );
  }

  async function abrirPara(cliente: Customer, obra: string | null): Promise<void> {
    if (actor === null) {
      return;
    }
    const r = await createQuoteDraft(deps, actor, { customerId: cliente.id, siteAddress: obra });
    if (!r.ok) {
      setError(t.errores[r.error.code].mensaje);
      return;
    }
    setCreando(false);
    setClienteAbierto(cliente);
    setAbierta(r.value);
    await refrescar();
  }

  async function abrir(q: Quote): Promise<void> {
    const r = await clientes.customers.get(q.customerId);
    if (r.ok) {
      setClienteAbierto(r.value);
    }
    setAbierta(q);
  }

  if (abierta !== null && clienteAbierto !== null) {
    return (
      <EditorDeCotizacion
        deps={deps}
        actor={actor}
        quote={abierta}
        cliente={clienteAbierto}
        catalogo={props.catalogo}
        renderer={props.renderer}
        share={props.share}
        negocio={props.negocio}
        condicionesPorDefecto={props.condicionesPorDefecto}
        {...(props.legal === undefined ? {} : { legal: props.legal })}
        autorizacion={props.autorizacion}
        onCambio={(q) => {
          setAbierta(q);
          void refrescar();
        }}
        onPorEnviar={() => props.onPorEnviar?.()}
        onAbrir={(q) => {
          void abrir(q);
        }}
        onVolver={() => {
          setAbierta(null);
          setClienteAbierto(null);
          void refrescar();
        }}
      />
    );
  }

  if (creando) {
    return (
      <section className="anima-entrada">
        <EncabezadoDePagina
          titulo={t.titulo}
          acciones={
            <Boton
              variante="secundario"
              onClick={() => {
                setCreando(false);
              }}
            >
              {t.acciones.volver}
            </Boton>
          }
        />
        <ClienteEnCotizador
          clientes={clientes}
          rol={actor.role}
          onElegir={(c, obra) => {
            void abrirPara(c, obra);
          }}
        />
      </section>
    );
  }

  const borradores = lista.filter((q) => q.status === 'DRAFT' && q.userId === actor.userId);
  const ahora = deps.clock.now();
  // El historial se puede acotar a un cliente (por nombre o WhatsApp), siempre desde lo guardado en la tablet [S2-16].
  const emitidas = lista.filter((q) => q.status !== 'DRAFT');
  const coincidentes = new Set(
    searchCustomers([...nombres.values()], filtro).map((c) => c.id as string),
  );
  const visibles =
    filtro.trim() === '' ? emitidas : emitidas.filter((q) => coincidentes.has(q.customerId));
  const tonoDe = (estado: ReturnType<typeof displayStatus>): TonoDeEstado =>
    estado === 'DRAFT'
      ? 'espera'
      : estado === 'SENT'
        ? 'proceso'
        : estado === 'ACCEPTED'
          ? 'listo'
          : estado === 'REJECTED'
            ? 'cancelado'
            : 'aviso';

  return (
    <section className="anima-entrada">
      <EncabezadoDePagina
        titulo={t.titulo}
        descripcion={t.descripcion}
        acciones={
          <Boton
            onClick={() => {
              setCreando(true);
            }}
          >
            <Icono nombre="cotizador" />
            {t.nueva}
          </Boton>
        }
      />
      {error !== null ? <Aviso tipo="error">{error}</Aviso> : null}

      <div className="cotizador__lista">
        <Tarjeta rotulo={t.borradores}>
          {borradores.length === 0 ? (
            <p className="mostrador__vacio">{t.sinBorradores}</p>
          ) : (
            <ul className="productos productos--filas">
              {borradores.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    className="producto producto--fila"
                    onClick={() => {
                      void abrir(q);
                    }}
                  >
                    <span className="producto__nombre">
                      {nombres.get(q.customerId)?.name ?? '—'}
                    </span>
                    <span className="producto__precio">
                      {cobra(quoteTotals(q.lines).totalCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta rotulo={t.historial.titulo}>
          {emitidas.length === 0 ? (
            <EstadoVacio
              titulo={t.historial.vacioTitulo}
              descripcion={t.historial.vacio}
              icono="cotizador"
            />
          ) : (
            <>
              <Campo
                etiqueta={t.historial.filtrar}
                value={filtro}
                onChange={(e) => {
                  setFiltro(e.target.value);
                }}
              />
              {visibles.length === 0 ? <p>{t.historial.sinResultados}</p> : null}
            </>
          )}
          {visibles.length > 0 ? (
            <table className="tabla tabla--apilada" aria-label={t.historial.titulo}>
              <thead>
                <tr>
                  <th scope="col">{t.historial.folio}</th>
                  <th scope="col">{textos.cotizador.cliente.titulo}</th>
                  <th scope="col">{t.historial.fecha}</th>
                  <th scope="col">{t.historial.estado}</th>
                  <th scope="col" className="tabla__num">
                    {t.historial.total}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((q) => (
                  <tr key={q.id}>
                    <th scope="row">
                      <Boton
                        variante="secundario"
                        onClick={() => {
                          void abrir(q);
                        }}
                      >
                        {q.folio ?? q.tempFolio}
                      </Boton>
                    </th>
                    <td data-label={textos.cotizador.cliente.titulo}>
                      {nombres.get(q.customerId)?.name ?? '—'}
                    </td>
                    <td data-label={t.historial.fecha}>
                      {q.issuedAt === null ? '' : mexicoDate(new Date(q.issuedAt))}
                    </td>
                    <td data-label={t.historial.estado}>
                      <EtiquetaDeEstado
                        tono={tonoDe(displayStatus(q, ahora))}
                        texto={t.estados[displayStatus(q, ahora)]}
                      />
                    </td>
                    <td data-label={t.historial.total} className="tabla__num">
                      {cobra(quoteTotals(q.lines).totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Tarjeta>
      </div>
    </section>
  );
}
