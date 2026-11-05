import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  CFDI_USES,
  isCfdiUse,
  isFiscalRegime,
  isValidRfc,
  isValidZip,
  regimesForRfc,
  type AdminInvoices,
  type AdminIssueResult,
  type InvoiceCandidate,
  type PaymentForm,
  type ShareableFile,
  type ShareService,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { Indicador } from '../../../shared/ui/Indicador';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { Tabla } from '../../../shared/ui/Tabla';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { Ventana } from '../../../shared/ui/Ventana';
import { formatearFecha, formatearPesos } from '../../../shared/ui/formatos';

const t = textos.facturas;

export interface FacturasProps {
  readonly facturas: AdminInvoices;
  /** Para enviar la factura por WhatsApp; sin esto solo se descarga. */
  readonly compartir?: ShareService;
  /** Identificador único de cada solicitud; solo cambia en las pruebas. */
  readonly nuevoId?: () => string;
  /** Entrega el archivo descargado; solo cambia en las pruebas. */
  readonly guardarArchivo?: (archivo: ShareableFile) => void;
}

interface ErrorVisible {
  readonly mensaje: string;
  readonly queHacer: string;
}

function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

function guardarEnElNavegador(archivo: ShareableFile): void {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(archivo.bytes)], { type: archivo.mimeType }),
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.name;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function errorDe(r: AdminIssueResult): ErrorVisible | null {
  switch (r.kind) {
    case 'STAMPED':
    case 'INVALID':
    case 'PAYMENT_FORM_REQUIRED':
      return null;
    case 'IN_PROCESS':
      return t.errores.IN_PROCESS;
    case 'NOT_BILLABLE':
      return t.errores.NOT_BILLABLE;
    case 'REJECTED':
      return t.errores.REJECTED;
    case 'NOT_AUTHORIZED':
      return t.errores.NOT_AUTHORIZED;
    case 'NOT_FOUND':
      return t.errores.NOT_FOUND;
    case 'UNAVAILABLE':
      return t.errores.UNAVAILABLE;
    case 'NO_NETWORK':
      return t.errores.NO_NETWORK;
    case 'INELIGIBLE':
      return r.reason === 'CANCELLED' ||
        r.reason === 'ALREADY_INVOICED' ||
        r.reason === 'NOT_SETTLED'
        ? t.errores.INELIGIBLE[r.reason]
        : t.errores.UNAVAILABLE;
  }
}

/** Formulario para facturar una venta u orden: el receptor sale de la ficha del cliente si ya tiene datos fiscales
 *  y se puede corregir [RF-M10-05]; si el pago fue mixto pide la forma de pago [PD-28, RF-M10-06]. */
