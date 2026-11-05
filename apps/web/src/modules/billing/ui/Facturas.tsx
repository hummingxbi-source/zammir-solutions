import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  CANCELLATION_MOTIVES,
  CFDI_USES,
  isCfdiUse,
  isFiscalRegime,
  isValidRfc,
  isValidZip,
  regimesForRfc,
  type AdminCancelResult,
  type AdminInvoices,
  type AdminIssueResult,
  type CancellationMotive,
  type InvoiceCandidate,
  type IssuedInvoice,
  type PaymentForm,
  type ShareableFile,
  type ShareService,
  type StampUsage,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { EtiquetaDeEstado, type TonoDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { Indicador } from '../../../shared/ui/Indicador';
import { Pestanas } from '../../../shared/ui/Pestanas';
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
    case 'DEPOSIT_TREATMENT_UNSUPPORTED':
      return t.errores.DEPOSIT_TREATMENT_UNSUPPORTED;
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

function errorDeCancelacion(r: AdminCancelResult): ErrorVisible | null {
  switch (r.kind) {
    case 'CANCELLED':
    case 'CANCELLATION_PENDING':
    case 'INVALID':
      return null;
    case 'NOT_CANCELLABLE':
      return t.cancelar.noSePudo.NOT_CANCELLABLE;
    case 'NOT_FOUND':
      return t.cancelar.noSePudo.NOT_FOUND;
    case 'REJECTED':
      return t.cancelar.noSePudo.REJECTED;
    case 'NOT_AUTHORIZED':
      return t.errores.NOT_AUTHORIZED;
    case 'NO_NETWORK':
      return t.errores.NO_NETWORK;
    case 'UNAVAILABLE':
      return t.errores.UNAVAILABLE;
  }
}

/** Cancelar una factura con uno de los motivos del SAT; con el 01 pide el folio de la que la sustituye. Solo la
 *  ven los administradores y queda en la bitácora [RF-M10-19, RN-28]. */
function FormularioDeCancelacion({
  factura,
  facturas,
  alTerminar,
  alVolver,
}: {
  readonly factura: IssuedInvoice;
  readonly facturas: AdminInvoices;
  readonly alTerminar: (mensaje: string) => void;
  readonly alVolver: () => void;
}): ReactElement {
  const folio = factura.folio ?? '';
  const [motivo, setMotivo] = useState<'' | CancellationMotive>('');
  const [sustituta, setSustituta] = useState('');
  const [campos, setCampos] = useState<readonly string[]>([]);
  const [error, setError] = useState<ErrorVisible | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const mensajes: Readonly<Record<string, string>> = t.cancelar.errores;

  async function cancelar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    const malos: string[] = [];
    if (motivo === '') {
      malos.push('motive');
    }
    if (motivo === '01' && sustituta.trim() === '') {
      malos.push('substituteFolio');
    }
    setCampos(malos);
    if (motivo === '' || malos.length > 0) {
      return;
    }
    setTrabajando(true);
    const r = await facturas.cancel({
      folio,
      motive: motivo,
      ...(motivo === '01' ? { substituteFolio: sustituta.trim().toUpperCase() } : {}),
    });
    setTrabajando(false);
    if (r.kind === 'CANCELLED') {
      alTerminar(t.cancelar.cancelada(folio));
      return;
    }
    if (r.kind === 'CANCELLATION_PENDING') {
      alTerminar(t.cancelar.pendiente(folio));
      return;
    }
    if (r.kind === 'INVALID') {
      setCampos(r.fields);
      return;
    }
    setError(errorDeCancelacion(r));
  }

  return (
    <form
      className="formulario"
      noValidate
      onSubmit={(e) => {
        void cancelar(e);
      }}
    >
      <p>{t.cancelar.explicacion}</p>
      <Seleccion
        etiqueta={t.cancelar.motivo}
        value={motivo}
        opciones={[
          { valor: '', texto: t.cancelar.elige },
          ...CANCELLATION_MOTIVES.map((m) => ({ valor: m, texto: t.cancelar.motivos[m] })),
        ]}
        onChange={(e) => {
          const valor = CANCELLATION_MOTIVES.find((m) => m === e.target.value);
          setMotivo(valor ?? '');
        }}
      />
      {campos.includes('motive') ? (
        <p className="portal__error" role="alert">
          {mensajes.motive}
        </p>
      ) : null}
      {motivo === '01' ? (
        <>
          <Campo
            etiqueta={t.cancelar.sustituta}
            value={sustituta}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            {...(campos.includes('substituteFolio')
              ? { error: mensajes.substituteFolio ?? '' }
              : {})}
            onChange={(e) => {
              setSustituta(e.target.value);
            }}
          />
          <p className="portal__ayuda">{t.cancelar.sustitutaAyuda}</p>
        </>
      ) : null}
      {error === null ? null : (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      )}
      <div className="formulario__acciones">
        <Boton type="submit" variante="peligro" disabled={trabajando}>
          {trabajando ? t.cancelar.cancelando : t.cancelar.confirmar}
        </Boton>
        <Boton type="button" variante="secundario" disabled={trabajando} onClick={alVolver}>
          {t.cancelar.volver}
        </Boton>
      </div>
    </form>
  );
}

