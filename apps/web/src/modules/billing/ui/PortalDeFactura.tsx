import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  formatDate,
  normalizeFolio,
  normalizeVerificationCode,
  type PortalConsulta,
  type PortalConsultaResultado,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { Tabla } from '../../../shared/ui/Tabla';
import { formatearPesos } from '../../../shared/ui/formatos';

const t = textos.portal;

export interface PortalDeFacturaProps {
  readonly consultar: PortalConsulta;
  /** Folio y código que trae el QR; la persona también puede teclearlos [RF-M10-09]. */
  readonly inicial?: { readonly folio: string; readonly code: string };
  /** Llave pública de Turnstile; sin ella no se muestra la verificación externa. */
  readonly siteKey?: string | null;
  /** Hora en milisegundos; solo cambia en las pruebas. */
  readonly ahora?: () => number;
  /** Nombre del negocio para el encabezado; nulo mientras no se defina (PD-11). */
  readonly negocio?: string | null;
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
 *  token que el servidor comprueba [RF-M10-11]. */
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

function mensajeDeError(r: PortalConsultaResultado): { mensaje: string; queHacer: string } | null {
  switch (r.kind) {
    case 'OK':
      return null;
    case 'NOT_AVAILABLE':
      return t.errores.NOT_AVAILABLE;
    case 'BLOCKED':
      return {
        mensaje: t.errores.BLOCKED.mensaje,
        queHacer: t.errores.BLOCKED.queHacer(Math.max(1, Math.ceil(r.retryAfterSeconds / 60))),
      };
    case 'INELIGIBLE':
      return t.inelegible[r.reason];
    case 'NO_NETWORK':
      return t.errores.NO_NETWORK;
    case 'UNAVAILABLE':
      return t.errores.UNAVAILABLE;
  }
}

/** Portal público de autofacturación: el cliente entra con el folio y el código de su ticket y ve solo
 *  conceptos y total, antes de dar sus datos fiscales [RF-M10-09, RF-M10-12, S4-18]. Va fuera del marco de la
 *  aplicación: se abre en el teléfono de quien compró. */
export function PortalDeFactura({
  consultar,
  inicial,
  siteKey = null,
  ahora = () => Date.now(),
  negocio = null,
}: PortalDeFacturaProps): ReactElement {
  const [folio, setFolio] = useState(inicial?.folio ?? '');
  const [codigo, setCodigo] = useState(inicial?.code ?? '');
  const [trampa, setTrampa] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState<PortalConsultaResultado | null>(null);
  const abierto = useRef(ahora());
  const idTrampa = useId();

  async function enviar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setTrabajando(true);
    setResultado(null);
    // Se manda lo normalizado cuando tiene forma de folio y de código; si no, tal cual y el servidor responde igual.
    const r = await consultar({
      folio: normalizeFolio(folio) ?? folio,
      code: normalizeVerificationCode(codigo) ?? codigo,
      honeypot: trampa,
      elapsedMs: ahora() - abierto.current,
      token,
    });
    setTrabajando(false);
    setResultado(r);
  }

  const error = resultado === null ? null : mensajeDeError(resultado);
  const documento = resultado?.kind === 'OK' ? resultado.document : null;
  const faltaVerificar = siteKey !== null && token === null;

  return (
    <main className="publica portal">
      <article className="publica__hoja">
        <p className="rotulo publica__negocio">{negocio ?? textos.app.nombre}</p>
        <h1>{t.titulo}</h1>

        {documento === null ? (
          <>
            <p>{t.descripcion}</p>
            <form
              className="formulario"
              onSubmit={(e) => {
                void enviar(e);
              }}
            >
              <Campo
                etiqueta={t.folio}
                value={folio}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby={`${idTrampa}-folio`}
                onChange={(e) => {
                  setFolio(e.target.value);
                }}
              />
              <p id={`${idTrampa}-folio`} className="portal__ayuda">
                {t.folioAyuda}
              </p>
              <Campo
                etiqueta={t.codigo}
                value={codigo}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby={`${idTrampa}-codigo`}
                onChange={(e) => {
                  setCodigo(e.target.value);
                }}
              />
              <p id={`${idTrampa}-codigo`} className="portal__ayuda">
                {t.codigoAyuda}
              </p>
              {/* Campo trampa: las personas no lo ven ni lo llenan; un programa suele llenarlo todo [RF-M10-11]. */}
              <div className="portal__trampa" aria-hidden="true">
                <label>
                  Sitio web
                  <input
                    type="text"
                    name="sitio_web"
                    tabIndex={-1}
                    autoComplete="off"
                    value={trampa}
                    onChange={(e) => {
                      setTrampa(e.target.value);
                    }}
                  />
                </label>
              </div>
              {siteKey === null ? null : (
                <VerificacionExterna siteKey={siteKey} alCambiar={setToken} />
              )}
              {error !== null ? (
                <Aviso tipo="error" queHacer={error.queHacer}>
                  {error.mensaje}
                </Aviso>
              ) : null}
              <div className="formulario__acciones">
                <Boton type="submit" disabled={trabajando || faltaVerificar}>
                  {trabajando ? t.consultando : t.continuar}
                </Boton>
              </div>
            </form>
          </>
        ) : (
          <section aria-labelledby={`${idTrampa}-conceptos`}>
            <p className="publica__version">{documento.folio}</p>
            <h2 id={`${idTrampa}-conceptos`} className="rotulo">
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
        )}
      </article>
    </main>
  );
}
