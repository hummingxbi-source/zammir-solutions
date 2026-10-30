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
  /** Entradas de bitácora de un producto, leídas por un camino independiente del puerto. */
  readonly bitacoraDeProducto: (id: ProductId) => Promise<readonly EntradaDeBitacora[]>;
}

export interface EntradaDeBitacora {
  readonly action: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
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

    describe('alta en lote', () => {
      it('guarda todos los productos del lote', async () => {
        const h = await crear();
        const categoria = await primeraCategoria(h);
        const lote = [1, 2, 3].map((n) =>
          productoDePrueba(h.nuevoIdDeProducto(), categoria, {
            name: `Lote ${String(n)}`,
            code: h.codigoNuevo(),
          }),
        );
        const r = await h.admin.createMany(lote);
        expect(r.ok && r.value.map((p) => p.id)).toEqual(lote.map((p) => p.id));
        for (const producto of lote) {
          const leido = await h.admin.get(producto.id);
          expect(leido.ok && leido.value).toEqual(producto);
        }
      });

      it('un lote vacío no hace nada y no falla', async () => {
        const h = await crear();
        const r = await h.admin.createMany([]);
        expect(r.ok && r.value).toEqual([]);
      });

      it('todo o nada: un código repetido dentro del lote no deja guardar ninguno', async () => {
        const h = await crear();
        const categoria = await primeraCategoria(h);
        const repetido = h.codigoNuevo();
        const lote = [
          productoDePrueba(h.nuevoIdDeProducto(), categoria, { code: h.codigoNuevo() }),
          productoDePrueba(h.nuevoIdDeProducto(), categoria, { code: repetido }),
          productoDePrueba(h.nuevoIdDeProducto(), categoria, { code: repetido.toUpperCase() }),
        ];
        const r = await h.admin.createMany(lote);
        expect(!r.ok && r.error.code).toBe('CODE_TAKEN');
        for (const producto of lote) {
          const leido = await h.admin.get(producto.id);
          expect(!leido.ok && leido.error.code).toBe('NOT_FOUND');
        }
      });

      it('todo o nada: un código que ya existe en el catálogo no deja guardar ninguno', async () => {
        const h = await crear();
        const categoria = await primeraCategoria(h);
        const existente = productoDePrueba(h.nuevoIdDeProducto(), categoria, {
          code: h.codigoNuevo(),
        });
        await h.admin.create(existente);
        const nuevo = productoDePrueba(h.nuevoIdDeProducto(), categoria, { code: h.codigoNuevo() });
        const choque = productoDePrueba(h.nuevoIdDeProducto(), categoria, { code: existente.code });
        const r = await h.admin.createMany([nuevo, choque]);
        expect(!r.ok && r.error.code).toBe('CODE_TAKEN');
        const leido = await h.admin.get(nuevo.id);
        expect(!leido.ok && leido.error.code).toBe('NOT_FOUND');
      });

      it('todo o nada: una categoría que no existe no deja guardar ninguno', async () => {
        const h = await crear();
        const categoria = await primeraCategoria(h);
        const bueno = productoDePrueba(h.nuevoIdDeProducto(), categoria);
        const malo = productoDePrueba(h.nuevoIdDeProducto(), h.idDeCategoriaInexistente);
        const r = await h.admin.createMany([bueno, malo]);
        expect(!r.ok && r.error.code).toBe('CATEGORY_NOT_FOUND');
        const leido = await h.admin.get(bueno.id);
        expect(!leido.ok && leido.error.code).toBe('NOT_FOUND');
      });
    });

