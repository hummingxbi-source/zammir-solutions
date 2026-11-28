import { documentoDePrueba } from '@zammir/core/testing';
import type { QuoteDocument, ReceiptExtras } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { documentoAHtml } from './documento-html';

const OPCIONES = { copia: false, rotuloDeCopia: 'COPIA' };

const extras = (cambios: Partial<ReceiptExtras> = {}): ReceiptExtras => ({
  labels: {
    payments: 'Pagos',
    depositRequired: 'Anticipo exigido',
    paid: 'Pagado',
    balance: 'Saldo',
    settled: 'Liquidado',
    warranty: 'Garantía',
    selfInvoicing: 'Pida su factura',
    verificationCode: 'Código de verificación',
  },
  status: 'Pagada',
  depositRequired: null,
  attendedBy: 'Atendió: Beto',
  paid: '$520.00',
  balance: 'Liquidado',
  isSettled: true,
  paymentLines: ['Venta · Efectivo · $520.00 · 31 oct 2026 · Cambio $80.00'],
  warrantyLines: [],
  qr: null,
  ...cambios,
});

function conRecibo(cambios: Partial<ReceiptExtras> = {}): QuoteDocument {
  return documentoDePrueba(2, { receipt: extras(cambios) });
}

describe('página de impresión del documento', () => {
  it('es una hoja carta con título, folio, cliente, conceptos y totales tal como los trae el documento', () => {
    const html = documentoAHtml(documentoDePrueba(2), OPCIONES);
    expect(html).toContain('size: letter');
    expect(html).toContain('<title>Cotización COT-2026-0012</title>');
    expect(html).toContain('Vidriería de prueba');
    expect(html).toContain('COT-2026-0012');
    expect(html).toContain('Ana López Núñez');
    expect(html).toContain('55 1234 5678');
    expect(html).toContain('Av. Hidalgo 45, Otumba');
    expect(html).toContain('Vidrio templado 6 mm número 1');
    expect(html).toContain('Vidrio templado 6 mm número 2');
    expect(html).toContain('$463.45');
    expect(html).toContain('$74.15');
    expect(html).toContain('$537.60');
    expect(html).toContain('1. Se requiere el 50% de anticipo');
    expect(html).toContain('Aviso de privacidad (versión de prueba)');
  });

  it('el texto del cliente nunca se interpreta como código', () => {
    const html = documentoAHtml(
      documentoDePrueba(1, {
        customer: { name: '<script>alert(1)</script> & "Ana"', phone: '5512345678' },
      }),
      OPCIONES,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Ana&quot;');
  });

  it('la descripción del producto sale bajo su nombre, escapada [PP-39]', () => {
    const base = documentoDePrueba(1);
    const [primera] = base.lines;
    if (primera === undefined) throw new Error('renglón');
    const html = documentoAHtml(
      { ...base, lines: [{ ...primera, description: 'Incluye rieles & jaladera' }] },
      OPCIONES,
    );
    expect(html).toContain('<small class="descripcion">Incluye rieles &amp; jaladera</small>');
    expect(documentoAHtml(base, OPCIONES)).not.toContain('class="descripcion"');
  });

  it('la reimpresión sale marcada y la primera impresión no', () => {
    expect(documentoAHtml(documentoDePrueba(1), OPCIONES)).not.toContain('class="marca"');
    const copia = documentoAHtml(documentoDePrueba(1), { copia: true, rotuloDeCopia: 'COPIA' });
    expect(copia).toContain('<span class="marca">COPIA</span>');
  });

  it('lleva el logo como imagen incrustada, y sin logo no deja una imagen rota', () => {
    const con = documentoAHtml(
      documentoDePrueba(1, {
        business: {
          name: 'ZAMMIR',
          phone: null,
          address: null,
          logo: { bytes: new Uint8Array([137, 80, 78, 71]), format: 'png' },
        },
      }),
      OPCIONES,
    );
    expect(con).toContain('src="data:image/png;base64,iVBORw==');
    expect(documentoAHtml(documentoDePrueba(1), OPCIONES)).not.toContain('<img');
  });

  it('un comprobante de venta trae pagos con cambio, quién atendió y el saldo liquidado, sin anticipo', () => {
    const html = documentoAHtml(conRecibo(), OPCIONES);
    expect(html).toContain('Pagos (Pagada)');
    expect(html).toContain('Venta · Efectivo · $520.00 · 31 oct 2026 · Cambio $80.00');
    expect(html).toContain('Atendió: Beto');
    expect(html).toContain('Liquidado');
    expect(html).not.toContain('Anticipo exigido');
  });

  it('un comprobante de trabajo muestra el anticipo exigido y la garantía', () => {
    const html = documentoAHtml(
      conRecibo({ depositRequired: '$268.80', warrantyLines: ['Inicia el 5 nov 2026'] }),
      OPCIONES,
    );
    expect(html).toContain('Anticipo exigido');
    expect(html).toContain('$268.80');
    expect(html).toContain('Garantía');
    expect(html).toContain('Inicia el 5 nov 2026');
  });

  it('con la facturación en pausa no hay QR, código ni leyenda [ADR-0039]', () => {
    const html = documentoAHtml(conRecibo({ qr: null }), OPCIONES);
    expect(html).not.toContain('<svg');
    expect(html).not.toMatch(/factura/i);
    expect(html).not.toContain('Código de verificación');
  });

  it('con la facturación encendida dibuja el QR con su código y su leyenda', () => {
    const html = documentoAHtml(
      conRecibo({
        qr: {
          matrix: [
            [true, false],
            [false, true],
          ],
          url: 'https://zammir.example/f/V-1/ABCD',
          code: 'ABCD2345',
          legend: ['Pida su factura antes de fin de mes.'],
        },
      }),
      OPCIONES,
    );
    expect(html).toContain('<svg class="qr"');
    expect(html).toContain('M4 4h1v1h-1zM5 5h1v1h-1z');
    expect(html).toContain('Código de verificación: ABCD2345');
    expect(html).toContain('Pida su factura antes de fin de mes.');
  });

  it('sin teléfono del cliente no escribe el rótulo de teléfono', () => {
    const html = documentoAHtml(
      documentoDePrueba(1, { customer: { name: 'Cliente de mostrador', phone: '' } }),
      OPCIONES,
    );
    expect(html).toContain('Cliente de mostrador');
    expect(html).not.toContain('Teléfono:');
  });
});
