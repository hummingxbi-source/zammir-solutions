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
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { EtiquetaDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { Icono } from '../../../shared/ui/Icono';
import { Indicador } from '../../../shared/ui/Indicador';
import { Tabla } from '../../../shared/ui/Tabla';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
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
    <section className="anima-entrada cuentas">
      <EncabezadoDePagina titulo={t.titulo} descripcion={t.descripcion(umbral)} />
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <div className="indicadores">
        <Indicador rotulo={t.resumen.porCobrar} valor={formatearPesos(resumen.totalBalanceCents)} />
        <Indicador rotulo={t.resumen.cuentas} valor={String(resumen.count)} />
        <Indicador
          rotulo={t.resumen.atrasadas}
          valor={`${String(resumen.overdueCount)} · ${formatearPesos(resumen.overdueBalanceCents)}`}
          tono={resumen.overdueCount > 0 ? 'peligro' : 'neutro'}
        />
      </div>

      <Tarjeta rotulo={t.titulo}>
        {filas.length === 0 ? (
          <EstadoVacio titulo={t.vacioTitulo} descripcion={t.vacio} icono="cuentas" />
        ) : (
          <Tabla
            descripcion={t.titulo}
            claveDeFila={(f) => f.orderId}
            filas={filas}
            resaltada={(f) => f.overdue}
            columnas={[
              {
                clave: 'cliente',
                rotulo: t.columnas.cliente,
                celda: (f) => nombres.get(f.customerId)?.name ?? t.sinCliente,
              },
              { clave: 'folio', rotulo: t.columnas.folio, celda: (f) => f.folio },
              {
                clave: 'saldo',
                rotulo: t.columnas.saldo,
                numerica: true,
                celda: (f) => formatearPesos(f.balanceCents),
              },
              {
                clave: 'dias',
                rotulo: t.columnas.dias,
                celda: (f) => (
                  <>
                    {f.daysOutstanding === null ? t.sinFecha : String(f.daysOutstanding)}
                    {f.overdue ? (
                      <>
                        {' '}
                        <EtiquetaDeEstado tono="peligro" texto={t.atrasada} />
                      </>
                    ) : null}
                  </>
                ),
              },
              {
                clave: 'acciones',
                rotulo: t.columnas.acciones,
                celda: (f) =>
                  cobrando === null ? (
                    <span className="tabla__acciones">
                      <Boton
                        aria-label={`${t.registrarPago} ${f.folio}`}
                        onClick={() => {
                          setError(null);
                          setAviso(null);
                          setCobrando(f);
                        }}
                      >
                        {t.registrarPago}
                      </Boton>
                      <Boton
                        variante="secundario"
                        aria-label={`${t.recordatorio.boton} ${f.folio}`}
                        onClick={() => {
                          recordar(f);
                        }}
                      >
                        <Icono nombre="whatsapp" />
                        {t.recordatorio.boton}
                      </Boton>
                    </span>
                  ) : null,
              },
            ]}
          />
        )}
      </Tarjeta>

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