    describe('edición y desactivación', () => {
      async function conProducto(h: CatalogDelContrato, cambios: Partial<Product> = {}) {
        const producto = productoDePrueba(
          h.nuevoIdDeProducto(),
          await primeraCategoria(h),
          cambios,
        );
        await h.admin.create(producto);
        return producto;
      }

      it('guarda los cambios y los devuelve', async () => {
        const h = await crear();
        const original = await conProducto(h);
        const cambiado = { ...original, name: 'Vidrio claro de 6 mm (nuevo)', isTaxExempt: true };
        const r = await h.admin.update(cambiado);
        expect(r.ok && r.value).toEqual(cambiado);
        const leido = await h.admin.get(original.id);
        expect(leido.ok && leido.value).toEqual(cambiado);
      });

      it('un producto que no existe no se puede editar', async () => {
        const h = await crear();
        const fantasma = productoDePrueba(h.nuevoIdDeProducto(), await primeraCategoria(h));
        const r = await h.admin.update(fantasma);
        expect(!r.ok && r.error.code).toBe('NOT_FOUND');
      });

      it('no deja usar el código de otro producto, pero sí conservar el propio', async () => {
        const h = await crear();
        const a = await conProducto(h, { code: h.codigoNuevo() });
        const b = await conProducto(h, { code: h.codigoNuevo() });
        const choque = await h.admin.update({ ...b, code: a.code });
        expect(!choque.ok && choque.error.code).toBe('CODE_TAKEN');
        const igual = await h.admin.update({ ...a, name: 'Mismo código' });
        expect(igual.ok).toBe(true);
      });

      it('rechaza pasar el producto a una categoría que no existe', async () => {
        const h = await crear();
        const original = await conProducto(h);
        const r = await h.admin.update({ ...original, categoryId: h.idDeCategoriaInexistente });
        expect(!r.ok && r.error.code).toBe('CATEGORY_NOT_FOUND');
      });

      it('un cambio de precio queda en el historial y en la bitácora con el valor anterior y el nuevo', async () => {
        const h = await crear();
        const original = await conProducto(h);
        const nuevoPrecio = precio(31_500);
        await h.admin.update({ ...original, listPrice: nuevoPrecio });
        const siguiente = precio(33_000);
        await h.admin.update({ ...original, listPrice: siguiente });

        const historial = await h.admin.priceHistory(original.id);
        expect(historial.ok).toBe(true);
        if (historial.ok) {
          expect(historial.value.map((c) => [c.oldPrice, c.newPrice])).toEqual([
            [28_000, 31_500],
            [31_500, 33_000],
          ]);
          expect(historial.value[0]?.productId).toBe(original.id);
        }
        expect(await h.bitacoraDeProducto(original.id)).toEqual([
          {
            action: 'PRODUCT_PRICE_CHANGED',
            oldValue: { precio_centavos: 28_000 },
            newValue: { precio_centavos: 31_500 },
          },
          {
            action: 'PRODUCT_PRICE_CHANGED',
            oldValue: { precio_centavos: 31_500 },
            newValue: { precio_centavos: 33_000 },
          },
        ]);
      });

      it('guardar sin cambiar el precio no deja historial ni bitácora', async () => {
        const h = await crear();
        const original = await conProducto(h);
        await h.admin.update({ ...original, name: 'Solo cambia el nombre' });
        const historial = await h.admin.priceHistory(original.id);
        expect(historial.ok && historial.value).toEqual([]);
        expect(await h.bitacoraDeProducto(original.id)).toEqual([]);
      });

      it('desactivar quita el producto de la venta, lo conserva y deja bitácora; reactivarlo también', async () => {
        const h = await crear();
        const original = await conProducto(h);
        await h.admin.update({ ...original, isActive: false });

        const vendible = await h.reader.findSellable(original.id);
        expect(!vendible.ok && vendible.error.code).toBe('NOT_FOUND');
        const guardado = await h.admin.get(original.id);
        expect(guardado.ok && guardado.value.isActive).toBe(false);
        const lista = await h.admin.list();
        expect(lista.ok && lista.value.some((p) => p.id === original.id)).toBe(true);

        await h.admin.update({ ...original, isActive: true });
        const devuelto = await h.reader.findSellable(original.id);
        expect(devuelto.ok).toBe(true);
        expect(await h.bitacoraDeProducto(original.id)).toEqual([
          {
            action: 'PRODUCT_DEACTIVATED',
            oldValue: { activo: true },
            newValue: { activo: false },
          },
          { action: 'PRODUCT_ACTIVATED', oldValue: { activo: false }, newValue: { activo: true } },
        ]);
      });

      it('el puerto de administración no tiene operación de borrado', async () => {
        const h = await crear();
        for (const operacion of ['delete', 'remove', 'destroy']) {
          expect(operacion in h.admin).toBe(false);
        }
      });
    });
  });
}
