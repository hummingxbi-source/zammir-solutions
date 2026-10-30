import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  createPriceRegistry,
  defaultRules,
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  inMemoryCatalog,
  sequentialIdGenerator,
  type ImportCatalogDeps,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';

const instante = new Date('2026-10-30T18:00:00.000Z');
const ENCABEZADO =
  'codigo,nombre,categoria,tipo,unidad,precio,exento,regla,base_metro_lineal,garantia_meses';

function entorno(): ImportCatalogDeps {
  const catalogo = inMemoryCatalog({
    idGenerator: sequentialIdGenerator('c'),
    clock: fixedClock(instante),
    auditLog: inMemoryAuditLog(),
  });
  const reglas = createPriceRegistry(defaultRules);
  if (!reglas.ok) throw new Error('registro');
  return {
    products: catalogo,
    categories: catalogo,
    idGenerator: sequentialIdGenerator('p'),
    priceRules: reglas.value,
  };
}

function mostrar(deps: ImportCatalogDeps, rol: 'ADMIN' | 'STAFF' = 'ADMIN'): void {
  const auth = inMemoryAdminAuth([
    { userId: 'a-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: rol },
  ]);
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={fixedClock(instante)}
      cargarLimiteInactividad={() => Promise.resolve(null)}
    >
      <MemoryRouter initialEntries={['/catalogo']}>
        <App catalogo={deps} />
      </MemoryRouter>
    </ProveedorSesionAdmin>,
  );
}

async function entrar(): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Correo'), {
    target: { value: 'a@ejemplo.invalid' },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: 'clave-de-prueba-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

async function subir(contenido: string): Promise<void> {
  const archivo = new File([contenido], 'catalogo.csv', { type: 'text/csv' });
  fireEvent.change(await screen.findByLabelText('Archivo CSV con tus productos'), {
    target: { files: [archivo] },
  });
}

describe('pantalla de importación del catálogo', () => {
  it('explica que es todo o nada y ofrece la plantilla', async () => {
    mostrar(entorno());
    await entrar();
    expect(await screen.findByText(/no se importa nada: corrige el archivo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar plantilla' })).toBeTruthy();
  });

  it('un archivo válido muestra la vista previa y al confirmar importa todo', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    await subir(
      `${ENCABEZADO}\nA-1,Vidrio claro,Vidrio claro / flotado,a medida,m2,280,no,,,\nA-2,Espejo con ñandú,Espejo,a medida,m2,"1,350.50",no,,,6`,
    );
    expect(await screen.findByText(/2 filas, 0 con errores/)).toBeTruthy();
    expect(screen.getByText('Espejo con ñandú')).toBeTruthy();
    // Todavía no se guardó nada.
    const antes = await deps.products.list();
    expect(antes.ok && antes.value).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 productos' }));
    expect(await screen.findByText(/Catálogo importado: 2 productos/)).toBeTruthy();
    const despues = await deps.products.list();
    expect(despues.ok && despues.value.map((p) => [p.name, p.listPrice])).toEqual([
      ['Vidrio claro', 28_000],
      ['Espejo con ñandú', 135_050],
    ]);
  });

  it('cada error sale con su fila y su columna, y el botón de importar queda apagado', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    await subir(
      `${ENCABEZADO}\nA-1,Bien,Espejo,a medida,m2,100,no,,,\nA-2,,Telas,a medida,m2,-5,no,,,\nA-3,Repetido,Espejo,a medida,m2,100,no,,,\nA-3,Repetido,Espejo,a medida,m2,100,no,,,`,
    );
    expect(await screen.findByText(/4 filas, 2 con errores/)).toBeTruthy();
    const tabla = within(screen.getByRole('table'));
    const fila3 = tabla.getByRole('rowheader', { name: '3' }).closest('tr');
    if (fila3 === null) throw new Error('fila 3');
    expect(within(fila3).getByText('Falta el nombre.')).toBeTruthy();
    expect(within(fila3).getByText(/La categoría no existe/)).toBeTruthy();
    expect(within(fila3).getByText('El precio no puede ser negativo.')).toBeTruthy();
    const fila5 = tabla.getByRole('rowheader', { name: '5' }).closest('tr');
    if (fila5 === null) throw new Error('fila 5');
    expect(within(fila5).getByText('Este código ya aparece antes en el archivo.')).toBeTruthy();

    const boton = screen.getByRole('button', { name: 'Importar 4 productos' });
    expect(boton).toHaveProperty('disabled', true);
    fireEvent.click(boton);
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toEqual([]);
  });

  it('avisa qué columnas obligatorias faltan', async () => {
    mostrar(entorno());
    await entrar();
    await subir('nombre,categoria\nVidrio,Espejo');
    expect(
      await screen.findByText(/Faltan columnas obligatorias: tipo, unidad, precio/),
    ).toBeTruthy();
  });

  it('un archivo sin filas dice que está vacío', async () => {
    mostrar(entorno());
    await entrar();
    await subir(ENCABEZADO);
    expect(await screen.findByText(/solo trae el encabezado/)).toBeTruthy();
  });

  it('avisa si el archivo no está en UTF-8 (caracteres de reemplazo)', async () => {
    mostrar(entorno());
    await entrar();
    await subir(`${ENCABEZADO}\nA-1,Vidrio �,Espejo,a medida,m2,100,no,,,`);
    expect(await screen.findByText(/no estar en UTF-8/)).toBeTruthy();
  });

  it('el catálogo no cambia si se cierra la vista previa sin confirmar', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    await subir(`${ENCABEZADO}\nA-1,Vidrio,Espejo,a medida,m2,100,no,,,`);
    await screen.findByText(/1 filas, 0 con errores/);
    await waitFor(async () => {
      const lista = await deps.products.list();
      expect(lista.ok && lista.value).toEqual([]);
    });
  });

  it('una cuenta que no es de administrador no ve la pantalla', async () => {
    mostrar(entorno(), 'STAFF');
    await entrar();
    expect(await screen.findByText('Esta cuenta no es de administrador.')).toBeTruthy();
    expect(screen.queryByText('Descargar plantilla')).toBeNull();
  });
});
