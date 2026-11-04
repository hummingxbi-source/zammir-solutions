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
import { EtiquetaDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { formatearPesos } from '../../../shared/ui/formatos';
import { Icono } from '../../../shared/ui/Icono';
import { Indicador } from '../../../shared/ui/Indicador';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
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
    return <EtiquetaDeEstado tono="listo" texto={c.exacto} />;
  }
  return (
    <EtiquetaDeEstado
      tono={centavos > 0 ? 'aviso' : 'peligro'}
      texto={`${centavos > 0 ? c.sobrante : c.faltante} ${formatearPesos(Math.abs(centavos))}`}
    />
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
    <div className="turno">
      <Tarjeta
        rotulo={t.turno.titulo}
        acciones={
          turno === null ? (
            <EtiquetaDeEstado tono="neutro" texto={t.turnos.cerrado} />
          ) : (
            <EtiquetaDeEstado tono="listo" texto={t.turnos.abierto} />
          )
        }
      >
        {error !== null ? (
          <Aviso tipo="error" queHacer={error.queHacer}>
            {error.mensaje}
          </Aviso>
        ) : null}
        {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

        {turno === null ? (
          <form
            className="turno__abrir"
            onSubmit={(e) => {
              void abrir(e);
            }}
          >
            <p className="turno__aviso">{t.turno.sinTurno}</p>
            <div className="turno__fila">
              <CampoNumerico
                etiqueta={t.turno.fondo}
                value={fondo}
                onChange={(e) => {
                  setFondo(e.target.value);
                }}
              />
              <Boton type="submit">{t.turno.abrir}</Boton>
            </div>
          </form>
        ) : (
          <>
            <p className="turno__aviso">
              {t.turno.abierto} {horaDeMexico(turno.openedAt)} · {t.turno.conFondo}{' '}
              {formatearPesos(turno.openingFloatCents)}
            </p>
            {resumen !== null ? (
              <div className="indicadores">
                <Indicador rotulo={t.turno.cobrado} valor={formatearPesos(resumen.cashCents)} />
                <Indicador
                  rotulo={t.turno.cobradoBanco}
                  valor={formatearPesos(resumen.transferCents)}
                />
                <Indicador
                  rotulo={t.turno.esperado}
                  valor={formatearPesos(resumen.expectedCashCents)}
                  tono="exito"
                />
              </div>
            ) : null}
            {cerrando ? (
              <form
                className="turno__cerrar"
                onSubmit={(e) => {
                  void cerrar(e);
                }}
                aria-label={t.turno.cerrar}
              >
                {pendientes > 0 ? (
                  <Aviso tipo="error">{t.turno.pendientes(pendientes)}</Aviso>
                ) : null}
                <div className="turno__fila">
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
                </div>
              </form>
            ) : (
              <div className="turno__acciones">
                <Boton
                  variante="secundario"
                  onClick={() => {
                    void empezarCierre();
                  }}
                >
                  {t.turno.cerrar}
                </Boton>
              </div>
            )}
          </>
        )}

        {corte !== null ? (
          <section aria-label={t.corte.titulo} role="status" className="turno__corte">
            <h3 className="turno__corte-titulo">
              <Icono nombre="verificar" />
              {t.corte.cerrado} · {horaDeMexico(corte.turno.closedAt ?? corte.turno.updatedAt)}
            </h3>
            <dl className="turno__lista">
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
                <Icono nombre="imprimir" />
                {t.corte.imprimir}
              </Boton>
            ) : null}
          </section>
        ) : null}
      </Tarjeta>

      <div className="turno__rejilla">
        <Tarjeta rotulo={t.turnos.titulo}>
          {turnos.length === 0 ? (
            <p className="mostrador__vacio">{t.turnos.vacio}</p>
          ) : (
            <table className="tabla tabla--apilada" aria-label={t.turnos.titulo}>
              <thead>
                <tr>
                  <th scope="col">{t.turnos.persona}</th>
                  <th scope="col">{t.turnos.apertura}</th>
                  <th scope="col">{t.turnos.estado}</th>
                  <th scope="col">{t.corte.diferencia}</th>
                  <th scope="col">
                    <span className="solo-lectores">{t.hoy.acciones}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">{nombre(x.cashierId)}</th>
                    <td data-label={t.turnos.apertura}>
                      {mexicoDate(new Date(x.openedAt))} {horaDeMexico(x.openedAt)}
                    </td>
                    <td data-label={t.turnos.estado}>
                      <EtiquetaDeEstado
                        tono={x.status === 'OPEN' ? 'listo' : 'entregado'}
                        texto={x.status === 'OPEN' ? t.turnos.abierto : t.turnos.cerrado}
                      />
                      {x.reviewReason !== null ? (
                        <span className="turno__revisar">
                          {' '}
                          {t.corte.revisar} {x.reviewReason}
                        </span>
                      ) : null}
                    </td>
                    <td data-label={t.corte.diferencia}>
                      {x.differenceCents === null ? (
                        '—'
                      ) : (
                        <Diferencia centavos={x.differenceCents} />
                      )}
                    </td>
                    <td className="tabla__acciones">
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
        </Tarjeta>

        {actor.role === 'ADMIN' ? (
          <Tarjeta rotulo={t.dia.titulo}>
            <Campo
              etiqueta={t.dia.fecha}
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
              }}
            />
            {dia === null || dia.shiftCount === 0 ? (
              <p className="mostrador__vacio">{t.dia.sinTurnos}</p>
            ) : (
              <>
                <div className="indicadores">
                  <Indicador rotulo={t.dia.turnos} valor={String(dia.shiftCount)} />
                  <Indicador rotulo={t.dia.efectivo} valor={formatearPesos(dia.cashCents)} />
                  <Indicador
                    rotulo={t.dia.transferencia}
                    valor={formatearPesos(dia.transferCents)}
                  />
                  <Indicador
                    rotulo={t.dia.total}
                    valor={formatearPesos(dia.totalCents)}
                    tono="exito"
                  />
                </div>
                <h3 className="rotulo turno__subtitulo">{t.dia.porCajero}</h3>
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
          </Tarjeta>
        ) : null}
      </div>

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
    </div>
  );
}
