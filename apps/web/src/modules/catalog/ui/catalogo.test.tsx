import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  createPriceRegistry,
  createProduct,
  defaultRules,
  fixedClock,
  inMemoryAuditLog,
  inMemoryCatalog,
  money,
  sequentialIdGenerator,
  type ImportCatalogDeps,
  type ProductDraft,
  type UserRole,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { Catalogo } from './Catalogo';

vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });

const precio = (centavos: number) => {
  const m = money(centavos);
  if (!m.ok) {
    throw new Error('dinero');
  }
  return m.value;
};

async function botonAgregar(): Promise<HTMLElement> {
  const [primero] = await screen.findAllByRole('button', { name: 'Agregar producto' });
  if (primero === undefined) {
    throw new Error('botón Agregar producto');
  }
  return primero;
}

function entorno(): ImportCatalogDeps {
  const catalogo = inMemoryCatalog({
    idGenerator: sequentialIdGenerator('c'),
    clock: fixedClock(new Date('2026-11-03T18:00:00.000Z')),
    auditLog: inMemoryAuditLog(),
  });
  const reglas = createPriceRegistry(defaultRules);
  if (!reglas.ok) {
    throw new Error('registro');
  }
  return {
    products: catalogo,
    categories: catalogo,
    idGenerator: sequentialIdGenerator('p'),
    priceRules: reglas.value,
  };
}

async function categoria(deps: ImportCatalogDeps, parte: string) {
  const r = await deps.categories.listCategories();
  const c = r.ok
    ? r.value.find((x) => x.name.toLowerCase().includes(parte.toLowerCase()))
    : undefined;
  if (c === undefined) {
    throw new Error(`categoría ${parte}`);
  }
  return c;
}

async function sembrar(deps: ImportCatalogDeps): Promise<void> {
  const vidrio = await categoria(deps, 'claro');
  const espejo = await categoria(deps, 'espejo');
  const base = {
    isTaxExempt: false,
    isActive: true,
    ruleParams: {},
    warrantyMonths: null,
    warrantyText: null,
  } as const;
  const borradores: ProductDraft[] = [
    {
      ...base,
      code: 'VC-6',
      name: 'Vidrio claro 6 mm',
      categoryId: vidrio.id,
      kind: 'CUSTOM',
      chargeUnit: 'SQUARE_METER',
      listPrice: precio(28_000),
      ruleId: 'AREA',
      fiscal: vidrio.fiscalDefaults,
    },
    {
      ...base,
      code: 'ES-4',
      name: 'Espejo 4 mm',
      categoryId: espejo.id,
      kind: 'CUSTOM',
      chargeUnit: 'SQUARE_METER',
      listPrice: precio(41_000),
      ruleId: 'AREA',
      fiscal: espejo.fiscalDefaults,
    },
    {
      ...base,
      code: 'MA-1',
      name: 'Marco de madera',
      categoryId: espejo.id,
      kind: 'STANDARD',
      chargeUnit: 'PIECE',
      listPrice: precio(11_600),
      ruleId: 'PIECE',
      fiscal: espejo.fiscalDefaults,
    },
  ];
  for (const b of borradores) {
    const r = await createProduct(deps, { role: 'ADMIN' }, b);
    expect(r.ok).toBe(true);
  }
}

async function montar(opciones: { conProductos?: boolean; rol?: UserRole } = {}) {
  const deps = entorno();
  if (opciones.conProductos !== false) {
    await sembrar(deps);
  }
  render(
    <MemoryRouter>
      <Catalogo deps={deps} actor={{ role: opciones.rol ?? 'ADMIN' }} />
    </MemoryRouter>,
  );
  return deps;
}

