import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  money,
  ok,
  type CatalogError,
  type Category,
  type CategoryReader,
  type FiscalData,
  type Product,
  type ProductAdmin,
  type ProductReader,
  type Result,
  type SellableProduct,
} from '@zammir/core';

const SIN_PERMISO = '42501';
const VALOR_REPETIDO = '23505';
const LLAVE_FORANEA = '23503';

interface FilaDeCategoria {
  readonly id: string;
  readonly name: string;
  readonly sort_order: number;
  readonly fiscal_product_service_key: string | null;
  readonly fiscal_unit_key: string | null;
  readonly fiscal_tax_object: string | null;
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
}

interface FilaDeProducto extends FilaParaVender {
  readonly is_active: boolean;
  readonly fiscal_product_service_key: string | null;
  readonly fiscal_unit_key: string | null;
  readonly fiscal_tax_object: string | null;
  readonly warranty_months: number | null;
  readonly warranty_text: string | null;
}

const NO_DISPONIBLE: CatalogError = { code: 'CATALOG_UNAVAILABLE' };

function aError(error: { readonly code?: string }): CatalogError {
  switch (error.code) {
    case SIN_PERMISO:
      return { code: 'NOT_AUTHORIZED' };
    case VALOR_REPETIDO:
      return { code: 'CODE_TAKEN' };
    case LLAVE_FORANEA:
      return { code: 'CATEGORY_NOT_FOUND' };
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
  };
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

export type SupabaseCatalog = ProductAdmin & ProductReader & CategoryReader;

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

    async create(producto) {
      const respuesta = await cliente.from('products').insert(aFila(producto)).select().single();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return aProducto(datos as FilaDeProducto);
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
      const respuesta = await cliente.from('products').select('*').order('created_at');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return aLista(datos as FilaDeProducto[], aProducto);
    },

    async listSellable() {
      const respuesta = await cliente.from('sellable_products').select('*').order('name');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return aLista(datos as FilaParaVender[], aParaVender);
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
