import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  closeCashShift,
  dayReport,
  mexicoDate,
  openCashShift,
  parseMoney,
  pendingBeforeClose,
  reopenCashShift,
  shiftSummary,
  visibleShifts,
  type Authorization,
  type CashDeps,
  type CashShift,
  type CashShiftSummary,
  type DaySummary,
  type QuoteActor,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';
import { formatearPesos } from '../../../shared/ui/formatos';
import { DialogoDeAutorizacion } from '../../orders/ui/DialogoDeAutorizacion';
import type { AutorizacionDeAdministrador } from '../../quotes/ui/DialogoDeDescuento';

const t = textos.mostrador;

export interface Persona {
  readonly id: string;
  readonly name: string;
}

export interface TurnoDeCajaProps {
  readonly cash: CashDeps;
  readonly actor: QuoteActor;
  readonly personas: readonly Persona[];
  readonly autorizacion: AutorizacionDeAdministrador;
  /** Cambia cada vez que el mostrador cobra algo, para recalcular el corte en pantalla. */
  readonly version: number;
  readonly onPorEnviar?: () => void;
  /** Avisa que el turno cambió (se abrió, se cerró o se reabrió). */
  readonly onCambio?: () => void;
  /** Imprime el resumen del corte en el ticket térmico (S3-20 en adelante). */
  readonly onImprimir?: (turno: CashShift, resumen: CashShiftSummary) => Promise<string | null>;
}