function FormularioDeFactura({
  candidato,
  facturas,
  nuevoId,
  alTerminar,
  alCancelar,
}: {
  readonly candidato: InvoiceCandidate;
  readonly facturas: AdminInvoices;
  readonly nuevoId: () => string;
  readonly alTerminar: (folio: string) => void;
  readonly alCancelar: () => void;
}): ReactElement {
  const ficha = candidato.customerFiscal;
  const [rfc, setRfc] = useState(ficha?.rfc ?? '');
  const [nombre, setNombre] = useState(ficha?.name ?? '');
  const [codigoPostal, setCodigoPostal] = useState(ficha?.fiscalZip ?? '');
  const [regimen, setRegimen] = useState(ficha?.regime ?? '');
  const [uso, setUso] = useState(ficha?.cfdiUse ?? '');
  const [forma, setForma] = useState<'' | PaymentForm>('');
  const [pedirForma, setPedirForma] = useState(false);
  const [campos, setCampos] = useState<readonly string[]>([]);
  const [error, setError] = useState<ErrorVisible | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // Un solo identificador por formulario: reenviarlo tras un corte de red no duplica el timbre [RN-24].
  const [idDeSolicitud] = useState(nuevoId);

  const rfcLimpio = rfc.replace(/\s/g, '').toUpperCase();
  const mensajes: Readonly<Record<string, string>> = t.formulario.errores;
  const mensajeDe = (campo: string): string | undefined =>
    campos.includes(campo) ? mensajes[campo] : undefined;
  const conError = (campo: string): { error?: string } => {
    const m = mensajeDe(campo);
    return m === undefined ? {} : { error: m };
  };

  function invalidos(): readonly string[] {
    const malos: string[] = [];
    if (!isValidRfc(rfcLimpio)) {
      malos.push('recipient.rfc');
    }
    if (nombre.trim() === '') {
      malos.push('recipient.name');
    }
    if (!isValidZip(codigoPostal.trim())) {
      malos.push('recipient.fiscalZip');
    }
    if (!isFiscalRegime(regimen)) {
      malos.push('recipient.regime');
    }
    if (!isCfdiUse(uso)) {
      malos.push('recipient.cfdiUse');
    }
    if (pedirForma && forma === '') {
      malos.push('paymentForm');
    }
    return malos;
  }

  async function timbrar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    const malos = invalidos();
    setCampos(malos);
    if (malos.length > 0) {
      return;
    }
    setTrabajando(true);
    const r = await facturas.issue({
      source: { type: candidato.sourceType, id: candidato.sourceId },
      requestId: idDeSolicitud,
      recipient: {
        rfc: rfcLimpio,
        name: nombre.trim(),
        fiscalZip: codigoPostal.trim(),
        regime: regimen,
        cfdiUse: uso,
      },
      ...(forma === '' ? {} : { paymentForm: forma }),
    });
    setTrabajando(false);
    if (r.kind === 'STAMPED') {
      alTerminar(r.folio);
      return;
    }
    if (r.kind === 'INVALID') {
      setCampos(r.fields);
      return;
    }
    if (r.kind === 'PAYMENT_FORM_REQUIRED') {
      setPedirForma(true);
      return;
    }
    setError(errorDe(r));
  }

  return (
    <form
      className="formulario"
      noValidate
      onSubmit={(e) => {
        void timbrar(e);
      }}
    >
      <p>{ficha === null ? t.formulario.sinFicha : t.formulario.desdeFicha}</p>
      <Campo
        etiqueta={t.formulario.rfc}
        value={rfc}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        {...conError('recipient.rfc')}
        onChange={(e) => {
          setRfc(e.target.value);
        }}
      />
      <Campo
        etiqueta={t.formulario.nombre}
        value={nombre}
        autoComplete="off"
        {...conError('recipient.name')}
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      <div className="formulario__par">
        <Campo
          etiqueta={t.formulario.codigoPostal}
          value={codigoPostal}
          inputMode="numeric"
          autoComplete="off"
          {...conError('recipient.fiscalZip')}
          onChange={(e) => {
            setCodigoPostal(e.target.value);
          }}
        />
      </div>
      <Seleccion
        etiqueta={t.formulario.regimen}
        value={regimen}
        opciones={[
          { valor: '', texto: t.formulario.elige },
          ...regimesForRfc(rfcLimpio).map((r) => ({
            valor: r.code,
            texto: `${r.code} · ${r.name}`,
          })),
        ]}
        onChange={(e) => {
          setRegimen(e.target.value);
        }}
      />
      {mensajeDe('recipient.regime') === undefined ? null : (
        <p className="portal__error" role="alert">
          {mensajeDe('recipient.regime')}
        </p>
      )}
      <Seleccion
        etiqueta={t.formulario.uso}
        value={uso}
        opciones={[
          { valor: '', texto: t.formulario.elige },
          ...CFDI_USES.map((u) => ({ valor: u.code, texto: `${u.code} · ${u.name}` })),
        ]}
        onChange={(e) => {
          setUso(e.target.value);
        }}
      />
      {mensajeDe('recipient.cfdiUse') === undefined ? null : (
        <p className="portal__error" role="alert">
          {mensajeDe('recipient.cfdiUse')}
        </p>
      )}
      {pedirForma ? (
        <>
          <p className="portal__ayuda">{t.formulario.pagoMixto}</p>
          <Seleccion
            etiqueta={t.formulario.formaDePago}
            value={forma}
            opciones={[
              { valor: '', texto: t.formulario.elige },
              { valor: '01', texto: t.formulario.formas['01'] },
              { valor: '03', texto: t.formulario.formas['03'] },
            ]}
            onChange={(e) => {
              setForma(e.target.value === '01' || e.target.value === '03' ? e.target.value : '');
            }}
          />
          {mensajeDe('paymentForm') === undefined ? null : (
            <p className="portal__error" role="alert">
              {mensajeDe('paymentForm')}
            </p>
          )}
        </>
      ) : null}
      {error === null ? null : (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      )}
      <div className="formulario__acciones">
        <Boton type="submit" disabled={trabajando}>
          {trabajando ? t.formulario.timbrando : t.formulario.timbrar}
        </Boton>
        <Boton type="button" variante="secundario" disabled={trabajando} onClick={alCancelar}>
          {t.formulario.cancelar}
        </Boton>
      </div>
    </form>
  );
}

