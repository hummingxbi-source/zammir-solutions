import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import {
  createQuoteDraft,
  displayStatus,
  formatMoney,
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
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
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
      <section>
        <h1>{t.titulo}</h1>
        <ClienteEnCotizador
          clientes={clientes}
          rol={actor.role}
          onElegir={(c, obra) => {
            void abrirPara(c, obra);
          }}
        />
        <Boton
          variante="secundario"
          onClick={() => {
            setCreando(false);
          }}
        >
          {t.acciones.volver}
        </Boton>
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

  return (
    <section className="anima-entrada" aria-labelledby="titulo-cotizador">
      <h1 id="titulo-cotizador">{t.titulo}</h1>
      <p>{t.descripcion}</p>
      {error !== null ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton
        onClick={() => {
          setCreando(true);
        }}
      >
        {t.nueva}
      </Boton>

      <h2>{t.borradores}</h2>
      {borradores.length === 0 ? (
        <p>{t.sinBorradores}</p>
      ) : (
        <ul className="accesos">
          {borradores.map((q) => (
            <li key={q.id}>
              <Boton
                variante="secundario"
                onClick={() => {
                  void abrir(q);
                }}
              >
                {nombres.get(q.customerId)?.name ?? '—'} · {cobra(quoteTotals(q.lines).totalCents)}
              </Boton>
            </li>
          ))}
        </ul>
      )}

      <h2>{t.historial.titulo}</h2>
      {emitidas.length === 0 ? (
        <p>{t.historial.vacio}</p>
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
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.historial.folio}</th>
              <th>{textos.cotizador.cliente.titulo}</th>
              <th>{t.historial.fecha}</th>
              <th>{t.historial.estado}</th>
              <th>{t.historial.total}</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((q) => (
              <tr key={q.id}>
                <td>
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      void abrir(q);
                    }}
                  >
                    {q.folio ?? q.tempFolio}
                  </Boton>
                </td>
                <td>{nombres.get(q.customerId)?.name ?? '—'}</td>
                <td>{q.issuedAt?.slice(0, 10)}</td>
                <td>{t.estados[displayStatus(q, ahora)]}</td>
                <td>{cobra(quoteTotals(q.lines).totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