function horaDeMexico(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function aCentavos(texto: string): number | null {
  if (texto.trim() === '') {
    return 0;
  }
  const r = parseMoney(texto);
  return r.ok ? r.value : null;
}

function Diferencia({ centavos }: { readonly centavos: number }): ReactElement {
  const c = textos.mostrador.corte;
  if (centavos === 0) {
    return <strong>{c.exacto}</strong>;
  }
  return (
    <strong>
      {centavos > 0 ? c.sobrante : c.faltante} {formatearPesos(Math.abs(centavos))}
    </strong>
  );
}

/** Turno de caja de la persona: abrir con un fondo opcional, ver el corte al momento, cerrar con el
 *  efectivo contado (avisando si quedan operaciones sin enviar), y —para administradores— reabrir un corte y
 *  ver el corte del día [RF-M4-06]. */
export function TurnoDeCaja(props: TurnoDeCajaProps): ReactElement {
  const { cash, actor, personas } = props;
  const [turno, setTurno] = useState<CashShift | null>(null);
  const [resumen, setResumen] = useState<CashShiftSummary | null>(null);
  const [turnos, setTurnos] = useState<readonly CashShift[]>([]);
  const [fondo, setFondo] = useState('');
  const [contado, setContado] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [corte, setCorte] = useState<{ turno: CashShift; resumen: CashShiftSummary } | null>(null);
  const [reabrir, setReabrir] = useState<CashShift | null>(null);
  const [fecha, setFecha] = useState(() => mexicoDate(cash.clock.now()));
  const [dia, setDia] = useState<DaySummary | null>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    const abierto = await cash.shifts.openFor(actor.userId);
    setTurno(abierto);
    setResumen(abierto === null ? null : await shiftSummary(cash, abierto));
    setTurnos(await visibleShifts(cash, actor));
    if (actor.role === 'ADMIN') {
      const r = await dayReport(cash, actor, fecha);
      setDia(r.ok ? r.value : null);
    }
  }, [cash, actor, fecha]);

  useEffect(() => {
    void refrescar();
  }, [refrescar, props.version]);

  function mostrarError(codigo: string): void {
    const clave = (
      codigo in textos.ordenes.errores ? codigo : 'STORAGE_FAILED'
    ) as keyof typeof textos.ordenes.errores;
    setError(textos.ordenes.errores[clave]);
  }

  async function abrir(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setAviso(null);
    const monto = aCentavos(fondo);
    if (monto === null) {
      mostrarError('AMOUNT_INVALID');
      return;
    }
    const r = await openCashShift(cash, actor, { openingFloatCents: monto });
    if (!r.ok) {
      mostrarError(r.error.code);
      return;
    }
    setFondo('');
    setCorte(null);
    props.onPorEnviar?.();
    props.onCambio?.();
    await refrescar();
  }

  async function empezarCierre(): Promise<void> {
    setError(null);
    setPendientes(await pendingBeforeClose(cash));
    setContado('');
    setCerrando(true);
  }

  async function cerrar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    if (turno === null) {
      return;
    }
    setError(null);
    const monto = aCentavos(contado);
    if (monto === null) {
      mostrarError('AMOUNT_INVALID');
      return;
    }
    const r = await closeCashShift(cash, actor, turno.id, monto);
    if (!r.ok) {
      mostrarError(r.error.code);
      return;
    }
    setCerrando(false);
    setCorte({ turno: r.value.shift, resumen: r.value.summary });
    props.onPorEnviar?.();
    props.onCambio?.();
    await refrescar();
  }

  async function reabrirCorte(
    turnoACerrar: CashShift,
    motivo: string,
    permiso?: Authorization,
  ): Promise<string | null> {
    const r = await reopenCashShift(cash, actor, turnoACerrar.id, motivo, permiso);
    if (!r.ok) {
      return r.error.code;
    }
    setReabrir(null);
    setAviso(t.turnos.reabierto);
    props.onPorEnviar?.();
    props.onCambio?.();
    await refrescar();
    return null;
  }

  const nombre = (id: string): string => personas.find((p) => p.id === id)?.name ?? '—';

  return (
    <section aria-labelledby="titulo-turno">
      <h2 id="titulo-turno">{t.turno.titulo}</h2>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      {turno === null ? (
        <form
          onSubmit={(e) => {
            void abrir(e);
          }}
        >
          <p>{t.turno.sinTurno}</p>
          <CampoNumerico
            etiqueta={t.turno.fondo}
            value={fondo}
            onChange={(e) => {
              setFondo(e.target.value);
            }}
          />
          <Boton type="submit">{t.turno.abrir}</Boton>
        </form>
      ) : (
        <>
          <p>
            {t.turno.abierto} {horaDeMexico(turno.openedAt)} · {t.turno.conFondo}{' '}
            {formatearPesos(turno.openingFloatCents)}
          </p>
          {resumen !== null ? (
            <dl className="documento__totales">
              <dt>{t.turno.cobrado}</dt>
              <dd>{formatearPesos(resumen.cashCents)}</dd>
              <dt>{t.turno.cobradoBanco}</dt>
              <dd>{formatearPesos(resumen.transferCents)}</dd>
              <dt>{t.turno.esperado}</dt>
              <dd>{formatearPesos(resumen.expectedCashCents)}</dd>
            </dl>
          ) : null}
          {cerrando ? (
            <form
              onSubmit={(e) => {
                void cerrar(e);
              }}
              aria-label={t.turno.cerrar}
            >
              {pendientes > 0 ? <Aviso tipo="error">{t.turno.pendientes(pendientes)}</Aviso> : null}
              <CampoNumerico
                etiqueta={t.turno.contado}
                value={contado}
                onChange={(e) => {
                  setContado(e.target.value);
                }}
              />
              <Boton type="submit">{t.turno.confirmarCierre}</Boton>
              <Boton
                variante="secundario"
                onClick={() => {
                  setCerrando(false);
                }}
              >
                {t.turno.cancelar}
              </Boton>
            </form>
          ) : (
            <Boton
              variante="secundario"
              onClick={() => {
                void empezarCierre();
              }}
            >
              {t.turno.cerrar}
            </Boton>
          )}
        </>
      )}

      {corte !== null ? (
        <section aria-label={t.corte.titulo} role="status" className="aviso aviso--exito">
          <h3>
            {t.corte.cerrado} · {horaDeMexico(corte.turno.closedAt ?? corte.turno.updatedAt)}
          </h3>
          <dl className="documento__totales">
            <dt>{t.corte.efectivo}</dt>
            <dd>{formatearPesos(corte.resumen.cashCents)}</dd>
            <dt>{t.corte.transferencia}</dt>
            <dd>{formatearPesos(corte.resumen.transferCents)}</dd>
            <dt>{t.corte.total}</dt>
            <dd>{formatearPesos(corte.resumen.cashCents + corte.resumen.transferCents)}</dd>
            <dt>{t.corte.esperado}</dt>
            <dd>{formatearPesos(corte.resumen.expectedCashCents)}</dd>
            <dt>{t.corte.contado}</dt>
            <dd>{formatearPesos(corte.turno.countedCashCents ?? 0)}</dd>
            <dt>{t.corte.diferencia}</dt>
            <dd>
              <Diferencia centavos={corte.resumen.differenceCents ?? 0} />
            </dd>
            {corte.resumen.cancelledSalesCents > 0 ? (
              <>
                <dt>{t.corte.canceladas}</dt>
                <dd>{formatearPesos(corte.resumen.cancelledSalesCents)}</dd>
              </>
            ) : null}
          </dl>
          {props.onImprimir !== undefined ? (
            <Boton
              variante="secundario"
              onClick={() => {
                void props.onImprimir?.(corte.turno, corte.resumen).then((falla) => {
                  if (falla !== null) {
                    mostrarError(falla);
                  }
                });
              }}
            >
              {t.corte.imprimir}
            </Boton>
          ) : null}
        </section>
      ) : null}

      <h3>{t.turnos.titulo}</h3>
      {turnos.length === 0 ? (
        <p>{t.turnos.vacio}</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.turnos.persona}</th>
              <th>{t.turnos.apertura}</th>
              <th>{t.turnos.estado}</th>
              <th>{t.corte.diferencia}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {turnos.map((x) => (
              <tr key={x.id}>
                <td>{nombre(x.cashierId)}</td>
                <td>
                  {x.openedAt.slice(0, 10)} {horaDeMexico(x.openedAt)}
                </td>
                <td>
                  {x.status === 'OPEN' ? t.turnos.abierto : t.turnos.cerrado}
                  {x.reviewReason !== null ? ` · ${t.corte.revisar} ${x.reviewReason}` : ''}
                </td>
                <td>
                  {x.differenceCents === null ? '—' : <Diferencia centavos={x.differenceCents} />}
                </td>
                <td>
                  {x.status === 'CLOSED' && reabrir === null ? (
                    <Boton
                      variante="secundario"
                      onClick={() => {
                        setError(null);
                        setReabrir(x);
                      }}
                    >
                      {t.turnos.reabrir}
                    </Boton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reabrir !== null ? (
        <DialogoDeAutorizacion
          titulo={t.turnos.reabrir}
          explicacion={t.turnos.motivoReabrir}
          pedirMotivo
          pedirPin={actor.role !== 'ADMIN'}
          autorizacion={props.autorizacion}
          onContinuar={(motivo, permiso) => reabrirCorte(reabrir, motivo, permiso)}
          onCancelar={() => {
            setReabrir(null);
          }}
        />
      ) : null}

      {actor.role === 'ADMIN' ? (
        <section aria-labelledby="titulo-dia">
          <h3 id="titulo-dia">{t.dia.titulo}</h3>
          <Campo
            etiqueta={t.dia.fecha}
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
            }}
          />
          {dia === null || dia.shiftCount === 0 ? (
            <p>{t.dia.sinTurnos}</p>
          ) : (
            <>
              <dl className="documento__totales">
                <dt>{t.dia.turnos}</dt>
                <dd>{String(dia.shiftCount)}</dd>
                <dt>{t.dia.efectivo}</dt>
                <dd>{formatearPesos(dia.cashCents)}</dd>
                <dt>{t.dia.transferencia}</dt>
                <dd>{formatearPesos(dia.transferCents)}</dd>
                <dt>{t.dia.total}</dt>
                <dd>{formatearPesos(dia.totalCents)}</dd>
              </dl>
              <h4>{t.dia.porCajero}</h4>
              <ul className="lineas">
                {dia.byCashier.map((c) => (
                  <li key={c.cashierId}>
                    {nombre(c.cashierId)} · {t.dia.efectivo} {formatearPesos(c.cashCents)} ·{' '}
                    {t.dia.transferencia} {formatearPesos(c.transferCents)} · {t.dia.total}{' '}
                    {formatearPesos(c.totalCents)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}
    </section>
  );
}