describe('Catálogo', () => {
  it('sin productos enseña qué hacer y ofrece agregar el primero', async () => {
    await montar({ conProductos: false });
    expect(await screen.findByText('Todavía no hay productos')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Agregar producto' }).length).toBeGreaterThan(0);
  });

  it('agrupa por categoría con su conteo y resume activos, inactivos y categorías', async () => {
    await montar();
    expect(await screen.findByRole('region', { name: /Vidrio claro.* · 1/ })).toBeTruthy();
    const espejos = screen.getByRole('region', { name: /Espejo.* · 2/ });
    expect(within(espejos).getByText('Marco de madera')).toBeTruthy();
    expect(within(espejos).getByText('$410.00')).toBeTruthy();
    expect(screen.getByText('Productos activos').nextElementSibling?.textContent).toBe('3');
    expect(screen.getByText('Inactivos').nextElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Categorías con productos').nextElementSibling?.textContent).toBe('2');
  });

  it('cada renglón dice cómo se vende, su precio con IVA y su estado', async () => {
    await montar();
    const region = await screen.findByRole('region', { name: /Vidrio claro/ });
    expect(within(region).getByText('A medida · Metro cuadrado')).toBeTruthy();
    expect(within(region).getByText('$280.00')).toBeTruthy();
    expect(within(region).getByText('Activo')).toBeTruthy();
    expect(within(region).getByText('VC-6')).toBeTruthy();
  });

  it('busca sin importar acentos ni mayúsculas, y filtra por categoría y por tipo', async () => {
    await montar();
    await screen.findByText('Vidrio claro 6 mm');
    fireEvent.change(screen.getByLabelText('Buscar por nombre o código'), {
      target: { value: 'ESPEJÓ' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Vidrio claro 6 mm')).toBeNull();
    });
    expect(screen.getByText('Espejo 4 mm')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar por nombre o código'), {
      target: { value: 'zzzz' },
    });
    expect(await screen.findByText('Ningún producto coincide con esa búsqueda.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar por nombre o código'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'STANDARD' } });
    await waitFor(() => {
      expect(screen.queryByText('Vidrio claro 6 mm')).toBeNull();
    });
    expect(screen.getByText('Marco de madera')).toBeTruthy();
  });

  it('agrega un producto desde la ventana y queda en su categoría', async () => {
    const deps = await montar({ conProductos: false });
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), {
      target: { value: 'Cristal doble' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '1,250.50' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await screen.findByText('Producto agregado al catálogo.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value.map((p) => [p.name, p.listPrice, p.isActive])).toEqual([
      ['Cristal doble', 125_050, true],
    ]);
    expect(screen.getByText('$1,250.50')).toBeTruthy();
  });

  it('el metro lineal pide si se mide por largo o por perímetro', async () => {
    const deps = await montar({ conProductos: false });
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), {
      target: { value: 'Perfil de aluminio' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Se cobra por'), {
      target: { value: 'LINEAR_METER' },
    });
    fireEvent.change(await within(dialogo).findByLabelText('El metro lineal se mide por'), {
      target: { value: 'PERIMETER' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '90' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    await screen.findByText('Producto agregado al catálogo.');
    const lista = await deps.products.list();
    expect(lista.ok && lista.value[0]?.ruleParams).toEqual({ basis: 'PERIMETER' });
    expect(lista.ok && lista.value[0]?.chargeUnit).toBe('LINEAR_METER');
  });

  it('un servicio solo se cobra como servicio y una pieza estándar como pieza', async () => {
    await montar({ conProductos: false });
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Tipo'), { target: { value: 'SERVICE' } });
    const unidad = await within(dialogo).findByLabelText<HTMLSelectElement>('Se cobra por');
    await waitFor(() => {
      expect(unidad.value).toBe('SERVICE');
    });
    expect([...unidad.options].map((o) => o.value)).toEqual(['SERVICE']);
    fireEvent.change(within(dialogo).getByLabelText('Tipo'), { target: { value: 'STANDARD' } });
    await waitFor(() => {
      expect(unidad.value).toBe('PIECE');
    });
  });

  it('un producto sin nombre, con precio inválido o con código repetido dice qué hacer y no guarda', async () => {
    const deps = await montar();
    await screen.findByText('Vidrio claro 6 mm');
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '100' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await within(dialogo).findByText('Falta el nombre del producto.')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Algo' } });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: 'abc' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await within(dialogo).findByText('El precio no es válido.')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '100' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Código (opcional)'), {
      target: { value: 'VC-6' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await within(dialogo).findByText('Ese código ya lo usa otro producto.')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Código (opcional)'), {
      target: { value: '' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Garantía sugerida en meses (opcional)'), {
      target: { value: '0' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(
      await within(dialogo).findByText('La garantía debe ser un número de meses mayor a cero.'),
    ).toBeTruthy();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toHaveLength(3);
  });

  it('cambiar el precio lo guarda y deja su historial', async () => {
    const deps = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Vidrio claro 6 mm' }));
    let dialogo = await screen.findByRole('dialog', { name: 'Editar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '300' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy();
    expect(screen.getByText('$300.00')).toBeTruthy();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value.find((p) => p.code === 'VC-6')?.listPrice).toBe(30_000);
    // Al volver a abrirlo se ve el cambio de precio con su fecha.
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Vidrio claro 6 mm' }));
    dialogo = await screen.findByRole('dialog', { name: 'Editar producto' });
    expect(within(dialogo).getByText('Cambios de precio')).toBeTruthy();
    expect(within(dialogo).getByText(/\$280\.00 → \$300\.00/)).toBeTruthy();
    expect(within(dialogo).getByLabelText<HTMLInputElement>('Nombre').value).toBe(
      'Vidrio claro 6 mm',
    );
  });

  it('desactivar conserva el producto y se puede volver a activar', async () => {
    const deps = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar Espejo 4 mm' }));
    expect(
      await screen.findByText('Producto desactivado: ya no sale para vender, pero se conserva.'),
    ).toBeTruthy();
    expect(screen.getByText('Inactivo')).toBeTruthy();
    expect(screen.getByText('Inactivos').nextElementSibling?.textContent).toBe('1');
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toHaveLength(3);
    expect(lista.ok && lista.value.find((p) => p.code === 'ES-4')?.isActive).toBe(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Activar Espejo 4 mm' }));
    expect(await screen.findByText('Producto activado: ya se puede vender.')).toBeTruthy();
  });

  it('quien no es administrador no puede cambiar el catálogo', async () => {
    const deps = await montar({ rol: 'STAFF' });
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar Espejo 4 mm' }));
    expect(await screen.findByText('Solo los administradores cambian el catálogo.')).toBeTruthy();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value.find((p) => p.code === 'ES-4')?.isActive).toBe(true);
  });

  it('importar abre la ventana con el archivo y la plantilla, y se cierra con Escape', async () => {
    await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Importar desde archivo' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Importar el catálogo' });
    expect(within(dialogo).getByLabelText('Archivo CSV con tus productos')).toBeTruthy();
    expect(within(dialogo).getByRole('button', { name: 'Descargar plantilla' })).toBeTruthy();
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelar el formulario no cambia nada', async () => {
    const deps = await montar();
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toHaveLength(3);
  });
});
