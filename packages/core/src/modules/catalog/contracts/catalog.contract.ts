import { describe, expect, it } from 'vitest';

import type { CategoryId, ProductId } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import type { CategoryReader, ProductAdmin, ProductReader } from '../application/ports';
import { INITIAL_CATEGORIES } from '../domain/initial-categories';
import type { Product, ProductDraft } from '../domain/product';

export interface CatalogDelContrato {
  readonly admin: ProductAdmin;
  readonly reader: ProductReader;
  readonly categorias: CategoryReader;
  /** Un identificador de producto nuevo, válido para el almacén (UUID en Supabase). */
  readonly nuevoIdDeProducto: () => ProductId;
  readonly idDeCategoriaInexistente: CategoryId;
  /** Un código que no se ha usado en esta ejecución. */
  readonly codigoNuevo: () => string;
}

function precio(centavos: number) {
  const r = money(centavos);
  if (!r.ok) {
    throw new Error('centavos no válidos');
  }
  return r.value;
}

/** Borrador de producto de prueba completo (sin identificador); `cambios` sobreescribe lo que haga falta. */
export function borradorDePrueba(
  categoryId: CategoryId,
  cambios: Partial<ProductDraft> = {},
): ProductDraft {
  return {
    code: null,
    name: 'Vidrio claro de 6 mm',
    categoryId,
    kind: 'CUSTOM',
    chargeUnit: 'SQUARE_METER',
    listPrice: precio(28_000),
    isTaxExempt: false,
    isActive: true,
    ruleId: 'AREA',
    ruleParams: { measureStepMm: 50, minAreaMm2: null, minAmountCents: null },
    fiscal: { productServiceKey: '01010101', unitKey: 'MTK', taxObject: '02' },
    warrantyMonths: 12,
    warrantyText: 'Cubre defectos de fabricación',
    ...cambios,
  };
}

/** Producto de prueba completo. */
export function productoDePrueba(
  id: ProductId,
  categoryId: CategoryId,
  cambios: Partial<ProductDraft> = {},
): Product {
  return { id, ...borradorDePrueba(categoryId, cambios) };
}

/** Batería de contrato del catálogo: la pasan todos los adaptadores (memoria, Supabase…). */
export function catalogContract(
  nombre: string,
  crear: () => CatalogDelContrato | Promise<CatalogDelContrato>,
): void {
  describe(`contrato del catálogo: ${nombre}`, () => {
    async function primeraCategoria(h: CatalogDelContrato): Promise<CategoryId> {
      const r = await h.categorias.listCategories();
      const primera = r.ok ? r.value[0] : undefined;
      if (primera === undefined) {
        throw new Error('el catálogo debe nacer con categorías');
      }
      return primera.id;
    }

    it('una base nueva trae las categorías iniciales con valores fiscales de prueba, en orden', async () => {
      const h = await crear();
      const r = await h.categorias.listCategories();
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      const ordenadas = [...r.value].sort((a, b) => a.sortOrder - b.sortOrder);
      expect(ordenadas.map((c) => c.name)).toEqual(INITIAL_CATEGORIES.map((c) => c.name));
      expect(ordenadas.map((c) => c.fiscalDefaults)).toEqual(
        INITIAL_CATEGORIES.map((c) => c.fiscalDefaults),
      );
    });

    it('guarda un producto con todos sus datos y lo devuelve igual', async () => {
      const h = await crear();
      const producto = productoDePrueba(h.nuevoIdDeProducto(), await primeraCategoria(h), {
        code: h.codigoNuevo(),
      });
      const creado = await h.admin.create(producto);
      expect(creado.ok && creado.value).toEqual(producto);
      const leido = await h.admin.get(producto.id);
      expect(leido.ok && leido.value).toEqual(producto);
    });

    it('conserva los campos opcionales vacíos como null', async () => {
      const h = await crear();
      const producto = productoDePrueba(h.nuevoIdDeProducto(), await primeraCategoria(h), {
        code: null,
        warrantyMonths: null,
        warrantyText: null,
        fiscal: { productServiceKey: null, unitKey: null, taxObject: null },
        ruleParams: {},
      });
      await h.admin.create(producto);
      const leido = await h.admin.get(producto.id);
      expect(leido.ok && leido.value).toEqual(producto);
    });

    it('los productos aparecen en la lista de administración', async () => {
      const h = await crear();
      const producto = productoDePrueba(h.nuevoIdDeProducto(), await primeraCategoria(h));
      await h.admin.create(producto);
      const lista = await h.admin.list();
      expect(lista.ok && lista.value.some((p) => p.id === producto.id)).toBe(true);
    });

    it('rechaza un código repetido, sin distinguir mayúsculas', async () => {
      const h = await crear();
      const categoria = await primeraCategoria(h);
      const codigo = h.codigoNuevo();
      await h.admin.create(productoDePrueba(h.nuevoIdDeProducto(), categoria, { code: codigo }));
      const repetido = await h.admin.create(
        productoDePrueba(h.nuevoIdDeProducto(), categoria, { code: codigo.toLowerCase() }),
      );
      expect(!repetido.ok && repetido.error.code).toBe('CODE_TAKEN');
    });

    it('varios productos pueden quedar sin código', async () => {
      const h = await crear();
      const categoria = await primeraCategoria(h);
      const a = await h.admin.create(productoDePrueba(h.nuevoIdDeProducto(), categoria));
      const b = await h.admin.create(productoDePrueba(h.nuevoIdDeProducto(), categoria));
      expect(a.ok && b.ok).toBe(true);
    });

    it('rechaza una categoría que no existe', async () => {
      const h = await crear();
      const r = await h.admin.create(
        productoDePrueba(h.nuevoIdDeProducto(), h.idDeCategoriaInexistente),
      );
      expect(!r.ok && r.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('un producto que no existe no se encuentra', async () => {
      const h = await crear();
      const r = await h.admin.get(h.nuevoIdDeProducto());
      expect(!r.ok && r.error.code).toBe('NOT_FOUND');
    });

    it('para vender solo se ven los productos activos', async () => {
      const h = await crear();
      const categoria = await primeraCategoria(h);
      const activo = productoDePrueba(h.nuevoIdDeProducto(), categoria);
      const inactivo = productoDePrueba(h.nuevoIdDeProducto(), categoria, { isActive: false });
      await h.admin.create(activo);
      await h.admin.create(inactivo);

      const lista = await h.reader.listSellable();
      expect(lista.ok && lista.value.some((p) => p.id === activo.id)).toBe(true);
      expect(lista.ok && lista.value.some((p) => p.id === inactivo.id)).toBe(false);

      const encontrado = await h.reader.findSellable(activo.id);
      expect(encontrado.ok).toBe(true);
      const oculto = await h.reader.findSellable(inactivo.id);
      expect(!oculto.ok && oculto.error.code).toBe('NOT_FOUND');
    });

    it('la lectura para vender no expone lo de administración', async () => {
      const h = await crear();
      const producto = productoDePrueba(h.nuevoIdDeProducto(), await primeraCategoria(h));
      await h.admin.create(producto);
      const r = await h.reader.findSellable(producto.id);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const claves = Object.keys(r.value);
        for (const privada of ['fiscal', 'isActive', 'warrantyMonths', 'warrantyText']) {
          expect(claves).not.toContain(privada);
        }
        expect(r.value.listPrice).toBe(producto.listPrice);
        expect(r.value.ruleId).toBe('AREA');
      }
    });
  });
}
