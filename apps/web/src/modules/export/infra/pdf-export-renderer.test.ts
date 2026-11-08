import type { ExportReport } from '@zammir/core';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { renderExportPdf } from './pdf-export-renderer';

const informe = (
  filas: number,
  extra: Partial<ExportReport['sections'][number]> = {},
): ExportReport => ({
  title: 'Datos de ZAMMIR',
  subtitle: 'Generado el 08/11/2026 12:00 (hora de la Ciudad de México)',
  sections: [
    {
      title: 'Clientes',
      columns: ['Nombre', 'Teléfono', 'Correo'],
      rows: Array.from({ length: filas }, (_, i) => [
        `Cliente ${String(i)}`,
        '5512345678',
        'a@b.invalid',
      ]),
      totalRows: filas,
      omittedRows: 0,
      ...extra,
    },
    { title: 'Garantías', columns: ['Desde'], rows: [], totalRows: 0, omittedRows: 0 },
  ],
});

describe('PDF de la exportación', () => {
  it('es un PDF válido con el título y el asunto', async () => {
    const bytes = await renderExportPdf(informe(3));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe('Datos de ZAMMIR');
    expect(pdf.getPageCount()).toBe(1);
  });

  it('una tabla larga se reparte en varias páginas', async () => {
    const pdf = await PDFDocument.load(await renderExportPdf(informe(400)));
    expect(pdf.getPageCount()).toBeGreaterThan(3);
  });

  it('con renglones fuera del PDF lo dice y sigue siendo válido', async () => {
    const bytes = await renderExportPdf(informe(5, { totalRows: 1005, omittedRows: 1000 }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('un carácter que la letra estándar no dibuja (un emoji, un idioma raro) no tira el documento', async () => {
    const raro = informe(1, {
      rows: [['Peña 😀 日本語', '5512345678', 'ñandú@b.invalid']],
    });
    const bytes = await renderExportPdf(raro);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('un texto larguísimo se recorta en vez de salirse de la página', async () => {
    const largo = informe(1, { rows: [['x'.repeat(5_000), 'y', 'z']] });
    expect((await PDFDocument.load(await renderExportPdf(largo))).getPageCount()).toBe(1);
  });

  it('un informe sin ninguna sección también se genera', async () => {
    const bytes = await renderExportPdf({ title: 'Vacío', subtitle: 's', sections: [] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