/** La factura ya emitida: su folio y los archivos para descargar o enviar por WhatsApp [RF-M10-07]. */
function FacturaEmitida({
  folio,
  facturas,
  compartir,
  guardarArchivo,
  alCerrar,
}: {
  readonly folio: string;
  readonly facturas: AdminInvoices;
  readonly compartir: ShareService | undefined;
  readonly guardarArchivo: (archivo: ShareableFile) => void;
  readonly alCerrar: () => void;
}): ReactElement {
  const [error, setError] = useState<ErrorVisible | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function archivo(formato: 'pdf' | 'xml'): Promise<ShareableFile | null> {
    const archivos = await facturas.files(folio);
    if (archivos === null) {
      setError(t.resultado.sinArchivos);
      return null;
    }
    return formato === 'pdf'
      ? { name: `${folio}.pdf`, mimeType: 'application/pdf', bytes: deBase64(archivos.pdfBase64) }
      : {
          name: `${folio}.xml`,
          mimeType: 'application/xml',
          bytes: new TextEncoder().encode(archivos.xml),
        };
  }

  async function bajar(formato: 'pdf' | 'xml'): Promise<void> {
    setTrabajando(true);
    setError(null);
    setAviso(null);
    const a = await archivo(formato);
    setTrabajando(false);
    if (a !== null) {
      guardarArchivo(a);
      setAviso(t.resultado.descargada(a.name));
    }
  }

  async function enviarPorWhatsApp(): Promise<void> {
    if (compartir === undefined) {
      return;
    }
    setTrabajando(true);
    setError(null);
    setAviso(null);
    const a = await archivo('pdf');
    setTrabajando(false);
    if (a === null) {
      return;
    }
    const mensaje = t.resultado.mensajeWhatsApp(folio);
    if (compartir.canShareFile(a)) {
      await compartir.shareFile(a, mensaje);
      return;
    }
    // Sin menú de compartir (una computadora): se descarga el PDF y se abre WhatsApp con el mensaje.
    compartir.download(a);
    compartir.openLink(`https://wa.me/?text=${encodeURIComponent(mensaje)}`);
  }

  return (
    <section aria-label={t.resultado.titulo}>
      <p className="rotulo">{t.resultado.folio}</p>
      <p className="portal__folio cifra">{folio}</p>
      <p className="portal__ayuda">{t.resultado.aviso}</p>
      {error === null ? null : (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      )}
      {aviso === null ? null : <Aviso tipo="exito">{aviso}</Aviso>}
      <div className="formulario__acciones">
        <Boton
          type="button"
          disabled={trabajando}
          onClick={() => {
            void bajar('pdf');
          }}
        >
          {t.resultado.pdf}
        </Boton>
        <Boton
          type="button"
          variante="secundario"
          disabled={trabajando}
          onClick={() => {
            void bajar('xml');
          }}
        >
          {t.resultado.xml}
        </Boton>
        {compartir === undefined ? null : (
          <Boton
            type="button"
            variante="secundario"
            disabled={trabajando}
            onClick={() => {
              void enviarPorWhatsApp();
            }}
          >
            {t.resultado.whatsapp}
          </Boton>
        )}
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          {t.resultado.cerrar}
        </Boton>
      </div>
    </section>
  );
}

