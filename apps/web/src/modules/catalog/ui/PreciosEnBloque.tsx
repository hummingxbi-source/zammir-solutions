import { useState } from 'react';
import type { ChangeEvent, ReactElement, SyntheticEvent } from 'react';
import {
  applyCatalogUpdate,
  applyCategoryPrices,
  catalogUpdateTemplate,
  parseCsv,
  parsePercent,
  previewCatalogUpdate,
  previewCategoryPrices,
  type BulkPriceChange,
  type BulkPricesDeps,
  type Category,
  type PesoRounding,
  type UpdateAnalysis,
  type UserRole,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { CampoNumerico } from '../../../shared/ui/Campo';
import { Icono } from '../../../shared/ui/Icono';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { formatearPesos } from '../../../shared/ui/formatos';

const t = textos.preciosEnBloque;
const REDONDEOS: readonly PesoRounding[] = ['UP', 'NEAREST', 'DOWN'];

export interface PreciosEnBloqueProps {
  readonly deps: BulkPricesDeps;
  readonly actor: { readonly role: UserRole | null };
  readonly categorias: readonly Category[];
  /** Avisa que cambiaron precios, para refrescar el catálogo. */
  readonly onCambiado: () => void;
}

interface Problema {
  readonly mensaje: string;
  readonly queHacer: string;
}

function problema(codigo: string): Problema {
  return t.errores[codigo] ?? t.errores.CATALOG_UNAVAILABLE ?? { mensaje: '', queHacer: '' };
}

function descargar(contenido: string, nombre: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Precios en bloque [RF-M1-15, ADR-0048]: subir o bajar por porcentaje una categoría, o actualizar desde un
 *  archivo por código. Siempre con vista previa (antes y después) y todo o nada. */
export function PreciosEnBloque({
  deps,
  actor,
  categorias,
  onCambiado,
}: PreciosEnBloqueProps): ReactElement {
  const activas = categorias.filter((c) => (c.isActive as boolean | undefined) !== false);
  const [categoriaId, setCategoriaId] = useState(activas[0]?.id ?? '');
  const [porcentaje, setPorcentaje] = useState('');
  const [redondeo, setRedondeo] = useState<PesoRounding>('UP');
  const [vistaPorcentaje, setVistaPorcentaje] = useState<readonly BulkPriceChange[] | null>(null);

  const [filas, setFilas] = useState<readonly (readonly string[])[] | null>(null);
  const [vistaArchivo, setVistaArchivo] = useState<UpdateAnalysis | null>(null);

  const [error, setError] = useState<Problema | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const categoria = activas.find((c) => c.id === categoriaId);

  function empezar(): void {
    setError(null);
    setAviso(null);
  }

  async function verPorcentaje(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    empezar();
    setVistaPorcentaje(null);
    const bps = parsePercent(porcentaje);
    if (!bps.ok || categoria === undefined) {
      setError(problema('PERCENT_INVALID'));
      return;
    }
    const r = await previewCategoryPrices(deps, actor, categoria.id, bps.value, redondeo);
    if (r.ok) setVistaPorcentaje(r.value);
    else setError(problema(r.error.code));
  }

  async function aplicarPorcentaje(): Promise<void> {
    const bps = parsePercent(porcentaje);
    if (!bps.ok || categoria === undefined) return;
    empezar();
    setTrabajando(true);
    const r = await applyCategoryPrices(deps, actor, categoria.id, bps.value, redondeo);
    setTrabajando(false);
    if (r.ok) {
      setVistaPorcentaje(null);
      setAviso(t.aplicado(r.value.length));
      onCambiado();
    } else {
      setError(problema(r.error.code));
    }
  }

  async function descargarCatalogo(): Promise<void> {
    empezar();
    const lista = await deps.products.list();
    if (lista.ok) descargar(catalogUpdateTemplate(lista.value), 'catalogo-para-actualizar.csv');
    else setError(problema(lista.error.code));
  }

  async function elegirArchivo(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const archivo = evento.target.files?.[0];
    if (archivo === undefined) return;
    empezar();
    setVistaArchivo(null);
    const leidas = parseCsv(await archivo.text());
    const r = await previewCatalogUpdate(deps, actor, leidas);
    if (r.ok) {
      setFilas(leidas);
      setVistaArchivo(r.value);
    } else {
      setFilas(null);
      setError(problema(r.error.code));
    }
  }

  async function aplicarArchivo(): Promise<void> {
    if (filas === null) return;
    empezar();
    setTrabajando(true);
    const r = await applyCatalogUpdate(deps, actor, filas);
    setTrabajando(false);
    if (r.ok) {
      setVistaArchivo(null);
      setFilas(null);
      setAviso(t.aplicado(r.value.length));
      onCambiado();
    } else if (r.error.code === 'IMPORT_INVALID') {
      setVistaArchivo(r.error.analysis);
    } else {
      setError(problema(r.error.code));
    }
  }

  const a = t.archivo;
  const errorDeArchivo =
    vistaArchivo?.fileError === 'MISSING_COLUMNS'
      ? a.faltaCodigo
      : vistaArchivo?.fileError === 'NOTHING_TO_UPDATE'
        ? a.nadaQueCambiar
        : vistaArchivo?.fileError === 'EMPTY_FILE'
          ? a.vacio
          : null;

  return (
    <div className="formulario">
      <p>{t.descripcion}</p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <section aria-labelledby="precios-porcentaje" className="formulario__grupo">
        <h3 id="precios-porcentaje" className="rotulo">
          {t.porcentaje.titulo}
        </h3>
        <p className="formulario__ayuda">{t.porcentaje.ayuda}</p>
        <form className="formulario" onSubmit={(e) => void verPorcentaje(e)}>
          <div className="formulario__par">
            <Seleccion
              etiqueta={t.porcentaje.categoria}
              value={categoriaId}
              opciones={activas.map((c) => ({ valor: c.id, texto: c.name }))}
              onChange={(e) => {
                setCategoriaId(e.target.value);
                setVistaPorcentaje(null);
              }}
            />
            <CampoNumerico
              etiqueta={t.porcentaje.porcentaje}
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                setVistaPorcentaje(null);
              }}
            />
            <Seleccion
              etiqueta={t.porcentaje.redondeo}
              value={redondeo}
              opciones={REDONDEOS.map((r) => ({ valor: r, texto: t.porcentaje.redondeos[r] }))}
              onChange={(e) => {
                setRedondeo(e.target.value as PesoRounding);
                setVistaPorcentaje(null);
              }}
            />
          </div>
          <div className="formulario__acciones">
            <Boton type="submit" variante="secundario">
              {t.porcentaje.verCambios}
            </Boton>
          </div>
        </form>
        {vistaPorcentaje !== null ? (
          <>
            <table className="tabla" aria-label={t.porcentaje.titulo}>
              <thead>
                <tr>
                  <th scope="col">{t.columnas.producto}</th>
                  <th scope="col">{t.columnas.antes}</th>
                  <th scope="col">{t.columnas.despues}</th>
                </tr>
              </thead>
              <tbody>
                {vistaPorcentaje.map((c) => (
                  <tr key={c.product.id}>
                    <th scope="row">{c.product.name}</th>
                    <td>{formatearPesos(c.oldPrice)}</td>
                    <td>{formatearPesos(c.newPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Boton disabled={trabajando} onClick={() => void aplicarPorcentaje()}>
              {t.porcentaje.aplicar(vistaPorcentaje.length)}
            </Boton>
          </>
        ) : null}
      </section>

      <section aria-labelledby="precios-archivo" className="formulario__grupo">
        <h3 id="precios-archivo" className="rotulo">
          {a.titulo}
        </h3>
        <p className="formulario__ayuda">{a.ayuda}</p>
        <div className="formulario__acciones">
          <Boton variante="secundario" onClick={() => void descargarCatalogo()}>
            <Icono nombre="flechaAbajo" />
            {a.descargar}
          </Boton>
        </div>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="archivo-actualizar">
            {a.elegir}
          </label>
          <input
            id="archivo-actualizar"
            className="campo__entrada"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void elegirArchivo(e)}
          />
        </div>
        {errorDeArchivo !== null ? <Aviso tipo="error">{errorDeArchivo}</Aviso> : null}
        {vistaArchivo !== null && vistaArchivo.fileError === null ? (
          <>
            {!vistaArchivo.valid ? <Aviso tipo="error">{a.hayErrores}</Aviso> : null}
            {vistaArchivo.valid && vistaArchivo.updates.length === 0 ? (
              <p role="status">{a.sinCambios}</p>
            ) : null}
            <table className="tabla" aria-label={a.titulo}>
              <thead>
                <tr>
                  <th scope="col">{a.fila}</th>
                  <th scope="col">{a.producto}</th>
                  <th scope="col">{a.cambios}</th>
                </tr>
              </thead>
              <tbody>
                {vistaArchivo.rows.map((fila) => (
                  <tr key={fila.number}>
                    <th scope="row">{fila.number}</th>
                    <td>{fila.update?.before.name ?? '—'}</td>
                    <td>
                      {fila.errors.length > 0 ? (
                        <ul>
                          {fila.errors.map((e) => (
                            <li key={`${e.column ?? 'fila'}-${e.code}`}>
                              {(a.errores as Record<string, string>)[e.code] ??
                                (textos.importar.errores as Record<string, string>)[e.code] ??
                                e.code}
                            </li>
                          ))}
                        </ul>
                      ) : fila.update === null ? (
                        a.sinCambiosFila
                      ) : (
                        <ul>
                          {fila.update.after.name !== fila.update.before.name ? (
                            <li>
                              {a.nombre}: {fila.update.before.name} → {fila.update.after.name}
                            </li>
                          ) : null}
                          {fila.update.after.listPrice !== fila.update.before.listPrice ? (
                            <li>
                              {a.precio}: {formatearPesos(fila.update.before.listPrice)} →{' '}
                              {formatearPesos(fila.update.after.listPrice)}
                            </li>
                          ) : null}
                          {fila.update.after.description !== fila.update.before.description ? (
                            <li>
                              {a.descripcionCampo}: {fila.update.after.description ?? '—'}
                            </li>
                          ) : null}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vistaArchivo.valid && vistaArchivo.updates.length > 0 ? (
              <Boton disabled={trabajando} onClick={() => void aplicarArchivo()}>
                {a.aplicar(vistaArchivo.updates.length)}
              </Boton>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
