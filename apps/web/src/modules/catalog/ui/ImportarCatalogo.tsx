import { useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import {
  catalogImportTemplate,
  importCatalog,
  parseCsv,
  previewCatalogImport,
  type ImportAnalysis,
  type ImportCatalogDeps,
  type ImportCatalogError,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.importar;

export interface ImportarCatalogoProps {
  readonly deps: ImportCatalogDeps;
}

/** Lee el archivo como texto UTF-8. Devuelve también si hay caracteres de reemplazo (�), señal de que
 *  el archivo no estaba en UTF-8 y los acentos se perderían. */
function leerArchivo(archivo: File): Promise<{ texto: string; malaCodificacion: boolean }> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      const texto = typeof lector.result === 'string' ? lector.result : '';
      resolver({ texto, malaCodificacion: texto.includes('�') });
    };
    lector.onerror = () => {
      rechazar(new Error('No se pudo leer el archivo'));
    };
    lector.readAsText(archivo, 'utf-8');
  });
}

function descargarPlantilla(): void {
  const blob = new Blob([catalogImportTemplate()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla-catalogo-zammir.csv';
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Importación del catálogo desde un archivo CSV con vista previa. Todo o nada: con un solo error en el
 *  archivo no se importa ninguna fila, y cada error se muestra con su fila [RF-M1-05]. */
export function ImportarCatalogo({ deps }: ImportarCatalogoProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };

  const [filas, setFilas] = useState<readonly (readonly string[])[] | null>(null);
  const [analisis, setAnalisis] = useState<ImportAnalysis | null>(null);
  const [error, setError] = useState<ImportCatalogError | null>(null);
  const [malaCodificacion, setMalaCodificacion] = useState(false);
  const [importados, setImportados] = useState<number | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function elegirArchivo(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const archivo = evento.target.files?.[0];
    if (archivo === undefined) {
      return;
    }
    setError(null);
    setImportados(null);
    setAnalisis(null);
    setTrabajando(true);
    const { texto, malaCodificacion: mala } = await leerArchivo(archivo);
    setMalaCodificacion(mala);
    const leidas = parseCsv(texto);
    const vista = await previewCatalogImport(deps, actor, leidas);
    setTrabajando(false);
    if (vista.ok) {
      setFilas(leidas);
      setAnalisis(vista.value);
    } else {
      setFilas(null);
      setError(vista.error);
    }
  }

  async function confirmar(): Promise<void> {
    if (filas === null) {
      return;
    }
    setError(null);
    setTrabajando(true);
    const resultado = await importCatalog(deps, actor, filas);
    setTrabajando(false);
    if (resultado.ok) {
      setImportados(resultado.value.length);
      setAnalisis(null);
      setFilas(null);
    } else {
      setError(resultado.error);
      if (resultado.error.code === 'IMPORT_INVALID') {
        setAnalisis(resultado.error.analysis);
      }
    }
  }

  const conErrores = analisis?.rows.filter((f) => f.errors.length > 0).length ?? 0;

  return (
    <section className="anima-entrada" aria-labelledby="titulo-importar">
      <h2 id="titulo-importar">{t.titulo}</h2>
      <p>{t.descripcion}</p>
      <p>
        <strong>{t.reglaTodoONada}</strong>
      </p>

      <Boton variante="secundario" onClick={descargarPlantilla}>
        {t.plantilla}
      </Boton>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="archivo-catalogo">
          {t.archivo}
        </label>
        <input
          id="archivo-catalogo"
          className="campo__entrada"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void elegirArchivo(e)}
        />
      </div>

      {error !== null && error.code !== 'IMPORT_INVALID' ? (
        <Aviso tipo="error" queHacer={t.pantalla[error.code].queHacer}>
          {t.pantalla[error.code].mensaje}
        </Aviso>
      ) : null}
      {malaCodificacion ? <Aviso tipo="error">{t.codificacion}</Aviso> : null}
      {importados !== null ? (
        <Aviso tipo="exito">
          {t.importado} {String(importados)} {t.productos}.
        </Aviso>
      ) : null}
      {trabajando ? <p role="status">{t.revisando}</p> : null}

      {analisis?.fileError === 'EMPTY_FILE' ? <Aviso tipo="error">{t.archivoVacio}</Aviso> : null}
      {analisis?.fileError === 'MISSING_COLUMNS' ? (
        <Aviso tipo="error">
          {t.faltanColumnas} {analisis.missingColumns.join(', ')}.
        </Aviso>
      ) : null}

      {analisis !== null && analisis.fileError === null ? (
        <>
          <p role="status">
            {String(analisis.rows.length)} {t.resumen.filas}, {String(conErrores)}{' '}
            {t.resumen.conErrores}. {analisis.valid ? t.resumen.todoBien : t.resumen.hayErrores}
          </p>
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">{t.columnas.fila}</th>
                <th scope="col">{t.columnas.producto}</th>
                <th scope="col">{t.columnas.problemas}</th>
              </tr>
            </thead>
            <tbody>
              {analisis.rows.map((fila) => (
                <tr key={fila.number}>
                  <th scope="row">{fila.number}</th>
                  <td>{fila.draft?.name ?? t.sinNombre}</td>
                  <td>
                    {fila.errors.length === 0 ? (
                      t.filaBien
                    ) : (
                      <ul>
                        {fila.errors.map((e) => (
                          <li key={`${e.column ?? 'fila'}-${e.code}`}>
                            <strong>
                              {e.column === null
                                ? t.columnaGeneral
                                : textos.importar.columnasNombre[e.column]}
                              :
                            </strong>{' '}
                            {t.errores[e.code]}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Boton disabled={!analisis.valid || trabajando} onClick={() => void confirmar()}>
            {trabajando
              ? t.importando
              : `${t.importar} ${String(analisis.rows.length)} ${t.productos}`}
          </Boton>
        </>
      ) : null}
    </section>
  );
}
