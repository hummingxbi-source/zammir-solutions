import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  money,
  ok,
  type BundleItem,
  type CatalogError,
  type CatalogReplicaSource,
  type ReplicatedProduct,
  type Category,
  type PriceChange,
  type CategoryAdmin,
  type CategoryReader,
  type FiscalData,
  type Product,
  type ProductAdmin,
  type ProductReader,
  type Result,
  type SellableProduct,
} from '@zammir/core';
import { leerTodo } from '../../../shared/infra/leer-todo';

const SIN_PERMISO = '42501';
const VALOR_REPETIDO = '23505';
/** El disparador que impide desactivar una categoría con productos activos [RF-M1-08]. */
const CATEGORIA_EN_USO = '23514';
const LLAVE_FORANEA = '23503';

interface FilaDeCategoria {
  readonly id: string;
  readonly name: string;
  readonly sort_order: number;
  readonly fiscal_product_service_key: string | null;
  readonly fiscal_unit_key: string | null;
  readonly fiscal_tax_object: string | null;
  /** Antes de RF-M1-08 la tabla no la tenía. */
  readonly is_active?: boolean;
}

interface FilaParaVender {
  readonly id: string;
  readonly code: string | null;
  readonly name: string;
  readonly category_id: string;
  readonly kind: Product['kind'];
  readonly charge_unit: Product['chargeUnit'];
  readonly list_price_cents: number;
  readonly is_tax_exempt: boolean;
  readonly rule_id: string;
  readonly rule_params: unknown;
  /** Precio abierto [RF-M1-10]. Antes de CE-01 la vista no la traía. */
  readonly is_open_price?: boolean;
  /** Descripción [RF-M1-13]. Antes de CE-04 la vista no la traía. */
  readonly description?: string | null;
  readonly sale_unit_name?: string | null;
  readonly bundle_items?: unknown;
}

interface FilaReplicada extends FilaParaVender {
  readonly is_active: boolean;
  readonly change_seq: number;
}

interface FilaDeProducto extends FilaParaVender {
  readonly is_active: boolean;
  readonly fiscal_product_service_key: string | null;
  readonly fiscal_unit_key: string | null;
  readonly fiscal_tax_object: string | null;
  readonly warranty_months: number | null;
  readonly warranty_text: string | null;
}

interface FilaDeCambio {
  readonly product_id: string;
  readonly old_price_cents: number;
  readonly new_price_cents: number;
  readonly changed_at: string;
}

const NO_DISPONIBLE: CatalogError = { code: 'CATALOG_UNAVAILABLE' };

/** Cuántos identificadores caben en un `in(...)` sin pasar el largo máximo de la dirección. */
const GRUPO_DE_IDS = 150;

/** Lo que lanza `update_products_in_bulk` cuando un producto del lote no existe (no_data_found). */
const SIN_DATOS = 'P0002';

function aError(error: { readonly code?: string }): CatalogError {
  switch (error.code) {
    case SIN_PERMISO:
      return { code: 'NOT_AUTHORIZED' };
    case VALOR_REPETIDO:
      return { code: 'CODE_TAKEN' };
    case LLAVE_FORANEA:
      return { code: 'CATEGORY_NOT_FOUND' };
    case SIN_DATOS:
      return { code: 'NOT_FOUND' };
    default:
      return NO_DISPONIBLE;
  }
}

function fiscal(fila: {
  fiscal_product_service_key: string | null;
  fiscal_unit_key: string | null;
  fiscal_tax_object: string | null;
}): FiscalData {
  return {
    productServiceKey: fila.fiscal_product_service_key,
    unitKey: fila.fiscal_unit_key,
    taxObject: fila.fiscal_tax_object,
  };
}

function aCategoria(fila: FilaDeCategoria): Category {
  return {
    id: asId<'Category'>(fila.id),
    name: fila.name,
    sortOrder: fila.sort_order,
    fiscalDefaults: fiscal(fila),
    isActive: fila.is_active ?? true,
  };
}

function aFilaDeCategoria(c: Category): FilaDeCategoria {
  return {
    id: c.id,
    name: c.name,
    sort_order: c.sortOrder,
    fiscal_product_service_key: c.fiscalDefaults.productServiceKey,
    fiscal_unit_key: c.fiscalDefaults.unitKey,
    fiscal_tax_object: c.fiscalDefaults.taxObject,
    is_active: c.isActive,
  };
}

/** Errores al guardar una categoría [RF-M1-08]: nombre repetido o desactivar con productos activos. */
function aErrorDeCategoria(error: { readonly code?: string }): CatalogError {
  if (error.code === VALOR_REPETIDO) {
    return { code: 'CATEGORY_NAME_TAKEN' };
  }
  if (error.code === CATEGORIA_EN_USO) {
    return { code: 'CATEGORY_IN_USE' };
  }
  return aError(error);
}