const TONO_DE_ESTADO: Readonly<Record<IssuedInvoice['status'], TonoDeEstado>> = {
  STAMPED: 'listo',
  IN_PROCESS: 'proceso',
  CANCELLED: 'cancelado',
  FAILED: 'cancelado',
};

function etiquetaDe(f: IssuedInvoice): ReactElement {
  if (f.status === 'STAMPED' && f.cancellationRequested) {
    return <EtiquetaDeEstado tono="espera" texto={t.emitidas.estados.CANCELLATION_REQUESTED} />;
  }
  return <EtiquetaDeEstado tono={TONO_DE_ESTADO[f.status]} texto={t.emitidas.estados[f.status]} />;
}

/** Los timbres de este año contra el límite del paquete, con aviso al llegar al 80 % [RF-M10-20]. */
function Timbres({ uso }: { readonly uso: StampUsage | null | undefined }): ReactElement | null {
  if (uso === undefined) {
    return null;
  }
  if (uso === null) {
    return <p className="portal__ayuda">{t.timbres.noDisponible}</p>;
  }
  return (
    <>
      <Indicador
        rotulo={t.timbres.titulo}
        valor={uso.limit === null ? String(uso.used) : t.timbres.usados(uso.used, uso.limit)}
        detalle={
          uso.limit === null || uso.remaining === null
            ? t.timbres.sinLimite
            : t.timbres.quedan(uso.remaining)
        }
        tono={uso.level === 'REACHED' ? 'peligro' : uso.level === 'WARNING' ? 'aviso' : 'neutro'}
      />
      {uso.level === 'NO_LIMIT' ? (
        <p className="portal__ayuda">{t.timbres.sinLimiteDetalle(uso.used)}</p>
      ) : null}
    </>
  );
}

type Seccion = 'por-facturar' | 'emitidas';

/** Facturas para administradores: lo que ya se puede facturar, lo emitido y en proceso, cancelar y los timbres del
 *  año [S4-16, S4-20 a S4-22, RF-M10-04 a RF-M10-07, RF-M10-15, RF-M10-19, RF-M10-20]. Todo lo decide el servidor. */
