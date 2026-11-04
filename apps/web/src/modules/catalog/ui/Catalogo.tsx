import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  createProduct,
  searchProducts,
  updateProduct,
  type Category,
  type ImportCatalogDeps,
  type PriceChange,
  type Product,
  type ProductDraft,
  type ProductKind,
  type UserRole,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { EtiquetaDeEstado } from '../../../shared/ui/EtiquetaDeEstado';
import { Icono } from '../../../shared/ui/Icono';
import { Indicador } from '../../../shared/ui/Indicador';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { Campo } from '../../../shared/ui/Campo';
import { Tabla } from '../../../shared/ui/Tabla';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { Ventana } from '../../../shared/ui/Ventana';
import { formatearPesos } from '../../../shared/ui/formatos';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';
import { FormularioDeProducto } from './FormularioDeProducto';
import { ImportarCatalogo } from './ImportarCatalogo';

const t = textos.catalogo;

type Ventanilla =
  | { readonly tipo: 'alta' }
  | { readonly tipo: 'edicion'; readonly producto: Product }
  | { readonly tipo: 'importar' }
  | null;

export interface CatalogoProps {
  readonly deps: ImportCatalogDeps;
  readonly actor: { readonly role: UserRole | null };
}

/** Catálogo para administradores: ver, buscar y filtrar los productos por categoría; dar de alta, editar y
 *  desactivar (nada se borra); e importar desde un archivo [RF-M1-03 a RF-M1-06]. */
