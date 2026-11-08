import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  createZip,
  exportData,
  EXPORT_TABLES,
  type DataExportSource,
  type ExportPackage,
  type ExportReport,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import {
  guardarArchivoEnElNavegador,
  type ArchivoParaGuardar,
} from '../../../shared/ui/guardar-archivo';
import { Tarjeta } from '../../../shared/ui/Tarjeta';

const t = textos.exportar;

export interface ExportarDatosProps {
  readonly source: DataExportSource;
  /** Dibuja el resumen como PDF. */
  readonly renderPdf: (reporte: ExportReport) => Promise<Uint8Array>;
  readonly businessName?: string;
  /** Entrega el archivo descargado; solo cambia en las pruebas. */
  readonly guardarArchivo?: (archivo: ArchivoParaGuardar) => void;
  /** Para dar fecha a los ZIP; solo cambia en las pruebas. */
  readonly ahora?: () => Date;
}

interface Listo {
  readonly paquete: ExportPackage;
  /** El PDF, o `null` si no se pudo armar (lo demás sí está). */
  readonly pdf: Uint8Array | null;
}

const bytesDe = (texto: string): Uint8Array => new TextEncoder().encode(texto);

/** Exportar todos los datos del negocio en CSV, JSON y PDF: solo administradores, con aviso de que son datos
 *  personales y sin PIN ni cuentas de tablets [S5-08, RNF-22, ADR-0036]. */
export function ExportarDatos({
  source,
  renderPdf,
  businessName,
  guardarArchivo = guardarArchivoEnElNavegador,
  ahora = () => new Date(),
}: ExportarDatosProps): ReactElement {
  const [trabajando, setTrabajando] = useState(false);
  const [listo, setListo] = useState<Listo | null>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function preparar(): Promise<void> {
    setTrabajando(true);
    setError(null);
    setAviso(null);
    setListo(null);
    const r = await exportData(source, businessName === undefined ? {} : { businessName });
    if (r.kind !== 'READY') {
      setError(t.errores[r.kind]);
      setTrabajando(false);
      return;
    }
    let pdf: Uint8Array | null = null;
    try {
      pdf = await renderPdf(r.package.report);
    } catch {
      setError(t.errores.PDF);
    }
    setListo({ paquete: r.package, pdf });
    setTrabajando(false);
  }

  function bajar(archivo: ArchivoParaGuardar): void {
    guardarArchivo(archivo);
    setAviso(t.descargado(archivo.name));
  }

  const csvEntradas = (p: ExportPackage) =>
    p.csvFiles.map((f) => ({ name: f.path, data: bytesDe(f.content) }));

  return (
    <Tarjeta rotulo={t.titulo}>
      <p>{t.descripcion}</p>
      <p>{t.sinPin}</p>
      <p className="portal__ayuda">{t.privacidad}</p>

      <Boton
        disabled={trabajando}
        onClick={() => {
          void preparar();
        }}
      >
        {trabajando ? t.preparando : t.preparar}
      </Boton>

      {error === null ? null : (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      )}

      {listo === null ? null : (
        <div>
          <p role="status">
            {t.listo(
              Object.values(listo.paquete.counts).reduce((suma, n) => suma + n, 0),
              Object.values(listo.paquete.counts).filter((n) => n > 0).length,
            )}{' '}
            {listo.paquete.report.subtitle}
          </p>
          <div className="formulario__acciones">
            <Boton
              onClick={() => {
                const p = listo.paquete;
                const archivos = [
                  { name: p.readme.path, data: bytesDe(p.readme.content) },
                  { name: p.json.path, data: bytesDe(p.json.content) },
                  ...(listo.pdf === null ? [] : [{ name: 'zammir-resumen.pdf', data: listo.pdf }]),
                  ...csvEntradas(p),
                ];
                bajar({
                  name: `${p.baseName}.zip`,
                  mimeType: 'application/zip',
                  bytes: createZip(archivos, ahora()),
                });
              }}
            >
              {t.descargas.todo}
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                bajar({
                  name: `${listo.paquete.baseName}.json`,
                  mimeType: listo.paquete.json.mimeType,
                  bytes: bytesDe(listo.paquete.json.content),
                });
              }}
            >
              {t.descargas.json}
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                const p = listo.paquete;
                bajar({
                  name: `${p.baseName}-csv.zip`,
                  mimeType: 'application/zip',
                  bytes: createZip(
                    [{ name: p.readme.path, data: bytesDe(p.readme.content) }, ...csvEntradas(p)],
                    ahora(),
                  ),
                });
              }}
            >
              {t.descargas.csv}
            </Boton>
            {listo.pdf === null ? null : (
              <Boton
                variante="secundario"
                onClick={() => {
                  if (listo.pdf !== null) {
                    bajar({
                      name: `${listo.paquete.baseName}.pdf`,
                      mimeType: 'application/pdf',
                      bytes: listo.pdf,
                    });
                  }
                }}
              >
                {t.descargas.pdf}
              </Boton>
            )}
          </div>
          {aviso === null ? null : <Aviso tipo="exito">{aviso}</Aviso>}
          <h3>{t.tablas}</h3>
          <ul>
            {EXPORT_TABLES.map((tabla) => (
              <li key={tabla.name}>
                {tabla.label}: {String(listo.paquete.counts[tabla.name] ?? 0)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tarjeta>
  );
}
