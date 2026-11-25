import { useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  createCategory,
  moveCategory,
  sortCategories,
  TEST_FISCAL_DEFAULTS,
  updateCategory,
  type Category,
  type ManageCategoriesDeps,
  type Product,
  type UserRole,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { EtiquetaDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { Tabla } from '../../../shared/ui/Tabla';
import { Tarjeta } from '../../../shared/ui/Tarjeta';

const t = textos.catalogo.categorias;
const errores = textos.catalogo.errores as Record<string, { mensaje: string; queHacer: string }>;

type ComoSeCobra = keyof typeof TEST_FISCAL_DEFAULTS;

export interface CategoriasProps {
  readonly deps: ManageCategoriesDeps;
  readonly actor: { readonly role: UserRole | null };
  readonly categorias: readonly Category[];
  readonly productos: readonly Product[];
  /** Algo cambió: recargar el catálogo. */
  readonly onCambio: () => Promise<void>;
}

/** Categorías del catálogo que administra el administrador: agregar, renombrar, subir y bajar, activar y
 *  desactivar. Nada se borra y una categoría con productos activos no se desactiva [RF-M1-08, ADR-0044]. */
export function Categorias(props: CategoriasProps): ReactElement {
  const { deps, actor } = props;
  const [nombre, setNombre] = useState('');
  const [cobro, setCobro] = useState<ComoSeCobra>('SQUARE_METER');
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ordenadas = sortCategories(props.categorias);
  const activosDe = (id: string): number =>
    props.productos.filter((p) => p.isActive && p.categoryId === id).length;

  function mostrar(
    r: { ok: true } | { ok: false; error: { code: string } },
    exito: string,
  ): boolean {
    if (!r.ok) {
      setAviso(null);
      setError(errores[r.error.code] ?? errores.CATALOG_UNAVAILABLE ?? null);
      return false;
    }
    setError(null);
    setAviso(exito);
    return true;
  }

  async function agregar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    const r = await createCategory(deps, actor, {
      name: nombre,
      fiscalDefaults: TEST_FISCAL_DEFAULTS[cobro],
    });
    if (mostrar(r, t.agregada)) {
      setNombre('');
      await props.onCambio();
    }
  }

  async function guardarNombre(c: Category, nuevo: string): Promise<void> {
    const r = await updateCategory(deps, actor, { ...c, name: nuevo });
    if (mostrar(r, t.guardada)) {
      setRenombrando(null);
      await props.onCambio();
    }
  }

  async function cambiarEstado(c: Category): Promise<void> {
    const r = await updateCategory(deps, actor, { ...c, isActive: !c.isActive });
    if (mostrar(r, c.isActive ? t.desactivada : t.activada)) {
      await props.onCambio();
    }
  }

  async function mover(c: Category, direccion: 'UP' | 'DOWN'): Promise<void> {
    const r = await moveCategory(deps, actor, c.id, direccion);
    if (mostrar(r, t.ordenada)) {
      await props.onCambio();
    }
  }

  return (
    <Tarjeta rotulo={t.titulo}>
      <p className="nota">{t.ayuda}</p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <form
        className="filtros__campos categorias__alta"
        aria-label={t.agregar}
        onSubmit={(e) => {
          void agregar(e);
        }}
      >
        <Campo
          etiqueta={t.nombre}
          value={nombre}
          maxLength={60}
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
        <Seleccion
          etiqueta={t.comoSeCobra}
          value={cobro}
          opciones={[
            { valor: 'SQUARE_METER', texto: t.cobros.SQUARE_METER },
            { valor: 'PIECE', texto: t.cobros.PIECE },
            { valor: 'SERVICE', texto: t.cobros.SERVICE },
          ]}
          onChange={(e) => {
            setCobro(e.target.value as ComoSeCobra);
          }}
        />
        <Boton type="submit" disabled={nombre.trim() === ''}>
          {t.agregar}
        </Boton>
      </form>

      <Tabla
        descripcion={t.titulo}
        claveDeFila={(c) => c.id}
        filas={ordenadas}
        columnas={[
          {
            clave: 'nombre',
            rotulo: t.nombre,
            celda: (c) =>
              renombrando?.id === c.id ? (
                <form
                  className="categorias__renombrar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void guardarNombre(c, renombrando.nombre);
                  }}
                >
                  <Campo
                    etiqueta={t.nuevoNombre(c.name)}
                    value={renombrando.nombre}
                    maxLength={60}
                    onChange={(e) => {
                      setRenombrando({ id: c.id, nombre: e.target.value });
                    }}
                  />
                  <Boton type="submit">{t.guardar}</Boton>
                </form>
              ) : (
                c.name
              ),
          },
          {
            clave: 'productos',
            rotulo: t.productosActivos,
            numerica: true,
            celda: (c) => String(activosDe(c.id)),
          },
          {
            clave: 'estado',
            rotulo: t.estado,
            celda: (c) => (
              <EtiquetaDeEstado
                tono={c.isActive ? 'listo' : 'neutro'}
                texto={c.isActive ? t.activa : t.inactiva}
              />
            ),
          },
          {
            clave: 'acciones',
            rotulo: t.acciones,
            celda: (c) => (
              <span className="tabla__acciones">
                <Boton
                  variante="secundario"
                  aria-label={`${t.subir} ${c.name}`}
                  disabled={ordenadas[0]?.id === c.id}
                  onClick={() => {
                    void mover(c, 'UP');
                  }}
                >
                  ↑
                </Boton>
                <Boton
                  variante="secundario"
                  aria-label={`${t.bajar} ${c.name}`}
                  disabled={ordenadas.at(-1)?.id === c.id}
                  onClick={() => {
                    void mover(c, 'DOWN');
                  }}
                >
                  ↓
                </Boton>
                <Boton
                  variante="secundario"
                  aria-label={`${t.renombrar} ${c.name}`}
                  onClick={() => {
                    setRenombrando({ id: c.id, nombre: c.name });
                  }}
                >
                  {t.renombrar}
                </Boton>
                <Boton
                  variante="secundario"
                  aria-label={`${c.isActive ? t.desactivar : t.activar} ${c.name}`}
                  onClick={() => {
                    void cambiarEstado(c);
                  }}
                >
                  {c.isActive ? t.desactivar : t.activar}
                </Boton>
              </span>
            ),
          },
        ]}
      />
    </Tarjeta>
  );
}