export function Catalogo({ deps, actor }: CatalogoProps): ReactElement {
  const [productos, setProductos] = useState<readonly Product[]>([]);
  const [categorias, setCategorias] = useState<readonly Category[]>([]);
  const [cargado, setCargado] = useState(false);
  const [texto, setTexto] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [ventana, setVentana] = useState<Ventanilla>(null);
  const [historial, setHistorial] = useState<readonly PriceChange[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);

  const refrescar = useCallback(async () => {
    const [p, c] = await Promise.all([deps.products.list(), deps.categories.listCategories()]);
    if (p.ok && c.ok) {
      setProductos(p.value);
      setCategorias([...c.value].sort((a, b) => a.sortOrder - b.sortOrder));
      setError(null);
    } else {
      setError(t.errores.CATALOG_UNAVAILABLE);
    }
    setCargado(true);
  }, [deps]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const visibles = useMemo(
    () =>
      searchProducts(productos, {
        text: texto,
        ...(categoriaFiltro === '' ? {} : { categoryId: categoriaFiltro as Product['categoryId'] }),
        ...(tipoFiltro === '' ? {} : { kind: tipoFiltro as ProductKind }),
      }),
    [productos, texto, categoriaFiltro, tipoFiltro],
  );

  function mostrarError(codigo: string): void {
    const clave = (codigo in t.errores ? codigo : 'CATALOG_UNAVAILABLE') as keyof typeof t.errores;
    setError(t.errores[clave]);
  }

  async function abrirEdicion(producto: Product): Promise<void> {
    const r = await deps.products.priceHistory(producto.id);
    setHistorial(r.ok ? r.value : []);
    setVentana({ tipo: 'edicion', producto });
  }

  async function guardarAlta(borrador: ProductDraft): Promise<string | null> {
    const r = await createProduct(deps, actor, borrador);
    if (!r.ok) {
      return r.error.code;
    }
    setVentana(null);
    setAviso(t.avisos.creado);
    await refrescar();
    return null;
  }

  async function guardarEdicion(producto: Product, borrador: ProductDraft): Promise<string | null> {
    const r = await updateProduct(deps, actor, producto.id, borrador);
    if (!r.ok) {
      return r.error.code;
    }
    setVentana(null);
    setAviso(t.avisos.guardado);
    await refrescar();
    return null;
  }

  async function alternar(producto: Product): Promise<void> {
    setAviso(null);
    const r = await updateProduct(deps, actor, producto.id, {
      ...producto,
      isActive: !producto.isActive,
    });
    if (!r.ok) {
      mostrarError(r.error.code);
      return;
    }
    setError(null);
    setAviso(producto.isActive ? t.avisos.desactivado : t.avisos.activado);
    await refrescar();
  }

  const activos = productos.filter((p) => p.isActive).length;
  const grupos = categorias
    .map((c) => ({ categoria: c, productos: visibles.filter((p) => p.categoryId === c.id) }))
    .filter((g) => g.productos.length > 0);
  const categoriasEnUso = new Set(productos.map((p) => p.categoryId)).size;

  return (
    <section className="anima-entrada catalogo">
      <EncabezadoDePagina
        titulo={t.titulo}
        descripcion={t.descripcion}
        acciones={
          <>
            <Boton
              onClick={() => {
                setAviso(null);
                setVentana({ tipo: 'alta' });
              }}
            >
              <Icono nombre="catalogo" />
              {t.agregar}
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                setAviso(null);
                setVentana({ tipo: 'importar' });
              }}
            >
              {t.importar}
            </Boton>
          </>
        }
      />
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <div className="indicadores">
        <Indicador rotulo={t.resumen.activos} valor={String(activos)} tono="exito" />
        <Indicador rotulo={t.resumen.inactivos} valor={String(productos.length - activos)} />
        <Indicador rotulo={t.resumen.categorias} valor={String(categoriasEnUso)} />
      </div>

      <Tarjeta rotulo={t.filtros.titulo}>
        <div className="filtros__campos">
          <Campo
            etiqueta={t.filtros.buscar}
            type="search"
            autoComplete="off"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
            }}
          />
          <Seleccion
            etiqueta={t.filtros.categoria}
            value={categoriaFiltro}
            opciones={[
              { valor: '', texto: t.filtros.todas },
              ...categorias.map((c) => ({ valor: c.id, texto: c.name })),
            ]}
            onChange={(e) => {
              setCategoriaFiltro(e.target.value);
            }}
          />
          <Seleccion
            etiqueta={t.filtros.tipo}
            value={tipoFiltro}
            opciones={[
              { valor: '', texto: t.filtros.todos },
              ...(['CUSTOM', 'STANDARD', 'SERVICE'] as const).map((k) => ({
                valor: k,
                texto: t.tipos[k],
              })),
            ]}
            onChange={(e) => {
              setTipoFiltro(e.target.value);
            }}
          />
        </div>
      </Tarjeta>

      {cargado && productos.length === 0 ? (
        <EstadoVacio titulo={t.vacioTitulo} descripcion={t.vacio} icono="catalogo">
          <Boton
            onClick={() => {
              setVentana({ tipo: 'alta' });
            }}
          >
            {t.agregar}
          </Boton>
        </EstadoVacio>
      ) : null}
      {cargado && productos.length > 0 && visibles.length === 0 ? (
        <p className="mostrador__vacio">{t.sinResultados}</p>
      ) : null}

      {grupos.map((g) => (
        <Tarjeta
          key={g.categoria.id}
          rotulo={`${g.categoria.name} · ${String(g.productos.length)}`}
        >
          <Tabla
            descripcion={g.categoria.name}
            claveDeFila={(p) => p.id}
            filas={g.productos}
            columnas={[
              {
                clave: 'producto',
                rotulo: t.columnas.producto,
                celda: (p) => (
                  <>
                    {p.name}
                    {p.code !== null ? <small className="catalogo__codigo"> {p.code}</small> : null}
                  </>
                ),
              },
              {
                clave: 'venta',
                rotulo: t.columnas.venta,
                celda: (p) => `${t.tipos[p.kind]} · ${t.unidades[p.chargeUnit]}`,
              },
              {
                clave: 'precio',
                rotulo: t.columnas.precio,
                numerica: true,
                celda: (p) => formatearPesos(p.listPrice),
              },
              {
                clave: 'estado',
                rotulo: t.columnas.estado,
                celda: (p) => (
                  <EtiquetaDeEstado
                    tono={p.isActive ? 'listo' : 'entregado'}
                    texto={p.isActive ? t.activo : t.inactivo}
                  />
                ),
              },
              {
                clave: 'acciones',
                rotulo: t.columnas.acciones,
                celda: (p) => (
                  <span className="tabla__acciones">
                    <Boton
                      variante="secundario"
                      aria-label={`${t.editar} ${p.name}`}
                      onClick={() => {
                        setAviso(null);
                        void abrirEdicion(p);
                      }}
                    >
                      {t.editar}
                    </Boton>
                    <Boton
                      variante="secundario"
                      aria-label={`${p.isActive ? t.desactivar : t.activar} ${p.name}`}
                      onClick={() => {
                        void alternar(p);
                      }}
                    >
                      {p.isActive ? t.desactivar : t.activar}
                    </Boton>
                  </span>
                ),
              },
            ]}
          />
        </Tarjeta>
      ))}

      {ventana?.tipo === 'alta' ? (
        <Ventana
          titulo={t.formulario.tituloAlta}
          onCerrar={() => {
            setVentana(null);
          }}
        >
          <FormularioDeProducto
            categorias={categorias}
            onGuardar={guardarAlta}
            onCancelar={() => {
              setVentana(null);
            }}
          />
        </Ventana>
      ) : null}
      {ventana?.tipo === 'edicion' ? (
        <Ventana
          titulo={t.formulario.tituloEdicion}
          onCerrar={() => {
            setVentana(null);
          }}
        >
          <FormularioDeProducto
            categorias={categorias}
            inicial={ventana.producto}
            historial={historial}
            onGuardar={(borrador) => guardarEdicion(ventana.producto, borrador)}
            onCancelar={() => {
              setVentana(null);
            }}
          />
        </Ventana>
      ) : null}
      {ventana?.tipo === 'importar' ? (
        <Ventana
          titulo={textos.importar.titulo}
          onCerrar={() => {
            setVentana(null);
            void refrescar();
          }}
        >
          <ImportarCatalogo
            deps={deps}
            sinTitulo
            onImportado={() => {
              void refrescar();
            }}
          />
        </Ventana>
      ) : null}
    </section>
  );
}

/** El catálogo con la sesión del administrador que lo abrió. */
export function CatalogoDelAdministrador({
  deps,
}: {
  readonly deps: ImportCatalogDeps;
}): ReactElement {
  const { usuario } = useSesionAdmin();
  return <Catalogo deps={deps} actor={{ role: usuario?.role ?? null }} />;
}
