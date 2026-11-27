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
  type ProductDraft,
  type UserRole,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { Catalogo, type CatalogoDeps } from './Catalogo';

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

function entorno(): CatalogoDeps {
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

async function categoria(deps: CatalogoDeps, parte: string) {
  const r = await deps.categories.listCategories();
  const c = r.ok
    ? r.value.find((x) => x.name.toLowerCase().includes(parte.toLowerCase()))
    : undefined;
  if (c === undefined) {
    throw new Error(`categoría ${parte}`);
  }
  return c;
}

async function sembrar(deps: CatalogoDeps): Promise<void> {
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

  it('un servicio con precio abierto se guarda con su marca; un cargo extra no ofrece la casilla [RF-M1-10]', async () => {
    const deps = await montar({ conProductos: false });
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), {
      target: { value: 'Reparación de ventana' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Tipo'), { target: { value: 'SERVICE' } });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '500' },
    });
    fireEvent.click(within(dialogo).getByLabelText(/Precio abierto/));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    await screen.findByText('Producto agregado al catálogo.');
    const lista = await deps.products.list();
    expect(lista.ok && lista.value[0]?.isOpenPrice).toBe(true);

    fireEvent.click(await botonAgregar());
    const otro = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(otro).getByLabelText('Tipo'), { target: { value: 'EXTRA' } });
    await waitFor(() => {
      expect(within(otro).queryByLabelText(/Precio abierto/)).toBeNull();
    });
  });

  it('la descripción se captura en el formulario y se guarda con el producto [RF-M1-13]', async () => {
    const deps = await montar({ conProductos: false });
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), {
      target: { value: 'Cristal templado 10 mm' },
    });
    fireEvent.change(within(dialogo).getByLabelText(/Descripción/), {
      target: { value: 'Para puertas y barandales' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '900' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    await screen.findByText('Producto agregado al catálogo.');
    const lista = await deps.products.list();
    expect(lista.ok && lista.value[0]?.description).toBe('Para puertas y barandales');
  });

  it('los ajustes del cobro se capturan, se guardan y se ven al editar [RF-M1-14]', async () => {
    const deps = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Vidrio claro 6 mm' }));
    let dialogo = await screen.findByRole('dialog', { name: 'Editar producto' });
    const grupo = within(dialogo).getByRole('group', { name: 'Ajustes del cobro (opcionales)' });
    // Por omisión, todo apagado.
    expect(within(grupo).getByLabelText<HTMLInputElement>('Ancho máximo (mm)').value).toBe('');
    fireEvent.change(within(grupo).getByLabelText('Área mínima por pieza (m²)'), {
      target: { value: '0.5' },
    });
    fireEvent.change(within(grupo).getByLabelText('Ancho máximo (mm)'), {
      target: { value: '1800' },
    });
    fireEvent.change(within(grupo).getByLabelText('Alto máximo (mm)'), {
      target: { value: '2600' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value.find((p) => p.code === 'VC-6')?.ruleParams).toEqual({
      minAreaMm2: 500_000,
      maxWidthMm: 1800,
      maxHeightMm: 2600,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Vidrio claro 6 mm' }));
    dialogo = await screen.findByRole('dialog', { name: 'Editar producto' });
    expect(
      within(dialogo).getByLabelText<HTMLInputElement>('Área mínima por pieza (m²)').value,
    ).toBe('0.5');
  });

  it('un ajuste mal escrito dice qué hacer y no guarda; una pieza no tiene ajustes [RF-M1-14]', async () => {
    const deps = await montar({ conProductos: false });
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Espejo' } });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '300' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Ancho máximo (mm)'), {
      target: { value: '1.80' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await within(dialogo).findByText('La medida máxima no es válida.')).toBeTruthy();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toHaveLength(0);
    fireEvent.change(within(dialogo).getByLabelText('Se cobra por'), {
      target: { value: 'PIECE' },
    });
    expect(within(dialogo).queryByRole('group', { name: /Ajustes del cobro/ })).toBeNull();
  });

  it('con base en el largo, el metro lineal pide el largo máximo', async () => {
    await montar({ conProductos: false });
    fireEvent.click(await botonAgregar());
    const dialogo = await screen.findByRole('dialog', { name: 'Agregar producto' });
    fireEvent.change(within(dialogo).getByLabelText('Se cobra por'), {
      target: { value: 'LINEAR_METER' },
    });
    expect(await within(dialogo).findByLabelText('Largo máximo (mm)')).toBeTruthy();
    expect(within(dialogo).queryByLabelText('Área mínima por pieza (m²)')).toBeNull();
  });

  it('unidad de venta y clave SAT propias se guardan; vacías se usan las de la categoría [RF-M1-11]', async () => {
    const deps = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Marco de madera' }));
    let dialogo = await screen.findByRole('dialog', { name: 'Editar producto' });
    // La clave de la categoría no se muestra como propia: se avisa que la hereda.
    expect(within(dialogo).getByLabelText<HTMLInputElement>('Clave SAT (opcional)').value).toBe('');
    expect(within(dialogo).getByText('Vacía: usa la de la categoría (01010101).')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Unidad de venta (opcional)'), {
      target: { value: 'par' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Clave SAT (opcional)'), {
      target: { value: '30171500' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Clave de unidad SAT (opcional)'), {
      target: { value: 'pr' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy();
    const lista = await deps.products.list();
    const marco = lista.ok ? lista.value.find((p) => p.code === 'MA-1') : undefined;
    expect(marco?.saleUnitName).toBe('par');
    expect(marco?.fiscal).toMatchObject({ productServiceKey: '30171500', unitKey: 'PR' });
    // Al volver a abrirlo, la clave propia sí se ve; si se borra, vuelve a la de la categoría.
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Marco de madera' }));
    dialogo = await screen.findByRole('dialog', { name: 'Editar producto' });
    const clave = within(dialogo).getByLabelText<HTMLInputElement>('Clave SAT (opcional)');
    expect(clave.value).toBe('30171500');
    fireEvent.change(clave, { target: { value: '' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    await screen.findByText('Cambios guardados.');
    const otra = await deps.products.list();
    expect(otra.ok && otra.value.find((p) => p.code === 'MA-1')?.fiscal.productServiceKey).toBe(
      '01010101',
    );
  });

  it('la unidad de venta solo se ofrece por pieza o servicio, y una clave SAT mal escrita no guarda', async () => {
    await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Vidrio claro 6 mm' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar producto' });
    expect(within(dialogo).queryByLabelText('Unidad de venta (opcional)')).toBeNull();
    fireEvent.change(within(dialogo).getByLabelText('Clave SAT (opcional)'), {
      target: { value: '3017' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await within(dialogo).findByText('La clave SAT no es válida.')).toBeTruthy();
  });

  it('precios en bloque: sube 8 % una categoría con vista previa, redondeado al peso hacia arriba [RF-M1-15]', async () => {
    const deps = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Precios en bloque' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Precios en bloque' });
    fireEvent.change(within(dialogo).getByLabelText('Categoría'), {
      target: { value: (await categoria(deps, 'espejo')).id },
    });
    fireEvent.change(within(dialogo).getByLabelText('Porcentaje'), { target: { value: '8' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ver los cambios' }));
    const tabla = await within(dialogo).findByRole('table', {
      name: 'Subir o bajar por porcentaje',
    });
    // $410.00 × 1.08 = $442.80 → $443.00; $116.00 × 1.08 = $125.28 → $126.00.
    expect(
      within(tabla).getByRole('row', { name: /Espejo 4 mm \$410\.00 \$443\.00/ }),
    ).toBeTruthy();
    expect(
      within(tabla).getByRole('row', { name: /Marco de madera \$116\.00 \$126\.00/ }),
    ).toBeTruthy();
    // Nada se guarda hasta aplicar.
    let lista = await deps.products.list();
    expect(lista.ok && lista.value.find((p) => p.code === 'ES-4')?.listPrice).toBe(41_000);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar a 2 productos' }));
    expect(await within(dialogo).findByText('Listo: se cambiaron 2 productos.')).toBeTruthy();
    lista = await deps.products.list();
    expect(lista.ok && lista.value.map((p) => [p.code, p.listPrice])).toEqual([
      ['VC-6', 28_000],
      ['ES-4', 44_300],
      ['MA-1', 12_600],
    ]);
  });

  it('precios en bloque: un porcentaje que no vale dice qué hacer', async () => {
    await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Precios en bloque' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Precios en bloque' });
    fireEvent.change(within(dialogo).getByLabelText('Porcentaje'), { target: { value: '0' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ver los cambios' }));
    expect(await within(dialogo).findByText('El porcentaje no es válido.')).toBeTruthy();
  });

  it('precios en bloque: el archivo actualiza por código y muestra cada cambio antes de aplicarlo', async () => {
    const deps = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Precios en bloque' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Precios en bloque' });
    const archivo = new File(['codigo,nombre,precio\nVC-6,,300\nMA-1,Marco de pino,\n'], 'c.csv', {
      type: 'text/csv',
    });
    fireEvent.change(within(dialogo).getByLabelText('Archivo con los cambios (CSV)'), {
      target: { files: [archivo] },
    });
    const tabla = await within(dialogo).findByRole('table', {
      name: 'Actualizar desde un archivo',
    });
    expect(within(tabla).getByText(/Precio: \$280\.00 → \$300\.00/)).toBeTruthy();
    expect(within(tabla).getByText('Nombre: Marco de madera → Marco de pino')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar 2 cambios' }));
    expect(await within(dialogo).findByText('Listo: se cambiaron 2 productos.')).toBeTruthy();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value.map((p) => [p.name, p.listPrice])).toEqual([
      ['Vidrio claro 6 mm', 30_000],
      ['Espejo 4 mm', 41_000],
      ['Marco de pino', 11_600],
    ]);
  });

  it('precios en bloque: un archivo con un código que no existe no cambia nada', async () => {
    const deps = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Precios en bloque' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Precios en bloque' });
    const archivo = new File(['codigo,precio\nVC-6,300\nNO-EXISTE,1\n'], 'c.csv', {
      type: 'text/csv',
    });
    fireEvent.change(within(dialogo).getByLabelText('Archivo con los cambios (CSV)'), {
      target: { files: [archivo] },
    });
    expect(await within(dialogo).findByText(/Ningún producto tiene ese código/)).toBeTruthy();
    expect(within(dialogo).queryByRole('button', { name: /Aplicar/ })).toBeNull();
    const lista = await deps.products.list();
    expect(lista.ok && lista.value.find((p) => p.code === 'VC-6')?.listPrice).toBe(28_000);
  });

  it('un cajero no ve precios en bloque', async () => {
    await montar({ rol: 'STAFF' });
    await screen.findByRole('heading', { name: /Catálogo/ });
    expect(screen.queryByRole('button', { name: 'Precios en bloque' })).toBeNull();
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

  it('duplicar abre el formulario con todo copiado menos el código y crea un producto nuevo [RF-M1-16]', async () => {
    const deps = await montar();
    const antes = await deps.products.list();
    const original = antes.ok ? antes.value.find((p) => p.code === 'VC-6') : undefined;
    if (original === undefined) throw new Error('sin vidrio de prueba');
    fireEvent.click(await screen.findByRole('button', { name: `Duplicar ${original.name}` }));
    const dialogo = await screen.findByRole('dialog', { name: 'Duplicar producto' });
    const nombre = within(dialogo).getByLabelText<HTMLInputElement>('Nombre');
    expect(nombre.value).toBe(`${original.name} (copia)`);
    expect(within(dialogo).getByLabelText<HTMLInputElement>('Código (opcional)').value).toBe('');
    fireEvent.change(nombre, { target: { value: 'Vidrio claro 9 mm' } });
    fireEvent.change(within(dialogo).getByLabelText('Precio de lista con IVA'), {
      target: { value: '420' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar producto' }));
    expect(await screen.findByText('Producto agregado al catálogo.')).toBeTruthy();
    const despues = await deps.products.list();
    const nuevo = despues.ok
      ? despues.value.find((p) => p.name === 'Vidrio claro 9 mm')
      : undefined;
    expect(nuevo?.id).not.toBe(original.id);
    expect(nuevo).toMatchObject({
      categoryId: original.categoryId,
      kind: original.kind,
      chargeUnit: original.chargeUnit,
      ruleParams: original.ruleParams,
      fiscal: original.fiscal,
      code: null,
      listPrice: 42_000,
    });
    // El original no cambia.
    expect(despues.ok && despues.value.find((p) => p.id === original.id)).toEqual(original);
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

  it('el administrador agrega, renombra y desactiva categorías; con productos activos no la desactiva [RF-M1-08]', async () => {
    await montar();
    await screen.findByRole('form', { name: 'Agregar categoría' });
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), {
      target: { value: 'Vitrales' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));
    expect(await screen.findByText('Categoría agregada.')).toBeTruthy();
    const tabla = screen.getByRole('table', { name: 'Categorías' });
    expect(within(tabla).getByText('Vitrales')).toBeTruthy();
    // Repetida, sin acentos ni mayúsculas.
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), {
      target: { value: 'ESPEJO' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));
    expect(await screen.findByText('Ya hay una categoría con ese nombre.')).toBeTruthy();
    // Espejo tiene productos activos: no se desactiva.
    fireEvent.click(within(tabla).getByRole('button', { name: 'Desactivar Espejo' }));
    expect(await screen.findByText('La categoría tiene productos activos.')).toBeTruthy();
    // Renombrar.
    fireEvent.click(within(tabla).getByRole('button', { name: 'Renombrar Vitrales' }));
    fireEvent.change(screen.getByLabelText('Nuevo nombre para Vitrales'), {
      target: { value: 'Vitrales y emplomados' },
    });
    fireEvent.click(within(tabla).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Nombre guardado.')).toBeTruthy();
    // Sin productos, sí se desactiva, y ya no se ofrece al dar de alta un producto.
    fireEvent.click(
      await within(tabla).findByRole('button', { name: 'Desactivar Vitrales y emplomados' }),
    );
    expect(await screen.findByText(/Categoría desactivada/)).toBeTruthy();
  });

  it('un cajero no ve la administración de categorías', async () => {
    await montar({ rol: 'STAFF' });
    await screen.findAllByText(/Catálogo/);
    expect(screen.queryByRole('form', { name: 'Agregar categoría' })).toBeNull();
  });
});
