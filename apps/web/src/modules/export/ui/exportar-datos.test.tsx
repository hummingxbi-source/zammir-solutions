import axe from 'axe-core';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DataExportSource, ExportDataset } from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import type { ArchivoParaGuardar } from '../../../shared/ui/guardar-archivo';
import { ExportarDatos } from './ExportarDatos';

vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });

const DATOS: ExportDataset = {
  generatedAt: '2026-11-09T05:30:00.000Z',
  tables: {
    customers: [
      { id: 'c1', name: 'Ana López', phone: '5512345678' },
      { id: 'c2', name: 'Beto', phone: '5598765432' },
    ],
    counter_sales: [{ id: 'v1', total_cents: 11_600 }],
  },
};

const PDF = new TextEncoder().encode('%PDF-prueba');

function montar(
  fuente: Awaited<ReturnType<DataExportSource['load']>>,
  extra: { renderPdf?: () => Promise<Uint8Array> } = {},
) {
  const archivos: ArchivoParaGuardar[] = [];
  const source: DataExportSource = { load: () => Promise.resolve(fuente) };
  const resultado = render(
    <ExportarDatos
      source={source}
      renderPdf={extra.renderPdf ?? (() => Promise.resolve(PDF))}
      guardarArchivo={(a) => {
        archivos.push(a);
      }}
      ahora={() => new Date('2026-11-09T05:30:00.000Z')}
    />,
  );
  return { ...resultado, archivos };
}

/** Lee los nombres de un ZIP sin comprimir (el que arma la aplicación). */
function nombresDelZip(zip: Uint8Array): string[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fin = zip.length - 22;
  const cuantos = v.getUint16(fin + 10, true);
  let posicion = v.getUint32(fin + 16, true);
  const nombres: string[] = [];
  for (let i = 0; i < cuantos; i += 1) {
    const largo = v.getUint16(posicion + 28, true);
    nombres.push(new TextDecoder().decode(zip.slice(posicion + 46, posicion + 46 + largo)));
    posicion += 46 + largo;
  }
  return nombres;
}

async function prepararDatos(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Preparar la exportación' }));
  await screen.findByRole('status');
}