function aParaVender(fila: FilaParaVender): Result<SellableProduct, CatalogError> {
  const precio = money(fila.list_price_cents);
  if (!precio.ok) {
    return err(NO_DISPONIBLE);
  }
  return ok({
    id: asId<'Product'>(fila.id),
    code: fila.code,
    name: fila.name,
    categoryId: asId<'Category'>(fila.category_id),
    kind: fila.kind,
    chargeUnit: fila.charge_unit,
    listPrice: precio.value,
    isTaxExempt: fila.is_tax_exempt,
    ruleId: fila.rule_id,
    ruleParams: fila.rule_params,
    ...(fila.is_open_price === true ? { isOpenPrice: true } : {}),
    ...(fila.description === null || fila.description === undefined
      ? {}
      : { description: fila.description }),
    ...(fila.sale_unit_name === null || fila.sale_unit_name === undefined
      ? {}
      : { saleUnitName: fila.sale_unit_name }),
    ...(fila.kind === 'BUNDLE' ? { bundleItems: componentes(fila.bundle_items) } : {}),
  });
}

/** Los componentes de un paquete como vienen de la base (jsonb); lo que no tenga la forma esperada se omite y
 *  el paquete no se podrá agregar, en lugar de romper la lectura del catálogo [RF-M1-18]. */
function componentes(crudo: unknown): readonly BundleItem[] {
  if (!Array.isArray(crudo)) {
    return [];
  }
  return crudo.flatMap((c: unknown) => {
    const item = c as { productId?: unknown; quantity?: unknown } | null;
    return typeof item?.productId === 'string' && typeof item.quantity === 'number'
      ? [{ productId: asId<'Product'>(item.productId), quantity: item.quantity }]
      : [];
  });
}

function aProducto(fila: FilaDeProducto): Result<Product, CatalogError> {
  const basico = aParaVender(fila);
  if (!basico.ok) {
    return basico;
  }
  return ok({
    ...basico.value,
    isActive: fila.is_active,
    fiscal: fiscal(fila),
    warrantyMonths: fila.warranty_months,
    warrantyText: fila.warranty_text,
  });
}

function aCambio(fila: FilaDeCambio): Result<PriceChange, CatalogError> {
  const anterior = money(fila.old_price_cents);
  const nuevo = money(fila.new_price_cents);
  if (!anterior.ok || !nuevo.ok) {
    return err(NO_DISPONIBLE);
  }
  return ok({
    productId: asId<'Product'>(fila.product_id),
    oldPrice: anterior.value,
    newPrice: nuevo.value,
    changedAt: new Date(fila.changed_at),
  });
}

function aFila(p: Product) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category_id: p.categoryId,
    kind: p.kind,
    charge_unit: p.chargeUnit,
    list_price_cents: p.listPrice,
    is_tax_exempt: p.isTaxExempt,
    is_active: p.isActive,
    rule_id: p.ruleId,
    rule_params: p.ruleParams,
    is_open_price: p.isOpenPrice === true,
    description: p.description ?? null,
    sale_unit_name: p.saleUnitName ?? null,
    bundle_items: p.bundleItems ?? [],
    fiscal_product_service_key: p.fiscal.productServiceKey,
    fiscal_unit_key: p.fiscal.unitKey,
    fiscal_tax_object: p.fiscal.taxObject,
    warranty_months: p.warrantyMonths,
    warranty_text: p.warrantyText,
  };
}

/** Convierte una lista de filas; si alguna no vale, avisa en lugar de devolver el catálogo a medias. */
function aLista<F, T>(
  filas: readonly F[],
  convertir: (fila: F) => Result<T, CatalogError>,
): Result<readonly T[], CatalogError> {
  const resultado: T[] = [];
  for (const fila of filas) {
    const convertida = convertir(fila);
    if (!convertida.ok) {
      return convertida;
    }
    resultado.push(convertida.value);
  }
  return ok(resultado);
}

export type SupabaseCatalog = ProductAdmin & ProductReader & CategoryReader & CategoryAdmin;

/** Adaptador de los puertos del catálogo sobre las tablas `products`, `product_categories`
 *  y la vista `sellable_products`. Los permisos los decide la base (RLS), no este código. */
