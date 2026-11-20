import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SummarySheet } from '@zammir/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { pdfLibSheetRenderer } from './pdf-lib-sheet-renderer';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });
beforeAll(async () => {
  await import('pdfjs-dist/legacy/build/pdf.mjs');
});

const LOGO = new Uint8Array(
  readFileSync(join(import.meta.dirname, '../../../../public/logo-zammir.png')),
);

async function abrir(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 })
    .promise;
}

async function textoDe(bytes: Uint8Array): Promise<string> {
  const doc = await abrir(bytes);
  const partes: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const contenido = await (await doc.getPage(n)).getTextContent();
    partes.push(contenido.items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  return partes.join(' ').replace(/\s+/g, ' ');
}

const hoja = (cambios: Partial<SummarySheet> = {}): SummarySheet => ({
  business: {
    name: 'ZAMMIR (datos de prueba)',
    phone: '5598765432',
    address: 'Otumba, Edo. Méx.',
    logo: { bytes: LOGO, format: 'png' },
  },
  title: 'Corte de caja',
  subtitle: 'Turno de Beto',
  meta: ['Abrió: 31 oct 2026, 09:00', 'Cerró: 31 oct 2026, 18:30'],
  sections: [
    {
      title: 'Cobros del turno',
      rows: [
        { label: 'Fondo inicial', value: '$500.00' },
        { label: 'Total cobrado', value: '$1,500.00', strong: true },
      ],
    },
    { title: 'Efectivo', rows: [{ label: 'Diferencia', value: 'Sobrante $20.00', strong: true }] },
  ],
  note: 'Los cobros de ventas canceladas no cuentan en el corte.',
  pageLabel: 'Página {n} de {total}',
  ...cambios,
});

async function generar(h: SummarySheet): Promise<Uint8Array> {
  const r = await pdfLibSheetRenderer().render(h);
  if (!r.ok) {
    throw new Error('no se generó el PDF');
  }
  return r.value;
}

describe('PDF de la hoja de resumen', () => {
  it('es una sola hoja carta con el título, el turno, el contexto, los renglones y la nota', async () => {
    const bytes = await generar(hoja());
    const doc = await abrir(bytes);
    expect(doc.numPages).toBe(1);
    const vista = (await doc.getPage(1)).view;
    expect([(vista[2] ?? 0) - (vista[0] ?? 0), (vista[3] ?? 0) - (vista[1] ?? 0)]).toEqual([
      612, 792,
    ]);
    const texto = await textoDe(bytes);
    expect(texto).toContain('ZAMMIR (datos de prueba)');
    expect(texto).toContain('CORTE DE CAJA');
    expect(texto).toContain('Turno de Beto');
    expect(texto).toContain('Abrió: 31 oct 2026, 09:00');
    expect(texto).toContain('Cobros del turno');
    expect(texto).toMatch(/Fondo inicial\s+\$500\.00/);
    expect(texto).toMatch(/Total cobrado\s+\$1,500\.00/);
    expect(texto).toMatch(/Diferencia\s+Sobrante \$20\.00/);
    expect(texto).toContain('Los cobros de ventas canceladas no cuentan en el corte.');
    expect(texto).toContain('Página 1 de 1');
  });

  it('lleva el logo y sin él sale igual', async () => {
    const imagenes = (b: Uint8Array): number =>
      (
        Buffer.from(b)
          .toString('latin1')
          .match(/\/Subtype\s*\/Image/g) ?? []
      ).length;
    expect(imagenes(await generar(hoja()))).toBeGreaterThan(0);
    const sinLogo = hoja({ business: { name: 'ZAMMIR', phone: null, address: null } });
    const bytes = await generar(sinLogo);
    expect(imagenes(bytes)).toBe(0);
    expect(await textoDe(bytes)).toContain('CORTE DE CAJA');
  });

  it('con muchos renglones pasa a una segunda hoja y numera las páginas', async () => {
    const muchos = hoja({
      sections: [
        {
          title: 'Cobros',
          rows: Array.from({ length: 60 }, (_, i) => ({
            label: `Renglón ${String(i + 1)}`,
            value: '$1.00',
          })),
        },
      ],
    });
    const bytes = await generar(muchos);
    const doc = await abrir(bytes);
    expect(doc.numPages).toBeGreaterThan(1);
    expect(await textoDe(bytes)).toContain(`Página 2 de ${String(doc.numPages)}`);
  });

  it('un carácter que la fuente no dibuja no tira el documento', async () => {
    const r = await pdfLibSheetRenderer().render(hoja({ subtitle: 'Turno de 🙂 Beto' }));
    expect(r.ok).toBe(true);
  });
});