/** Facturas para administradores: lo que ya se puede facturar (ventas y órdenes liquidadas sin factura) y emitir
 *  la factura con el receptor de la ficha del cliente [S4-16, RF-M10-04 a RF-M10-07]. Todo lo decide el servidor. */
export function Facturas({
  facturas,
  compartir,
  nuevoId = () => crypto.randomUUID(),
  guardarArchivo = guardarEnElNavegador,
}: FacturasProps): ReactElement {
  const [lista, setLista] = useState<readonly InvoiceCandidate[] | null | undefined>(undefined);
  const [facturando, setFacturando] = useState<InvoiceCandidate | null>(null);
  const [emitida, setEmitida] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLista(await facturas.candidates());
  }, [facturas]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="anima-entrada">
      <EncabezadoDePagina titulo={t.titulo} descripcion={t.descripcion} />

      {lista === undefined ? <p role="status">{t.cargando}</p> : null}
      {lista === null ? (
        <Aviso tipo="error" queHacer={t.sinConexion.queHacer}>
          {t.sinConexion.mensaje}
        </Aviso>
      ) : null}

      {lista !== undefined && lista !== null ? (
        <>
          <div className="indicadores">
            <Indicador rotulo={t.resumen} valor={String(lista.length)} />
          </div>
          {lista.length === 0 ? (
            <EstadoVacio titulo={t.vacioTitulo} descripcion={t.vacio} icono="cuentas" />
          ) : (
            <Tarjeta rotulo={t.resumen}>
              <Tabla
                descripcion={t.titulo}
                claveDeFila={(c) => `${c.sourceType}-${c.sourceId}`}
                filas={lista}
                columnas={[
                  { clave: 'folio', rotulo: t.columnas.folio, celda: (c) => c.folio },
                  { clave: 'tipo', rotulo: t.columnas.tipo, celda: (c) => t.tipos[c.sourceType] },
                  {
                    clave: 'cliente',
                    rotulo: t.columnas.cliente,
                    celda: (c) => c.customerName ?? t.sinCliente,
                  },
                  {
                    clave: 'total',
                    rotulo: t.columnas.total,
                    numerica: true,
                    celda: (c) => formatearPesos(c.totalCents),
                  },
                  {
                    clave: 'liquidada',
                    rotulo: t.columnas.liquidada,
                    celda: (c) =>
                      c.settledAt === null ? '' : formatearFecha(new Date(c.settledAt)),
                  },
                  {
                    clave: 'acciones',
                    rotulo: t.columnas.acciones,
                    celda: (c) => (
                      <Boton
                        aria-label={t.facturarA(c.folio)}
                        onClick={() => {
                          setFacturando(c);
                        }}
                      >
                        {t.facturar}
                      </Boton>
                    ),
                  },
                ]}
              />
            </Tarjeta>
          )}
        </>
      ) : null}

      {facturando === null ? null : (
        <Ventana
          titulo={t.formulario.titulo(facturando.folio)}
          onCerrar={() => {
            setFacturando(null);
          }}
        >
          <FormularioDeFactura
            candidato={facturando}
            facturas={facturas}
            nuevoId={nuevoId}
            alCancelar={() => {
              setFacturando(null);
            }}
            alTerminar={(folio) => {
              setFacturando(null);
              setEmitida(folio);
              void cargar();
            }}
          />
        </Ventana>
      )}

      {emitida === null ? null : (
        <Ventana
          titulo={t.resultado.titulo}
          onCerrar={() => {
            setEmitida(null);
          }}
        >
          <FacturaEmitida
            folio={emitida}
            facturas={facturas}
            compartir={compartir}
            guardarArchivo={guardarArchivo}
            alCerrar={() => {
              setEmitida(null);
            }}
          />
        </Ventana>
      )}
    </section>
  );
}