export function supabaseCatalog(cliente: SupabaseClient): SupabaseCatalog {
  return {
    async listCategories() {
      const respuesta = await cliente.from('product_categories').select('*').order('sort_order');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok((datos as FilaDeCategoria[]).map(aCategoria));
    },

    async createCategory(categoria) {
      const r = await cliente
        .from('product_categories')
        .insert(aFilaDeCategoria(categoria))
        .select()
        .single();
      return r.error !== null
        ? err(aErrorDeCategoria(r.error))
        : ok(aCategoria(r.data as FilaDeCategoria));
    },

    async updateCategory(categoria) {
      const { id, ...cambios } = aFilaDeCategoria(categoria);
      const r = await cliente
        .from('product_categories')
        .update(cambios)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (r.error !== null) {
        return err(aErrorDeCategoria(r.error));
      }
      return r.data === null
        ? err({ code: 'NOT_FOUND' })
        : ok(aCategoria(r.data as FilaDeCategoria));
    },

    async create(producto) {
      const respuesta = await cliente.from('products').insert(aFila(producto)).select().single();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return aProducto(datos as FilaDeProducto);
    },

    async createMany(lote) {
      if (lote.length === 0) {
        return ok([]);
      }
      // Una sola instrucción: la base guarda todos los productos o ninguno.
      const respuesta = await cliente.from('products').insert(lote.map(aFila)).select();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      const filas = datos as FilaDeProducto[];
      if (filas.length === lote.length) {
        return aLista(filas, aProducto);
      }
      // La respuesta pudo llegar recortada por el tope de filas: se vuelven a leer por sus identificadores,
      // en grupos chicos para no pasar el largo máximo de la dirección [AJ-01].
      const ids = lote.map((p) => p.id);
      const leidas: FilaDeProducto[] = [];
      for (let i = 0; i < ids.length; i += GRUPO_DE_IDS) {
        const grupo = await cliente
          .from('products')
          .select('*')
          .in('id', ids.slice(i, i + GRUPO_DE_IDS));
        if (grupo.error !== null) {
          return err(aError(grupo.error));
        }
        leidas.push(...(grupo.data as FilaDeProducto[]));
      }
      return leidas.length === lote.length ? aLista(leidas, aProducto) : err(NO_DISPONIBLE);
    },

    async updateMany(cambios) {
      if (cambios.length === 0) {
        return ok([]);
      }
      // Una sola llamada a la base: cambia todos o ninguno, con su historial y su bitácora [RF-M1-15].
      const respuesta = await cliente.rpc('update_products_in_bulk', {
        p_changes: cambios.map((c) => ({
          id: c.id,
          name: c.name,
          listPriceCents: c.listPrice,
          description: c.description,
        })),
      });
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return aLista(respuesta.data as FilaDeProducto[], aProducto);
    },

    async update(producto) {
      const { id, ...cambios } = aFila(producto);
      const respuesta = await cliente
        .from('products')
        .update(cambios)
        .eq('id', id)
        .select()
        .maybeSingle();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      // Sin renglón: no existe, o la base no dejó verlo ni cambiarlo (RLS).
      return datos === null ? err({ code: 'NOT_FOUND' }) : aProducto(datos as FilaDeProducto);
    },

    async priceHistory(id) {
      const respuesta = await cliente
        .from('product_price_history')
        .select('*')
        .eq('product_id', id)
        .order('changed_at');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return aLista(datos as FilaDeCambio[], aCambio);
    },

    async get(id) {
      const respuesta = await cliente.from('products').select('*').eq('id', id).maybeSingle();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return datos === null ? err({ code: 'NOT_FOUND' }) : aProducto(datos as FilaDeProducto);
    },

    async list() {
      // Por páginas: un catálogo de más de 1000 productos no se corta [AJ-01].
      const r = await leerTodo<FilaDeProducto, CatalogError>(
        (desde, hasta) =>
          cliente.from('products').select('*').order('created_at').order('id').range(desde, hasta),
        (e) => aError(e as { readonly code?: string }),
      );
      return r.ok ? aLista(r.filas, aProducto) : err(r.error);
    },

    async listSellable() {
      const r = await leerTodo<FilaParaVender, CatalogError>(
        (desde, hasta) =>
          cliente
            .from('sellable_products')
            .select('*')
            .order('name')
            .order('id')
            .range(desde, hasta),
        (e) => aError(e as { readonly code?: string }),
      );
      return r.ok ? aLista(r.filas, aParaVender) : err(r.error);
    },

    async findSellable(id) {
      const respuesta = await cliente
        .from('sellable_products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return datos === null ? err({ code: 'NOT_FOUND' }) : aParaVender(datos as FilaParaVender);
    },
  };
}

function aReplicado(fila: FilaReplicada): Result<ReplicatedProduct, CatalogError> {
  const basico = aParaVender(fila);
  return basico.ok
    ? ok({ ...basico.value, isActive: fila.is_active, changeSeq: fila.change_seq })
    : basico;
}

/** Fuente de la réplica del catálogo: la vista `catalog_products_for_device` (productos activos o no,
 *  con su número de cambio) y las categorías. Solo la leen administradores y tablets activas. */
export function supabaseCatalogReplica(cliente: SupabaseClient): CatalogReplicaSource {
  return {
    async productsChangedAfter(seq, limit) {
      const respuesta = await cliente
        .from('catalog_products_for_device')
        .select('*')
        .gt('change_seq', seq)
        .order('change_seq')
        .limit(limit);
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return aLista(datos as FilaReplicada[], aReplicado);
    },
    categories: () => supabaseCatalog(cliente).listCategories(),
  };
}
