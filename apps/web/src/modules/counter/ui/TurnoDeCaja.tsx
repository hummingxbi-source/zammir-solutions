import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, ReactNode, SyntheticEvent } from 'react';
import {
  closeCashShift,
  closingDifference,
  dayReport,
  mexicoDate,
  openCashShift,
  parseMoney,
  pendingBeforeClose,
  reopenCashShift,
  shiftSummary,
  visibleShifts,
  buildShiftCutSheet,
  shareSheet,
  type Authorization,
  type BusinessIdentity,
  type CashDeps,
  type CashShift,
  type CashShiftSummary,
  type DaySummary,
  type QuoteActor,
  type SheetPrinter,
  type SheetRenderer,
  type ShareService,
  type SummarySheet,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';
import { AccionesDelDocumento } from '../../documents/ui/AccionesDelDocumento';
import { EtiquetaDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { formatearPesos } from '../../../shared/ui/formatos';
import { Icono } from '../../../shared/ui/Icono';
import { Indicador } from '../../../shared/ui/Indicador';
import { PanelDeIndicadores } from '../../../shared/ui/PanelDeIndicadores';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { DialogoDeAutorizacion } from '../../orders/ui/DialogoDeAutorizacion';
import type { AutorizacionDeAdministrador } from '../../quotes/ui/DialogoDeDescuento';

const t = textos.mostrador;

export interface Persona {
  readonly id: string;
  readonly name: string;
}

/** Lo que hace falta para sacar la hoja del corte de caja. */
export interface HojaDelCorte {
  readonly negocio: BusinessIdentity;
  readonly renderer: SheetRenderer;
  readonly share: ShareService;
  readonly impresora?: SheetPrinter;
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
  /** Hoja del corte en tamaño carta: enviarla por WhatsApp o imprimirla [S4-39, ADR-0040]. */
  readonly hoja?: HojaDelCorte;
  /** Lo que va entre el turno y su historial (el mostrador pone aquí la venta): así lo importante queda arriba. */
  readonly children?: ReactNode;
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
  // La diferencia se calcula con lo contado; si no es cero, se pide la explicación
  // antes de cerrar [RF-M4-09].
  const [porExplicar, setPorExplicar] = useState<number | null>(null);
  const [explicacion, setExplicacion] = useState('');
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
    setPorExplicar(null);
    setExplicacion('');
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
    if (porExplicar === null) {
      const revision = await closingDifference(cash, actor, turno.id, monto);
      if (!revision.ok) {
        mostrarError(revision.error.code);
        return;
      }
      if (revision.value.differenceCents !== 0) {
        setPorExplicar(revision.value.differenceCents);
        return;
      }
    }
    const r = await closeCashShift(
      cash,
      actor,
      turno.id,
      monto,
      porExplicar === null ? undefined : explicacion,
    );
    if (!r.ok) {
      mostrarError(r.error.code === 'REASON_REQUIRED' ? 'DIFFERENCE_NOTE_REQUIRED' : r.error.code);
      return;
    }
    setCerrando(false);
    setPorExplicar(null);
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

  /** Arma la hoja del corte de un turno cerrado; `null` si no se puede (turno abierto). */
  function hojaDe(x: { turno: CashShift; resumen: CashShiftSummary }): SummarySheet | null {
    if (props.hoja === undefined) {
      return null;
    }
    const r = buildShiftCutSheet({
      shift: x.turno,
      summary: x.resumen,
      cashierName: nombre(x.turno.cashierId),
      business: props.hoja.negocio,
      labels: textos.documento.corte,
    });
    return r.ok ? r.sheet : null;
  }

  async function enviarCorte(x: { turno: CashShift; resumen: CashShiftSummary }): Promise<void> {
    const hoja = hojaDe(x);
    if (hoja === null || props.hoja === undefined) {
      setError(textos.documento.corte.noSePudo);
      return;
    }
    setAviso(textos.documento.acciones.preparando);
    const dia = mexicoDate(new Date(x.turno.openedAt));
    const r = await shareSheet(
      { renderer: props.hoja.renderer, share: props.hoja.share },
      hoja,
      `Corte-de-caja-${dia}.pdf`,
      textos.documento.corte.mensajeWhatsApp(nombre(x.turno.cashierId), dia),
    );
    if (!r.ok) {
      setAviso(null);
      setError(textos.documento.corte.noSePudo);
      return;
    }
    setError(null);
    setAviso(
      r.value === 'SHARED'
        ? textos.cotizador.acciones.compartida
        : r.value === 'FALLBACK'
          ? textos.cotizador.acciones.respaldo
          : null,
    );
  }

  async function imprimirCorte(x: { turno: CashShift; resumen: CashShiftSummary }): Promise<void> {
    const hoja = hojaDe(x);
    setAviso(null);
    if (hoja === null || props.hoja?.impresora === undefined) {
      setError(textos.documento.acciones.errorDeImpresion);
      return;
    }
    const r = await props.hoja.impresora.print(hoja);
    if (!r.ok) {
      setError(textos.documento.acciones.errorDeImpresion);
      return;
    }
    setError(null);
    setAviso(textos.documento.acciones.impresionAbierta);
  }

  async function verCorte(x: CashShift): Promise<void> {
    setError(null);
    setAviso(null);
    setCorte({ turno: x, resumen: await shiftSummary(cash, x) });
  }

  return (
    <div className="turno">
      <Tarjeta
        rotulo={t.turno.titulo}
        acciones={
          turno === null ? (
            <EtiquetaDeEstado tono="neutro" texto={t.turnos.cerrado} />
          ) : (
            <span className="turno__cabecera">
              <EtiquetaDeEstado tono="listo" texto={t.turnos.abierto} />
              {cerrando ? null : (
                <Boton
                  variante="secundario"
                  onClick={() => {
                    void empezarCierre();
                  }}
                >
                  {t.turno.cerrar}
                </Boton>
              )}
            </span>
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
              <PanelDeIndicadores
                compacto
                descripcion={t.turno.titulo}
                items={[
                  {
                    clave: 'efectivo',
                    rotulo: t.turno.cobrado,
                    valor: formatearPesos(resumen.cashCents),
                  },
                  {
                    clave: 'transferencia',
                    rotulo: t.turno.cobradoBanco,
                    valor: formatearPesos(resumen.transferCents),
                  },
                  {
                    clave: 'esperado',
                    rotulo: t.turno.esperado,
                    valor: formatearPesos(resumen.expectedCashCents),
                    tono: 'exito',
                  },
                ]}
              />
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
                      // Si cambia lo contado, se vuelve a revisar la diferencia.
                      setPorExplicar(null);
                    }}
                  />
                  {porExplicar === null ? (
                    <Boton type="submit">{t.turno.confirmarCierre}</Boton>
                  ) : null}
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      setCerrando(false);
                    }}
                  >
                    {t.turno.cancelar}
                  </Boton>
                </div>
                {porExplicar !== null ? (
                  <div
                    className="turno__explicar"
                    role="group"
                    aria-label={t.turno.explicar.titulo}
                  >
                    <p className="turno__explicar-diferencia">
                      {t.turno.explicar.hay} <Diferencia centavos={porExplicar} />
                    </p>
                    <AreaDeTexto
                      etiqueta={t.turno.explicar.etiqueta}
                      rows={3}
                      maxLength={500}
                      required
                      value={explicacion}
                      onChange={(e) => {
                        setExplicacion(e.target.value);
                      }}
                    />
                    <Boton type="submit">{t.turno.explicar.cerrar}</Boton>
                  </div>
                ) : null}
              </form>
            ) : null}
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
              {corte.turno.differenceNote !== null ? (
                <>
                  <dt>{t.corte.explicacion}</dt>
                  <dd>{corte.turno.differenceNote}</dd>
                </>
              ) : null}
              {corte.resumen.cancelledSalesCents > 0 ? (
                <>
                  <dt>{t.corte.canceladas}</dt>
                  <dd>{formatearPesos(corte.resumen.cancelledSalesCents)}</dd>
                </>
              ) : null}
            </dl>
            {props.hoja !== undefined ? (
              <AccionesDelDocumento
                onEnviar={() => enviarCorte(corte)}
                onImprimir={() => imprimirCorte(corte)}
              />
            ) : null}
          </section>
        ) : null}
      </Tarjeta>

      {props.children}

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
                          {t.corte.revisar}{' '}
                          {textos.ordenes.motivosDeRevision[x.reviewReason] ?? x.reviewReason}
                        </span>
                      ) : null}
                    </td>
                    <td data-label={t.corte.diferencia}>
                      {x.differenceCents === null ? (
                        '—'
                      ) : (
                        <Diferencia centavos={x.differenceCents} />
                      )}
                      {(x.differenceNote ?? null) !== null ? (
                        <span className="turno__nota">{x.differenceNote}</span>
                      ) : null}
                    </td>
                    <td className="tabla__acciones">
                      {x.status === 'CLOSED' && props.hoja !== undefined ? (
                        <Boton
                          variante="secundario"
                          onClick={() => {
                            void verCorte(x);
                          }}
                        >
                          {t.turnos.verCorte}
                        </Boton>
                      ) : null}
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
