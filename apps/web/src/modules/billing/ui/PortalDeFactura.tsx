import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  formatDate,
  isValidRfc,
  isValidZip,
  normalizeFolio,
  normalizeVerificationCode,
  PORTAL_CFDI_USES,
  regimesForRfc,
  type PortalArchivo,
  type PortalConsulta,
  type PortalConsultaResultado,
  type PortalDescarga,
  type PortalDocument,
  type PortalSolicitud,
  type PortalSolicitudResultado,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { Tabla } from '../../../shared/ui/Tabla';
import { formatearPesos } from '../../../shared/ui/formatos';

const t = textos.portal;

export interface PortalDeFacturaProps {
  readonly consultar: PortalConsulta;
  readonly solicitar: PortalSolicitud;
  readonly descargar: PortalDescarga;
  /** Folio y código que trae el QR; la persona también puede teclearlos [RF-M10-09]. */
  readonly inicial?: { readonly folio: string; readonly code: string };
  /** Llave pública de Turnstile; sin ella no se muestra la verificación externa. */
  readonly siteKey?: string | null;
  /** Hora en milisegundos; solo cambia en las pruebas. */
  readonly ahora?: () => number;
  /** Nombre del negocio para el encabezado; nulo mientras no se defina (PD-11). */
  readonly negocio?: string | null;
  /** Identificador único de cada solicitud; solo cambia en las pruebas. */
  readonly nuevoId?: () => string;
  /** Entrega el archivo descargado a la persona; solo cambia en las pruebas. */
  readonly guardarArchivo?: (archivo: PortalArchivo) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        contenedor: HTMLElement,
        opciones: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
        },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Verificación ligera del servicio externo (Cloudflare Turnstile): solo si hay llave pública. Entrega un
 *  token de un solo uso que el servidor comprueba [RF-M10-11]. */
function VerificacionExterna({
  siteKey,
  alCambiar,
}: {
  readonly siteKey: string;
  readonly alCambiar: (token: string | null) => void;
}): ReactElement {
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let idDelWidget: string | null = null;
    const dibujar = (): void => {
      if (contenedor.current !== null && window.turnstile !== undefined && idDelWidget === null) {
        idDelWidget = window.turnstile.render(contenedor.current, {
          sitekey: siteKey,
          callback: (token) => {
            alCambiar(token);
          },
          'expired-callback': () => {
            alCambiar(null);
          },
        });
      }
    };
    if (window.turnstile !== undefined) {
      dibujar();
    } else {
      const guion = document.createElement('script');
      guion.src = SCRIPT_TURNSTILE;
      guion.async = true;
      guion.onload = dibujar;
      document.head.appendChild(guion);
    }
    return () => {
      if (idDelWidget !== null) {
        window.turnstile?.remove(idDelWidget);
      }
    };
  }, [siteKey, alCambiar]);
  return <div ref={contenedor} className="portal__verificacion" aria-label={t.verificando} />;
}

type Paso = 'ticket' | 'datos' | 'factura';

function Pasos({ actual }: { readonly actual: Paso }): ReactElement {
  const pasos: readonly { id: Paso; texto: string }[] = [
    { id: 'ticket', texto: t.pasos.ticket },
    { id: 'datos', texto: t.pasos.datos },
    { id: 'factura', texto: t.pasos.factura },
  ];
  return (
    <ol className="portal__pasos" aria-label={t.pasos.etiqueta}>
      {pasos.map((paso, indice) => (
        <li
          key={paso.id}
          className={paso.id === actual ? 'portal__paso portal__paso--actual' : 'portal__paso'}
          aria-current={paso.id === actual ? 'step' : undefined}
        >
          <span className="portal__numero" aria-hidden="true">
            {indice + 1}
          </span>
          {paso.texto}
        </li>
      ))}
    </ol>
  );
}

interface ErrorVisible {
  readonly mensaje: string;
  readonly queHacer: string;
}

function esperaEnMinutos(segundos: number): number {
  return Math.max(1, Math.ceil(segundos / 60));
}

