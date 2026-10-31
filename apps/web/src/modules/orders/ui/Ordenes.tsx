import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import {
  balanceCents,
  convertQuoteToWorkOrder,
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

  const visibles = filtro === null ? ordenes : ordenes.filter((o) => o.status === filtro);

  return (
    <section className="anima-entrada" aria-labelledby="titulo-ordenes">
      <h1 id="titulo-ordenes">{t.titulo}</h1>
      <p>{t.descripcion}</p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}

      <h2>{t.porConvertir.titulo}</h2>
      {porConvertir.length === 0 ? (
        <p>{t.porConvertir.vacio}</p>
      ) : (
        <ul className="accesos">
          {porConvertir.map((q) => (
            <li key={q.id}>
              <Boton
                disabled={creando === q.id}
                onClick={() => {
                  void convertir(q);
                }}
              >
                {creando === q.id ? t.porConvertir.creando : t.porConvertir.crear} ·{' '}
                {nombres.get(q.customerId)?.name ?? '—'} · {q.folio ?? q.tempFolio ?? ''}
              </Boton>
            </li>
          ))}
        </ul>
      )}

      <h2>{t.filtro.titulo}</h2>
      <div className="pestanas" role="group" aria-label={t.filtro.titulo}>
        <Boton
          variante={filtro === null ? 'primario' : 'secundario'}
          aria-pressed={filtro === null}
          onClick={() => {
            setFiltro(null);
          }}
        >
          {t.filtro.todas} ({String(ordenes.length)})
        </Boton>
        {ESTADOS.map((estado) => (
          <Boton
            key={estado}
            variante={filtro === estado ? 'primario' : 'secundario'}
            aria-pressed={filtro === estado}
            onClick={() => {
              setFiltro(estado);
            }}
          >
            {t.estados[estado]} ({String(ordenes.filter((o) => o.status === estado).length)})
          </Boton>
        ))}
      </div>

      {cargado && ordenes.length === 0 ? <p>{t.vacio}</p> : null}
      {visibles.length > 0 ? (
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.tabla.folio}</th>
              <th>{t.tabla.cliente}</th>
              <th>{t.tabla.estatus}</th>
              <th>{t.tabla.total}</th>
              <th>{t.tabla.saldo}</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((o) => {
              const saldo = balanceCents(o.totalCents, pagosDe(o.id));
              return (
                <tr key={o.id}>
                  <td>
                    <Boton
                      variante="secundario"
                      onClick={() => {
                        setAbierta(o.id);
                      }}
                    >
                      {o.folio ?? o.tempFolio}
                    </Boton>
                  </td>
                  <td>{nombres.get(o.customerId)?.name ?? '—'}</td>
                  <td>{t.estados[o.status]}</td>
                  <td>{formatearPesos(o.totalCents)}</td>
                  <td>{o.status === 'CANCELLED' ? '—' : formatearPesos(saldo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
