import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import {
  buildReceivables,
  defaultPermissionPolicy,
  DEFAULT_OVERDUE_DAYS,
  mexicoDate,
  registerWorkOrderPayment,
  remindReceivable,
  summarizeReceivables,
  type Customer,
  type ManageCustomersDeps,
  type OrderDeps,
  type PaymentRowInput,
  type QuoteActor,
  type ReceivableRow,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { formatearPesos } from '../../../shared/ui/formatos';
import { DialogoDeCobro } from '../../orders/ui/DialogoDeCobro';

const t = textos.cuentas;

export interface CuentasPorCobrarProps {
  readonly deps: OrderDeps;
  /** Quién usa la tablet ahora; `null` si nadie ha entrado con su PIN. */
  readonly actor: QuoteActor | null;
  readonly clientes: ManageCustomersDeps;
  readonly negocio: string;
  /** Días sin pagar a partir de los cuales se resalta una cuenta (PD-33). */
  readonly diasDeAtraso?: number;
  /** Abre un enlace (WhatsApp) en otra pestaña o aplicación. */
  readonly abrirEnlace: (url: string) => void;
  readonly onPorEnviar?: () => void;
  readonly alCambiarElEnvio?: (aviso: () => void) => () => void;
}

/** Cuentas por cobrar: órdenes con saldo y los días que llevan, para saber a quién cobrar primero. Se puede
 *  registrar el pago desde la lista y mandar un recordatorio amable por WhatsApp [RF-M6-01 a RF-M6-04]. */
export function CuentasPorCobrar(props: CuentasPorCobrarProps): ReactElement {
  const { deps, actor, clientes } = props;
  const [filas, setFilas] = useState<readonly ReceivableRow[]>([]);
  const [nombres, setNombres] = useState<ReadonlyMap<string, Customer>>(new Map());
  const [cobrando, setCobrando] = useState<ReceivableRow | null>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const umbral = props.diasDeAtraso ?? DEFAULT_OVERDUE_DAYS;

  const refrescar = useCallback(async () => {
    const [ordenes, pagos, lista] = await Promise.all([
      deps.orders.list(),
      deps.payments.list(),
      clientes.customers.list(),
    ]);
    setFilas(
      buildReceivables({
        orders: ordenes,
        payments: pagos,
        today: mexicoDate(deps.clock.now()),
        overdueDays: umbral,
      }),
    );
    setNombres(new Map((lista.ok ? lista.value : []).map((c) => [c.id, c])));
  }, [deps, clientes, umbral]);

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
          {textos.mostrador.sinPersona}
        </Aviso>
        <Link to="/entrar" className="acceso">
          {textos.mostrador.elegirPersona}
        </Link>
      </section>
    );
  }
  const persona = actor;

  if (defaultPermissionPolicy.check(persona.role, 'REPORTS_AND_RECEIVABLES') === 'DENY') {
    return (
      <section>
        <h1>{t.titulo}</h1>
        <Aviso tipo="error" queHacer={t.soloAdministradores.queHacer}>
          {t.soloAdministradores.mensaje}
        </Aviso>
      </section>
    );
  }

  const resumen = summarizeReceivables(filas);

  async function registrar(
    fila: ReceivableRow,
    pagos: readonly PaymentRowInput[],
  ): Promise<string | null> {
    const r = await registerWorkOrderPayment(deps, persona, fila.orderId, pagos);
    if (!r.ok) {
      return r.error.code;
    }
    setCobrando(null);
    setError(null);
    setAviso(textos.ordenes.cobro.registrado);
    props.onPorEnviar?.();
    await refrescar();
    return null;
  }

  function recordar(fila: ReceivableRow): void {
    setAviso(null);
    const cliente = nombres.get(fila.customerId);
    const r = remindReceivable(
      { openLink: props.abrirEnlace },
      {
        row: fila,
        customerName: cliente?.name ?? '',
        phone: cliente?.phone ?? null,
        businessName: props.negocio,
        template: t.recordatorio.mensaje,
      },
    );
    if (r.ok) {
      setError(null);
      setAviso(t.recordatorio.abierto);
    } else {
      setError(t.recordatorio.sinTelefono);
    }
  }

  return (
    <section className="anima-entrada" aria-labelledby="titulo-cuentas">
      <h1 id="titulo-cuentas">{t.titulo}</h1>
      <p>{t.descripcion(umbral)}</p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <dl className="documento__totales">
        <dt>{t.resumen.porCobrar}</dt>
        <dd>{formatearPesos(resumen.totalBalanceCents)}</dd>
        <dt>{t.resumen.cuentas}</dt>
        <dd>{String(resumen.count)}</dd>
        <dt>{t.resumen.atrasadas}</dt>
        <dd>
          {String(resumen.overdueCount)} · {formatearPesos(resumen.overdueBalanceCents)}
        </dd>
      </dl>

      {filas.length === 0 ? (
        <p>{t.vacio}</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">{t.columnas.cliente}</th>
              <th scope="col">{t.columnas.folio}</th>
              <th scope="col">{t.columnas.saldo}</th>
              <th scope="col">{t.columnas.dias}</th>
              <th scope="col">{t.columnas.acciones}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const cliente = nombres.get(fila.customerId);
              return (
                <tr key={fila.orderId} className={fila.overdue ? 'fila--atrasada' : undefined}>
                  <th scope="row">{cliente?.name ?? t.sinCliente}</th>
                  <td>{fila.folio}</td>
                  <td>{formatearPesos(fila.balanceCents)}</td>
                  <td>
                    {fila.daysOutstanding === null ? t.sinFecha : String(fila.daysOutstanding)}
                    {fila.overdue ? <strong> · {t.atrasada}</strong> : null}
                  </td>
                  <td>
                    {cobrando === null ? (
                      <>
                        <Boton
                          aria-label={`${t.registrarPago} ${fila.folio}`}
                          onClick={() => {
                            setError(null);
                            setAviso(null);
                            setCobrando(fila);
                          }}
                        >
                          {t.registrarPago}
                        </Boton>
                        <Boton
                          variante="secundario"
                          aria-label={`${t.recordatorio.boton} ${fila.folio}`}
                          onClick={() => {
                            recordar(fila);
                          }}
                        >
                          {t.recordatorio.boton}
                        </Boton>
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {cobrando !== null ? (
        <DialogoDeCobro
          saldoCents={cobrando.balanceCents}
          sugeridoCents={null}
          onRegistrar={(pagos) => registrar(cobrando, pagos)}
          onCancelar={() => {
            setCobrando(null);
          }}
        />
      ) : null}
    </section>
  );
}