function errorDeConsulta(r: PortalConsultaResultado): ErrorVisible | null {
  switch (r.kind) {
    case 'OK':
      return null;
    case 'NOT_AVAILABLE':
      return t.errores.NOT_AVAILABLE;
    case 'BLOCKED':
      return {
        mensaje: t.errores.BLOCKED.mensaje,
        queHacer: t.errores.BLOCKED.queHacer(esperaEnMinutos(r.retryAfterSeconds)),
      };
    case 'INELIGIBLE':
      return t.inelegible[r.reason];
    case 'NO_NETWORK':
      return t.errores.NO_NETWORK;
    case 'UNAVAILABLE':
      return t.errores.UNAVAILABLE;
  }
}

/** Mensaje de una solicitud que no terminó en factura. Los datos inválidos no salen aquí: se marcan en su campo. */
function errorDeSolicitud(r: PortalSolicitudResultado): ErrorVisible | null {
  switch (r.kind) {
    case 'STAMPED':
    case 'INVALID':
    case 'PRIVACY_NOT_ACCEPTED':
      return null;
    case 'IN_PROCESS':
      return t.resultado.procesando;
    case 'PAYMENT_FORM_UNDEFINED':
      return t.solicitud.PAYMENT_FORM_UNDEFINED;
    case 'NOT_BILLABLE':
      return t.solicitud.NOT_BILLABLE;
    case 'REJECTED':
      return t.solicitud.REJECTED;
    case 'NOT_AVAILABLE':
      return t.errores.NOT_AVAILABLE;
    case 'BLOCKED':
      return {
        mensaje: t.errores.BLOCKED.mensaje,
        queHacer: t.errores.BLOCKED.queHacer(esperaEnMinutos(r.retryAfterSeconds)),
      };
    case 'INELIGIBLE':
      return r.reason === 'CANCELLED' ||
        r.reason === 'ALREADY_INVOICED' ||
        r.reason === 'NOT_SETTLED' ||
        r.reason === 'EXPIRED'
        ? t.inelegible[r.reason]
        : t.errores.UNAVAILABLE;
    case 'NO_NETWORK':
      return t.errores.NO_NETWORK;
    case 'UNAVAILABLE':
      return t.errores.UNAVAILABLE;
  }
}