export function Facturas({
  facturas,
  compartir,
  nuevoId = () => crypto.randomUUID(),
  guardarArchivo = guardarEnElNavegador,
}: FacturasProps): ReactElement {
  const [seccion, setSeccion] = useState<Seccion>('por-facturar');
  const [lista, setLista] = useState<readonly InvoiceCandidate[] | null | undefined>(undefined);
  const [emitidasLista, setEmitidasLista] = useState<readonly IssuedInvoice[] | null | undefined>(
    undefined,
  );
  const [uso, setUso] = useState<StampUsage | null | undefined>(undefined);
  const [facturando, setFacturando] = useState<InvoiceCandidate | null>(null);
  const [emitida, setEmitida] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<IssuedInvoice | null>(null);
  const [reintentando, setReintentando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorDeReintento, setErrorDeReintento] = useState<ErrorVisible | null>(null);

  const cargar = useCallback(async () => {
    const [c, e, u] = await Promise.all([facturas.candidates(), facturas.list(), facturas.usage()]);
    setLista(c);
    setEmitidasLista(e);
    setUso(u);
  }, [facturas]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function reintentar(f: IssuedInvoice): Promise<void> {
    setReintentando(f.requestId);
    setAviso(null);
    setErrorDeReintento(null);
    const r = await facturas.retry(f.requestId);
    setReintentando(null);
    if (r.kind === 'STAMPED') {
      setAviso(t.emitidas.reintentoListo(r.folio));
      await cargar();
      return;
    }
    setErrorDeReintento(
      r.kind === 'IN_PROCESS'
        ? t.errores.IN_PROCESS
        : r.kind === 'REJECTED'
          ? t.errores.REJECTED
          : r.kind === 'NOT_FOUND'
            ? t.errores.NOT_FOUND
            : r.kind === 'NOT_AUTHORIZED'
              ? t.errores.NOT_AUTHORIZED
              : r.kind === 'NO_NETWORK'
                ? t.errores.NO_NETWORK
                : t.errores.UNAVAILABLE,
    );
    if (r.kind === 'NOT_FOUND') {
      await cargar();
    }
  }

  const enProceso = (emitidasLista ?? []).filter((f) => f.status === 'IN_PROCESS');

  return (
    <section className="anima-entrada">
      <EncabezadoDePagina titulo={t.titulo} descripcion={t.descripcion} />

      {uso === undefined && lista === undefined ? <p role="status">{t.cargando}</p> : null}

      <div className="indicadores">
        {lista === undefined || lista === null ? null : (
          <Indicador rotulo={t.resumen} valor={String(lista.length)} />
        )}
        <Timbres uso={uso} />
      </div>
      {uso?.level === 'WARNING' ? <Aviso tipo="error">{t.timbres.aviso}</Aviso> : null}
      {uso?.level === 'REACHED' ? <Aviso tipo="error">{t.timbres.agotados}</Aviso> : null}

      {aviso === null ? null : <Aviso tipo="exito">{aviso}</Aviso>}

      <Pestanas
        etiqueta={t.pestanas.etiqueta}
        pestanas={[
          { id: 'por-facturar', texto: t.pestanas.porFacturar },
          { id: 'emitidas', texto: t.pestanas.emitidas },
        ]}
        activa={seccion}
        onCambiar={(id) => {
          setSeccion(id === 'emitidas' ? 'emitidas' : 'por-facturar');
        }}
      />

      {seccion === 'por-facturar' ? (
        <>
          {lista === null ? (
            <Aviso tipo="error" queHacer={t.sinConexion.queHacer}>
              {t.sinConexion.mensaje}
            </Aviso>
          ) : null}
          {lista !== undefined && lista !== null ? (
            lista.length === 0 ? (
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
            )
          ) : null}
        </>
      ) : (
        <>
          {emitidasLista === undefined ? <p role="status">{t.emitidas.cargando}</p> : null}
          {emitidasLista === null ? (
            <Aviso tipo="error" queHacer={t.emitidas.sinConexion.queHacer}>
              {t.emitidas.sinConexion.mensaje}
            </Aviso>
          ) : null}
          {enProceso.length > 0 ? (
            <Aviso tipo="error" queHacer={t.emitidas.enProceso.queHacer}>
              {t.emitidas.enProceso.mensaje(enProceso.length)}
            </Aviso>
          ) : null}
          {errorDeReintento === null ? null : (
            <Aviso tipo="error" queHacer={errorDeReintento.queHacer}>
              {errorDeReintento.mensaje}
            </Aviso>
          )}
          {emitidasLista !== undefined && emitidasLista !== null ? (
            emitidasLista.length === 0 ? (
              <EstadoVacio
                titulo={t.emitidas.vacioTitulo}
                descripcion={t.emitidas.vacio}
                icono="cuentas"
              />
            ) : (
              <Tarjeta rotulo={t.emitidas.titulo}>
                <Tabla
                  descripcion={t.emitidas.titulo}
                  claveDeFila={(f) => f.requestId}
                  filas={emitidasLista}
                  columnas={[
                    {
                      clave: 'factura',
                      rotulo: t.emitidas.columnas.factura,
                      celda: (f) => f.folio ?? t.emitidas.sinFolio,
                    },
                    {
                      clave: 'origen',
                      rotulo: t.emitidas.columnas.origen,
                      celda: (f) => f.sourceFolio ?? '',
                    },
                    {
                      clave: 'cliente',
                      rotulo: t.emitidas.columnas.cliente,
                      celda: (f) => f.customerName ?? t.sinCliente,
                    },
                    {
                      clave: 'total',
                      rotulo: t.emitidas.columnas.total,
                      numerica: true,
                      celda: (f) => (f.totalCents === null ? '' : formatearPesos(f.totalCents)),
                    },
                    {
                      clave: 'fecha',
                      rotulo: t.emitidas.columnas.fecha,
                      celda: (f) => formatearFecha(new Date(f.stampedAt ?? f.createdAt)),
                    },
                    {
                      clave: 'estado',
                      rotulo: t.emitidas.columnas.estado,
                      celda: (f) => (
                        <>
                          {etiquetaDe(f)}
                          {f.status === 'IN_PROCESS' ? (
                            <small> {t.emitidas.intentos(f.attempts)}</small>
                          ) : null}
                        </>
                      ),
                    },
                    {
                      clave: 'acciones',
                      rotulo: t.emitidas.columnas.acciones,
                      celda: (f) => (
                        <span className="tabla__acciones">
                          {f.status === 'IN_PROCESS' ? (
                            <Boton
                              variante="secundario"
                              disabled={reintentando !== null}
                              aria-label={t.emitidas.reintentarA(f.folio ?? f.requestId)}
                              onClick={() => {
                                void reintentar(f);
                              }}
                            >
                              {reintentando === f.requestId
                                ? t.emitidas.reintentando
                                : t.emitidas.reintentar}
                            </Boton>
                          ) : null}
                          {f.status === 'STAMPED' && f.folio !== null ? (
                            <>
                              <Boton
                                variante="secundario"
                                aria-label={t.emitidas.descargarA(f.folio)}
                                onClick={() => {
                                  setEmitida(f.folio);
                                }}
                              >
                                {t.emitidas.descargar}
                              </Boton>
                              <Boton
                                variante="peligro"
                                aria-label={t.emitidas.cancelarA(f.folio)}
                                onClick={() => {
                                  setCancelando(f);
                                }}
                              >
                                {t.emitidas.cancelar}
                              </Boton>
                            </>
                          ) : null}
                        </span>
                      ),
                    },
                  ]}
                />
              </Tarjeta>
            )
          ) : null}
        </>
      )}

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

      {cancelando === null ? null : (
        <Ventana
          titulo={t.cancelar.titulo(cancelando.folio ?? '')}
          onCerrar={() => {
            setCancelando(null);
          }}
        >
          <FormularioDeCancelacion
            factura={cancelando}
            facturas={facturas}
            alVolver={() => {
              setCancelando(null);
            }}
            alTerminar={(mensaje) => {
              setCancelando(null);
              setAviso(mensaje);
              void cargar();
            }}
          />
        </Ventana>
      )}
    </section>
  );
}
