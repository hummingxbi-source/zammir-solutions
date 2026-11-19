import type { SummarySheet } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { hojaAHtml } from './hoja-html';

const hoja = (cambios: Partial<SummarySheet> = {}): SummarySheet => ({
  business: { name: 'ZAMMIR (datos de prueba)', phone: '5598765432', address: 'Otumba, Edo. Méx.' },
  title: 'Corte de caja',
  subtitle: 'Turno de Beto',
  meta: ['Abrió: 31 oct 2026, 09:00', 'Cerró: 31 oct 2026, 18:30'],
  sections: [
    {
      title: 'Cobros del turno',
      rows: [
        { label: 'Efectivo cobrado', value: '$1,200.00' },
        { label: 'Total cobrado', value: '$1,500.00', strong: true },
      ],
    },
  ],
  note: null,
  pageLabel: 'Página {n} de {total}',
  ...cambios,
});

describe('página de impresión de la hoja de resumen', () => {
  it('es una hoja carta con el título, el turno, el contexto y los renglones tal como vienen', () => {
    const html = hojaAHtml(hoja());
    expect(html).toContain('size: letter');
    expect(html).toContain('<title>Corte de caja</title>');
    expect(html).toContain('Turno de Beto');
    expect(html).toContain('Abrió: 31 oct 2026, 09:00');
    expect(html).toContain('Cobros del turno');
    expect(html).toContain('<span>Efectivo cobrado</span><span>$1,200.00</span>');
    expect(html).toContain(
      'class="renglon fuerte"><span>Total cobrado</span><span>$1,500.00</span>',
    );
  });

  it('el texto nunca se interpreta como código', () => {
    const html = hojaAHtml(hoja({ subtitle: '<b>Beto</b> & "Luis"' }));
    expect(html).not.toContain('<b>Beto</b>');
    expect(html).toContain('&lt;b&gt;Beto&lt;/b&gt; &amp; &quot;Luis&quot;');
  });

  it('lleva el logo si lo hay y la nota si la hay', () => {
    const con = hojaAHtml(
      hoja({
        note: 'No cuentan en el corte.',
        business: {
          name: 'ZAMMIR',
          phone: null,
          address: null,
          logo: { bytes: new Uint8Array([137, 80, 78, 71]), format: 'png' },
        },
      }),
    );
    expect(con).toContain('src="data:image/png;base64,iVBORw==');
    expect(con).toContain('No cuentan en el corte.');
    const sin = hojaAHtml(hoja());
    expect(sin).not.toContain('<img');
    expect(sin).not.toContain('class="aviso"');
  });

  it('no menciona la factura', () => {
    expect(hojaAHtml(hoja())).not.toMatch(/factura/i);
  });
});