/** Baja un archivo en el navegador: arma el archivo con lo que devolvió el servidor y lo entrega. */
function guardarEnElNavegador(archivo: PortalArchivo): void {
  const bytes =
    archivo.encoding === 'base64'
      ? Uint8Array.from(atob(archivo.content), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(archivo.content);
  const url = URL.createObjectURL(new Blob([bytes], { type: archivo.contentType }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.filename;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function CampoTrampa({
  valor,
  alCambiar,
}: {
  readonly valor: string;
  readonly alCambiar: (valor: string) => void;
}): ReactElement {
  return (
    // Las personas no lo ven ni lo llenan; un programa suele llenarlo todo [RF-M10-11].
    <div className="portal__trampa" aria-hidden="true">
      <label>
        Sitio web
        <input
          type="text"
          name="sitio_web"
          tabIndex={-1}
          autoComplete="off"
          value={valor}
          onChange={(e) => {
            alCambiar(e.target.value);
          }}
        />
      </label>
    </div>
  );
}

/** Portal público de autofacturación en tres pasos: el ticket (folio y código), los datos fiscales y la
 *  factura lista para descargar [RF-M10-09, RF-M10-12 a RF-M10-14, RF-M10-16, S4-18, S4-19]. Va fuera del
 *  marco de la aplicación y está pensado para personas mayores o poco familiarizadas con la tecnología:
 *  pocos pasos, botones grandes y mensajes que dicen qué hacer. */
export function PortalDeFactura({
  consultar,
  solicitar,
  descargar,
  inicial,
  siteKey = null,
  ahora = () => Date.now(),
  negocio = null,
  nuevoId = () => crypto.randomUUID(),
  guardarArchivo = guardarEnElNavegador,
}: PortalDeFacturaProps): ReactElement {
  const [paso, setPaso] = useState<Paso>('ticket');
  const [folio, setFolio] = useState(inicial?.folio ?? '');
  const [codigo, setCodigo] = useState(inicial?.code ?? '');
  const [trampa, setTrampa] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<ErrorVisible | null>(null);
  const [documento, setDocumento] = useState<PortalDocument | null>(null);

  const [rfc, setRfc] = useState('');
  const [nombre, setNombre] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [regimen, setRegimen] = useState('');
  const [uso, setUso] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [campos, setCampos] = useState<readonly string[]>([]);
  const [factura, setFactura] = useState<{ folio: string } | null>(null);
  const [avisoDeDescarga, setAvisoDeDescarga] = useState<string | null>(null);

  // Se calculan una sola vez, al abrir la página: la hora de apertura y el identificador de la solicitud.
  const [horaDeApertura] = useState(ahora);
  const [idDeSolicitud] = useState(nuevoId);
  const abierto = useRef(horaDeApertura);
  const idBase = useId();

  const alCambiarToken = useCallback((nuevo: string | null) => {
    setToken(nuevo);
  }, []);

  /** Cada llamada al servidor lleva el folio y el código normalizados y las señales contra automatización. */
  function entrada() {
    return {
      folio: normalizeFolio(folio) ?? folio,
      code: normalizeVerificationCode(codigo) ?? codigo,
      honeypot: trampa,
      elapsedMs: ahora() - abierto.current,
      token,
    };
  }

  /** El token de Turnstile es de un solo uso: tras cada llamada se pide uno nuevo. */
  function renovarVerificacion(): void {
    if (siteKey !== null) {
      setToken(null);
      setVuelta((n) => n + 1);
    }
  }

  async function revisarTicket(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setTrabajando(true);
    setError(null);
    const r = await consultar(entrada());
    setTrabajando(false);
    renovarVerificacion();
    if (r.kind === 'OK') {
      setDocumento(r.document);
      abierto.current = ahora();
      setPaso('datos');
      return;
    }
    setError(errorDeConsulta(r));
  }

  function camposInvalidos(): readonly string[] {
    const malos: string[] = [];
    if (!isValidRfc(rfc.replace(/\s/g, '').toUpperCase())) {
      malos.push('recipient.rfc');
    }
    if (nombre.trim() === '') {
      malos.push('recipient.name');
    }
    if (!isValidZip(codigoPostal.trim())) {
      malos.push('recipient.fiscalZip');
    }
    if (regimen === '') {
      malos.push('recipient.regime');
    }
    if (uso === '') {
      malos.push('recipient.cfdiUse');
    }
    if (!acepto) {
      malos.push('privacy');
    }
    return malos;
  }

  async function pedirFactura(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    const malos = camposInvalidos();
    setCampos(malos);
    if (malos.length > 0) {
      return;
    }
    setTrabajando(true);
    const r = await solicitar({
      ...entrada(),
      requestId: idDeSolicitud,
      acceptedPrivacy: acepto,
      recipient: {
        rfc: rfc.replace(/\s/g, '').toUpperCase(),
        name: nombre.trim(),
        fiscalZip: codigoPostal.trim(),
        regime: regimen,
        cfdiUse: uso,
      },
    });
    setTrabajando(false);
    renovarVerificacion();
    if (r.kind === 'STAMPED') {
      setFactura({ folio: r.folio });
      abierto.current = ahora();
      setPaso('factura');
      return;
    }
    if (r.kind === 'INVALID') {
      setCampos(r.fields);
      return;
    }
    if (r.kind === 'PRIVACY_NOT_ACCEPTED') {
      setCampos(['privacy']);
      return;
    }
    setError(errorDeSolicitud(r));
  }

  async function bajar(formato: 'pdf' | 'xml'): Promise<void> {
    setTrabajando(true);
    setError(null);
    setAvisoDeDescarga(null);
    const r = await descargar(entrada(), formato);
    setTrabajando(false);
    renovarVerificacion();
    if (r.kind === 'FILE') {
      guardarArchivo(r.file);
      setAvisoDeDescarga(t.resultado.descargada(r.file.filename));
      return;
    }
    if (r.kind === 'BLOCKED') {
      setError({
        mensaje: t.errores.BLOCKED.mensaje,
        queHacer: t.errores.BLOCKED.queHacer(esperaEnMinutos(r.retryAfterSeconds)),
      });
      return;
    }
    setError(
      r.kind === 'NO_NETWORK'
        ? t.errores.NO_NETWORK
        : r.kind === 'NOT_AVAILABLE'
          ? t.errores.NOT_AVAILABLE
          : t.errores.UNAVAILABLE,
    );
  }

  const mensajesDeCampo: Readonly<Record<string, string>> = t.datos.errores;
  const errorDelCampo = (campo: string): string | undefined =>
    campos.includes(campo) ? mensajesDeCampo[campo] : undefined;
  const conError = (campo: string): { error?: string } => {
    const mensaje = errorDelCampo(campo);
    return mensaje === undefined ? {} : { error: mensaje };
  };
  const regimenes = regimesForRfc(rfc);
  const faltaVerificar = siteKey !== null && token === null;
  const verificacion =
    siteKey === null ? null : (
      <VerificacionExterna key={vuelta} siteKey={siteKey} alCambiar={alCambiarToken} />
    );
  const avisoDeError =
    error === null ? null : (
      <Aviso tipo="error" queHacer={error.queHacer}>
        {error.mensaje}
      </Aviso>
    );
  const enProceso = error?.mensaje === t.resultado.procesando.mensaje;

  return (
    <main className="publica portal">
      <article className="publica__hoja">
        <p className="rotulo publica__negocio">{negocio ?? textos.app.nombre}</p>
        <h1>{paso === 'factura' ? t.resultado.titulo : t.titulo}</h1>
        <Pasos actual={paso} />

        {paso === 'ticket' ? (
          <>
            <p>{t.descripcion}</p>
            <form
              className="formulario"
              onSubmit={(e) => {
                void revisarTicket(e);
              }}
            >
              <Campo
                etiqueta={t.folio}
                value={folio}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby={`${idBase}-folio`}
                onChange={(e) => {
                  setFolio(e.target.value);
                }}
              />
              <p id={`${idBase}-folio`} className="portal__ayuda">
                {t.folioAyuda}
              </p>
              <Campo
                etiqueta={t.codigo}
                value={codigo}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby={`${idBase}-codigo`}
                onChange={(e) => {
                  setCodigo(e.target.value);
                }}
              />
              <p id={`${idBase}-codigo`} className="portal__ayuda">
                {t.codigoAyuda}
              </p>
              <CampoTrampa valor={trampa} alCambiar={setTrampa} />
              {verificacion}
              {avisoDeError}
              <div className="formulario__acciones">
                <Boton type="submit" disabled={trabajando || faltaVerificar}>
                  {trabajando ? t.consultando : t.continuar}
                </Boton>
              </div>
            </form>
          </>
        ) : null}

        {paso === 'datos' && documento !== null ? (
          <>
            <section aria-labelledby={`${idBase}-conceptos`}>
              <p className="publica__version">{documento.folio}</p>
              <h2 id={`${idBase}-conceptos`} className="rotulo">
                {t.conceptos}
              </h2>
              <Tabla
                descripcion={t.conceptos}
                claveDeFila={(l) => `${l.name}-${String(l.lineTotalCents)}-${String(l.quantity)}`}
                filas={documento.lines}
                columnas={[
                  { clave: 'concepto', rotulo: t.concepto, celda: (l) => l.name },
                  {
                    clave: 'cantidad',
                    rotulo: t.cantidad,
                    numerica: true,
                    celda: (l) => String(l.quantity),
                  },
                  {
                    clave: 'importe',
                    rotulo: t.importe,
                    numerica: true,
                    celda: (l) => formatearPesos(l.lineTotalCents),
                  },
                ]}
              />
              <p className="portal__total">
                <span>{t.total}</span>{' '}
                <strong className="cifra">{formatearPesos(documento.totalCents)}</strong>
              </p>
              <p className="portal__plazo">{t.plazo(formatDate(documento.deadline))}</p>
            </section>

            <h2 className="portal__subtitulo">{t.datos.titulo}</h2>
            <p>{t.datos.descripcion}</p>
            <form
              className="formulario"
              noValidate
              onSubmit={(e) => {
                void pedirFactura(e);
              }}
            >
              <Campo
                etiqueta={t.datos.rfc}
                value={rfc}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                {...conError('recipient.rfc')}
                onChange={(e) => {
                  setRfc(e.target.value);
                  setRegimen('');
                }}
              />
              <p className="portal__ayuda">{t.datos.rfcAyuda}</p>
              <Campo
                etiqueta={t.datos.nombre}
                value={nombre}
                autoComplete="off"
                {...conError('recipient.name')}
                onChange={(e) => {
                  setNombre(e.target.value);
                }}
              />
              <p className="portal__ayuda">{t.datos.nombreAyuda}</p>
              <Campo
                etiqueta={t.datos.codigoPostal}
                value={codigoPostal}
                inputMode="numeric"
                autoComplete="off"
                {...conError('recipient.fiscalZip')}
                onChange={(e) => {
                  setCodigoPostal(e.target.value);
                }}
              />
              <p className="portal__ayuda">{t.datos.codigoPostalAyuda}</p>
              <Seleccion
                etiqueta={t.datos.regimen}
                value={regimen}
                opciones={[
                  { valor: '', texto: t.datos.elige },
                  ...regimenes.map((r) => ({ valor: r.code, texto: `${r.code} · ${r.name}` })),
                ]}
                onChange={(e) => {
                  setRegimen(e.target.value);
                }}
              />
              {errorDelCampo('recipient.regime') === undefined ? null : (
                <p className="portal__error" role="alert">
                  {errorDelCampo('recipient.regime')}
                </p>
              )}
              <Seleccion
                etiqueta={t.datos.uso}
                value={uso}
                opciones={[
                  { valor: '', texto: t.datos.elige },
                  ...PORTAL_CFDI_USES.map((u) => ({
                    valor: u.code,
                    texto: `${u.code} · ${u.name}`,
                  })),
                ]}
                onChange={(e) => {
                  setUso(e.target.value);
                }}
              />
              {errorDelCampo('recipient.cfdiUse') === undefined ? null : (
                <p className="portal__error" role="alert">
                  {errorDelCampo('recipient.cfdiUse')}
                </p>
              )}

              <label className="casilla portal__aviso">
                <input
                  type="checkbox"
                  checked={acepto}
                  onChange={(e) => {
                    setAcepto(e.target.checked);
                  }}
                />
                {t.datos.aviso}
              </label>
              <p>
                <a href="/aviso" target="_blank" rel="noreferrer">
                  {t.datos.leerAviso}
                </a>
              </p>
              {errorDelCampo('privacy') === undefined ? null : (
                <p className="portal__error" role="alert">
                  {errorDelCampo('privacy')}
                </p>
              )}

              <CampoTrampa valor={trampa} alCambiar={setTrampa} />
              {verificacion}
              {avisoDeError}
              <div className="formulario__acciones">
                <Boton type="submit" disabled={trabajando || faltaVerificar}>
                  {trabajando ? t.datos.pidiendo : enProceso ? t.resultado.revisar : t.datos.pedir}
                </Boton>
                <Boton
                  type="button"
                  variante="secundario"
                  disabled={trabajando}
                  onClick={() => {
                    setPaso('ticket');
                    setError(null);
                    setCampos([]);
                    abierto.current = ahora();
                  }}
                >
                  {t.datos.volver}
                </Boton>
              </div>
            </form>
          </>
        ) : null}

        {paso === 'factura' && factura !== null ? (
          <section aria-labelledby={`${idBase}-factura`}>
            <h2 id={`${idBase}-factura`} className="rotulo">
              {t.resultado.folio}
            </h2>
            <p className="portal__folio cifra">{factura.folio}</p>
            <p>{t.resultado.guardar}</p>
            {verificacion}
            {avisoDeError}
            {avisoDeDescarga === null ? null : <Aviso tipo="exito">{avisoDeDescarga}</Aviso>}
            <div className="formulario__acciones">
              <Boton
                type="button"
                disabled={trabajando || faltaVerificar}
                onClick={() => {
                  void bajar('pdf');
                }}
              >
                {trabajando ? t.resultado.descargando : t.resultado.pdf}
              </Boton>
              <Boton
                type="button"
                variante="secundario"
                disabled={trabajando || faltaVerificar}
                onClick={() => {
                  void bajar('xml');
                }}
              >
                {t.resultado.xml}
              </Boton>
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
