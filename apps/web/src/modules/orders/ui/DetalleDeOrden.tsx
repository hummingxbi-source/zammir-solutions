import { useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  advanceWorkOrder,
  balanceCents,
  cancelWorkOrder,
  deliverWorkOrder,
  registerWorkOrderPayment,
  updateWorkOrder,
  type Authorization,
  type Customer,
  type OrderDeps,
  type Payment,
  type PaymentRowInput,
  type QuoteActor,
  type UserId,
  type WorkOrder,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { formatearPesos } from '../../../shared/ui/formatos';
import type { AutorizacionDeAdministrador } from '../../quotes/ui/DialogoDeDescuento';
import { DialogoDeAutorizacion } from './DialogoDeAutorizacion';
import { DialogoDeCobro } from './DialogoDeCobro';

const t = textos.ordenes;

export interface Persona {
  readonly id: string;
  readonly name: string;
}

export interface DetalleDeOrdenProps {
  readonly deps: OrderDeps;
  readonly actor: QuoteActor;
  readonly orden: WorkOrder;
  readonly pagos: readonly Payment[];
  readonly cliente: Customer | null;
  readonly personas: readonly Persona[];
  readonly autorizacion: AutorizacionDeAdministrador;
  /** Se llama después de cada cambio guardado, para refrescar la lista. */
  readonly onCambio: () => void;
  readonly onPorEnviar: () => void;
  readonly onVolver: () => void;
  /** Comprobante de trabajo por WhatsApp (S3-09); sin esto no se ofrece. */
  readonly onComprobante?: (orden: WorkOrder) => Promise<string | null>;
}

type Dialogo = 'cobro' | 'avanzar' | 'entregar' | 'cancelar' | null;

const SIN_ASIGNAR = '';

/** Detalle de una orden: conceptos, totales, saldo, pagos y las acciones del trabajo [RF-M3-*]. */
export function DetalleDeOrden(props: DetalleDeOrdenProps): ReactElement {
  const { deps, actor, orden, pagos, cliente, personas, autorizacion } = props;
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mide, setMide] = useState<string>(orden.measuredBy ?? SIN_ASIGNAR);
  const [fabrica, setFabrica] = useState<string>(orden.builtBy ?? SIN_ASIGNAR);
  const [instala, setInstala] = useState<string>(orden.installedBy ?? SIN_ASIGNAR);
  const [fecha, setFecha] = useState(orden.estimatedDeliveryDate ?? '');
  const [notas, setNotas] = useState(orden.notes ?? '');

  const pagado = pagos.reduce((suma, p) => suma + p.amountCents, 0);
  const saldo = balanceCents(orden.totalCents, pagos);
  const final = orden.status === 'DELIVERED' || orden.status === 'CANCELLED';
  const esAdmin = actor.role === 'ADMIN';
  const opcionesPersona = [
    { valor: SIN_ASIGNAR, texto: t.datos.sinAsignar },
    ...personas.map((p) => ({ valor: p.id, texto: p.name })),
  ];

  function mostrarError(codigo: string): void {
    const clave = (codigo in t.errores ? codigo : 'STORAGE_FAILED') as keyof typeof t.errores;
    setError(t.errores[clave]);
  }

  async function terminado(codigo: string | null, mensaje?: string): Promise<string | null> {
    if (codigo !== null) {
      return codigo;
    }
    setDialogo(null);
    setError(null);
    setAviso(mensaje ?? null);
    props.onCambio();
    props.onPorEnviar();
    return null;
  }

  async function guardarDatos(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setAviso(null);
    const persona = (valor: string): UserId | null =>
      valor === SIN_ASIGNAR ? null : (valor as UserId);
    const parche = {
      ...(persona(mide) !== orden.measuredBy ? { measuredBy: persona(mide) } : {}),
      ...(persona(fabrica) !== orden.builtBy ? { builtBy: persona(fabrica) } : {}),
      ...(persona(instala) !== orden.installedBy ? { installedBy: persona(instala) } : {}),
      ...(fecha !== (orden.estimatedDeliveryDate ?? '')
        ? { estimatedDeliveryDate: fecha === '' ? null : fecha }
        : {}),
      ...(notas !== (orden.notes ?? '') ? { notes: notas } : {}),
    };
    const r = await updateWorkOrder(deps, actor, orden.id, parche);
    if (!r.ok) {
      mostrarError(r.error.code);
      return;
    }
    await terminado(null, t.datos.guardado);
  }

  async function avanzar(permiso?: Authorization): Promise<string | null> {
    const r = await advanceWorkOrder(deps, actor, orden.id, permiso);
    if (!r.ok) {
      if (r.error.code === 'NEEDS_AUTHORIZATION' && permiso === undefined) {
        setDialogo('avanzar');
        return null;
      }
      return r.error.code;
    }
    return terminado(null);
  }

  async function registrar(filas: readonly PaymentRowInput[]): Promise<string | null> {
    const r = await registerWorkOrderPayment(deps, actor, orden.id, filas);
    return terminado(r.ok ? null : r.error.code, textos.ordenes.cobro.registrado);
  }

  const siguiente =
    orden.status === 'WAITING'
      ? t.estados.IN_PROCESS
      : orden.status === 'IN_PROCESS'
        ? t.estados.READY
        : null;

  return (
    <section className="anima-entrada" aria-labelledby="titulo-detalle-orden">
      <h1 id="titulo-detalle-orden">
        {orden.folio ?? orden.tempFolio} · {cliente?.name ?? '—'}
      </h1>
      <p>
        <strong>{t.estados[orden.status]}</strong>
        {orden.folio === null ? ` · ${t.detalle.folioProvisional} ${orden.tempFolio}` : ''} ·{' '}
        {t.detalle.codigo} {orden.publicCode}
      </p>
      {orden.reviewReason !== null ? (
        <Aviso tipo="error">
          {t.detalle.revisar} {t.motivosDeRevision[orden.reviewReason] ?? orden.reviewReason}
        </Aviso>
      ) : null}
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <h2>{t.detalle.conceptos}</h2>
      <ul className="lineas">
        {orden.lines.map((l) => (
          <li key={l.id}>
            <strong>{l.name}</strong> · {l.detail} · {formatearPesos(l.lineTotalCents)}
          </li>
        ))}
      </ul>
      {orden.siteAddress !== null ? (
        <p>
          {t.detalle.obra}: {orden.siteAddress}
        </p>
      ) : null}
      <dl className="documento__totales">
        <dt>{t.detalle.subtotal}</dt>
        <dd>{formatearPesos(orden.subtotalCents)}</dd>
        <dt>{t.detalle.iva}</dt>
        <dd>{formatearPesos(orden.taxCents)}</dd>
        <dt>{t.detalle.total}</dt>
        <dd>{formatearPesos(orden.totalCents)}</dd>
        <dt>{t.detalle.anticipoExigido}</dt>
        <dd>{formatearPesos(orden.depositRequiredCents)}</dd>
        <dt>{t.detalle.pagado}</dt>
        <dd>{formatearPesos(pagado)}</dd>
        <dt>{t.detalle.saldo}</dt>
        <dd>{saldo === 0 ? t.detalle.saldoCero : formatearPesos(saldo)}</dd>
      </dl>

      <h2>{t.detalle.pagos}</h2>
      {pagos.length === 0 ? (
        <p>{t.detalle.sinPagos}</p>
      ) : (
        <ul className="lineas">
          {pagos.map((p) => (
            <li key={p.id}>
              {p.kind === 'DEPOSIT' ? t.detalle.anticipo : t.detalle.saldoPago} ·{' '}
              {p.method === 'CASH' ? t.detalle.efectivo : t.detalle.transferencia} ·{' '}
              {formatearPesos(p.amountCents)}
              {p.changeCents !== null && p.changeCents > 0
                ? ` · ${t.detalle.cambio} ${formatearPesos(p.changeCents)}`
                : ''}
            </li>
          ))}
        </ul>
      )}

      {dialogo === 'cobro' ? (
        <DialogoDeCobro
          saldoCents={saldo}
          sugeridoCents={pagado === 0 ? Math.min(orden.depositRequiredCents, saldo) : null}
          onRegistrar={registrar}
          onCancelar={() => {
            setDialogo(null);
          }}
        />
      ) : null}
      {dialogo === 'avanzar' ? (
        <DialogoDeAutorizacion
          titulo={`${t.acciones.avanzar} ${siguiente ?? ''}`}
          explicacion={t.autorizacion.pedirPinEmpezar}
          pedirMotivo={false}
          pedirPin={!esAdmin}
          autorizacion={autorizacion}
          onContinuar={(_motivo, permiso) => avanzar(permiso)}
          onCancelar={() => {
            setDialogo(null);
          }}
        />
      ) : null}
      {dialogo === 'entregar' ? (
        <DialogoDeAutorizacion
          titulo={t.acciones.entregar}
          explicacion={t.autorizacion.pedirPinEntregar}
          pedirMotivo
          pedirPin={!esAdmin}
          autorizacion={autorizacion}
          onContinuar={async (motivo, permiso) => {
            const r = await deliverWorkOrder(deps, actor, orden.id, {
              reason: motivo,
              ...(permiso === undefined ? {} : { authorization: permiso }),
            });
            return terminado(r.ok ? null : r.error.code);
          }}
          onCancelar={() => {
            setDialogo(null);
          }}
        />
      ) : null}
      {dialogo === 'cancelar' ? (
        <DialogoDeAutorizacion
          titulo={t.acciones.cancelar}
          explicacion={t.autorizacion.pedirPinCancelar}
          pedirMotivo
          pedirPin={!esAdmin}
          autorizacion={autorizacion}
          onContinuar={async (motivo, permiso) => {
            const r = await cancelWorkOrder(deps, actor, orden.id, motivo, permiso);
            return terminado(r.ok ? null : r.error.code);
          }}
          onCancelar={() => {
            setDialogo(null);
          }}
        />
      ) : null}

      {!final && dialogo === null ? (
        <div className="acciones">
          {saldo > 0 ? (
            <Boton
              onClick={() => {
                setDialogo('cobro');
              }}
            >
              {t.acciones.cobrar}
            </Boton>
          ) : null}
          {siguiente !== null ? (
            <Boton
              variante="secundario"
              onClick={() => {
                setError(null);
                void avanzar().then((codigo) => {
                  if (codigo !== null) {
                    mostrarError(codigo);
                  }
                });
              }}
            >
              {t.acciones.avanzar} {siguiente}
            </Boton>
          ) : null}
          {orden.status === 'READY' ? (
            <Boton
              variante="secundario"
              onClick={() => {
                setError(null);
                if (saldo > 0) {
                  setDialogo('entregar');
                  return;
                }
                void deliverWorkOrder(deps, actor, orden.id).then((r) => {
                  if (!r.ok) {
                    mostrarError(r.error.code);
                    return;
                  }
                  void terminado(null);
                });
              }}
            >
              {t.acciones.entregar}
            </Boton>
          ) : null}
          <Boton
            variante="peligro"
            onClick={() => {
              setDialogo('cancelar');
            }}
          >
            {t.acciones.cancelar}
          </Boton>
        </div>
      ) : null}

      {props.onComprobante !== undefined && orden.status !== 'CANCELLED' ? (
        <Boton
          variante="secundario"
          onClick={() => {
            setAviso(t.acciones.preparando);
            void props.onComprobante?.(orden).then((falla) => {
              if (falla === null) {
                setAviso(t.acciones.compartido);
              } else {
                setAviso(null);
                mostrarError(falla);
              }
            });
          }}
        >
          {t.acciones.comprobante}
        </Boton>
      ) : null}

      {orden.status !== 'CANCELLED' ? (
        <form
          onSubmit={(e) => {
            void guardarDatos(e);
          }}
          aria-label={t.datos.titulo}
        >
          <h2>{t.datos.titulo}</h2>
          <Seleccion
            etiqueta={t.datos.mide}
            value={mide}
            opciones={opcionesPersona}
            onChange={(e) => {
              setMide(e.target.value);
            }}
          />
          <Seleccion
            etiqueta={t.datos.fabrica}
            value={fabrica}
            opciones={opcionesPersona}
            onChange={(e) => {
              setFabrica(e.target.value);
            }}
          />
          <Seleccion
            etiqueta={t.datos.instala}
            value={instala}
            opciones={opcionesPersona}
            onChange={(e) => {
              setInstala(e.target.value);
            }}
          />
          <Campo
            etiqueta={t.datos.fecha}
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
            }}
          />
          <AreaDeTexto
            etiqueta={t.datos.notas}
            rows={3}
            value={notas}
            onChange={(e) => {
              setNotas(e.target.value);
            }}
          />
          <Boton type="submit">{t.datos.guardar}</Boton>
        </form>
      ) : null}

      <Boton variante="secundario" onClick={props.onVolver}>
        {t.detalle.volver}
      </Boton>
    </section>
  );
}