describe('Exportar los datos', () => {
  it('explica qué se exporta, que son datos personales y que no van los PIN', () => {
    montar({ kind: 'OK', dataset: DATOS });
    expect(screen.getByRole('heading', { name: 'Exportar los datos' })).toBeTruthy();
    expect(screen.getByText(/información personal de tus clientes/)).toBeTruthy();
    expect(screen.getByText(/No incluyen los PIN/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Descargar/ })).toBeNull();
  });

  it('al preparar dice cuántos renglones y tablas hay y ofrece las cuatro descargas', async () => {
    montar({ kind: 'OK', dataset: DATOS });
    await prepararDatos();
    expect(screen.getByRole('status').textContent).toContain('Listo: 3 renglones de 2 tablas.');
    expect(screen.getByRole('status').textContent).toContain('Generado el 08/11/2026 23:30');
    for (const nombre of [
      'Descargar todo (ZIP)',
      'Descargar JSON',
      'Descargar CSV (ZIP)',
      'Descargar PDF',
    ]) {
      expect(screen.getByRole('button', { name: nombre })).toBeTruthy();
    }
    expect(screen.getByText('Clientes: 2')).toBeTruthy();
    expect(screen.getByText('Ventas de mostrador: 1')).toBeTruthy();
    expect(screen.getByText('Productos: 0')).toBeTruthy();
  });

  it('el JSON se descarga con el día de México en el nombre y trae todos los datos', async () => {
    const { archivos } = montar({ kind: 'OK', dataset: DATOS });
    await prepararDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar JSON' }));
    expect(archivos[0]?.name).toBe('zammir-datos-2026-11-08.json');
    expect(archivos[0]?.mimeType).toBe('application/json');
    const j = JSON.parse(new TextDecoder().decode(archivos[0]?.bytes)) as { tables: unknown };
    expect(j.tables).toEqual(DATOS.tables);
    expect(await screen.findByText('Se descargó zammir-datos-2026-11-08.json.')).toBeTruthy();
  });

  it('el PDF se descarga tal como lo dibujó el renderizador', async () => {
    const { archivos } = montar({ kind: 'OK', dataset: DATOS });
    await prepararDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(archivos[0]).toMatchObject({
      name: 'zammir-datos-2026-11-08.pdf',
      mimeType: 'application/pdf',
    });
    expect(archivos[0]?.bytes).toEqual(PDF);
  });

  it('los CSV van en un ZIP con el LÉEME y una tabla por archivo', async () => {
    const { archivos } = montar({ kind: 'OK', dataset: DATOS });
    await prepararDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV (ZIP)' }));
    expect(archivos[0]?.name).toBe('zammir-datos-2026-11-08-csv.zip');
    const nombres = nombresDelZip(archivos[0]?.bytes ?? new Uint8Array());
    expect(nombres[0]).toBe('LEEME.txt');
    expect(nombres).toContain('csv/customers.csv');
    expect(nombres).toContain('csv/counter_sales.csv');
    expect(nombres.some((n) => n.endsWith('.json') || n.endsWith('.pdf'))).toBe(false);
  });

  it('"todo" junta el LÉEME, el JSON, el PDF y los CSV en un ZIP', async () => {
    const { archivos } = montar({ kind: 'OK', dataset: DATOS });
    await prepararDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar todo (ZIP)' }));
    expect(archivos[0]?.name).toBe('zammir-datos-2026-11-08.zip');
    const nombres = nombresDelZip(archivos[0]?.bytes ?? new Uint8Array());
    expect(nombres.slice(0, 3)).toEqual(['LEEME.txt', 'zammir-datos.json', 'zammir-resumen.pdf']);
    expect(nombres).toContain('csv/customers.csv');
  });

  it('si el PDF no se puede armar, avisa y deja descargar lo demás', async () => {
    const { archivos } = montar(
      { kind: 'OK', dataset: DATOS },
      { renderPdf: () => Promise.reject(new Error('sin memoria')) },
    );
    await prepararDatos();
    expect(screen.getByText('Los datos están listos, pero no se pudo armar el PDF.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar todo (ZIP)' }));
    const nombres = nombresDelZip(archivos[0]?.bytes ?? new Uint8Array());
    expect(nombres).not.toContain('zammir-resumen.pdf');
    expect(nombres).toContain('zammir-datos.json');
  });

  it.each([
    [
      'NOT_AUTHORIZED',
      'Solo los administradores pueden exportar los datos.',
      'Entra con tu cuenta de administrador.',
    ],
    ['NO_NETWORK', 'No hay conexión con el servidor.', 'Conéctate a internet e intenta de nuevo.'],
    ['UNAVAILABLE', 'No se pudieron preparar los datos.', 'Intenta de nuevo en unos minutos.'],
  ] as const)(
    'si el servidor responde %s lo dice y dice qué hacer',
    async (kind, mensaje, queHacer) => {
      montar({ kind });
      fireEvent.click(screen.getByRole('button', { name: 'Preparar la exportación' }));
      expect(await screen.findByText(mensaje)).toBeTruthy();
      expect(screen.getByText(new RegExp(queHacer))).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Descargar/ })).toBeNull();
      await waitFor(() => {
        expect(
          screen.getByRole<HTMLButtonElement>('button', { name: 'Preparar la exportación' })
            .disabled,
        ).toBe(false);
      });
    },
  );

  it('mientras prepara no deja pedir otra exportación', async () => {
    let terminar: (v: Awaited<ReturnType<DataExportSource['load']>>) => void = () => undefined;
    const source: DataExportSource = {
      load: () => new Promise((resolve) => (terminar = resolve)),
    };
    render(<ExportarDatos source={source} renderPdf={() => Promise.resolve(PDF)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preparar la exportación' }));
    const boton = await screen.findByRole('button', { name: 'Preparando los datos…' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    terminar({ kind: 'OK', dataset: DATOS });
    await screen.findByRole('status');
  });

  it('no tiene violaciones de accesibilidad, ni antes ni después de preparar', async () => {
    const { container } = montar({ kind: 'OK', dataset: DATOS });
    const revisar = async (): Promise<string[]> =>
      (
        await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
      ).violations.map((v) => `${v.id}: ${v.help}`);
    expect(await revisar()).toEqual([]);
    await prepararDatos();
    expect(await revisar()).toEqual([]);
  });
});
