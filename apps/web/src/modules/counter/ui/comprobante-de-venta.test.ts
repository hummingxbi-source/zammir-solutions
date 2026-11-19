import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CounterSale, Payment } from '@zammir/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { pdfLibRenderer } from '../../documents/infra/pdf-lib-renderer';
import { qrMatrix } from '../../documents/infra/qr-matrix';
import { comprobanteDeVenta } from './comprobante-de-venta';

// S4-36 · El comprobante de una venta de mostrador sale en hoja carta, con el logo y el detalle, y su PDF se
// lee por un camino independiente: lo escrito es lo que dice la venta, al centavo [ADR-0040].
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

const linea = (nombre: string, detalle: string, cantidad: number, unitario: number) =>
  ({
    id: nombre,
    name: nombre,
    detail: detalle,
    quantity: cantidad,
    unitPriceCents: unitario,
    lineTotalCents: unitario * cantidad,
  }) as never;

const venta = (cambios: Partial<CounterSale> = {}): CounterSale =>
  ({
    id: 'v1',
    status: 'COMPLETED',
    customerId: null,
    lines: [
      linea('Chapa de baño', 'Pieza', 2, 11_600),
      linea('Vidrio claro 6 mm, corte a medida', '80 cm × 60 cm × 1 = 0.48 m²', 1, 28_000),
    ],
    subtotalCents: 44_828,
    taxCents: 7_172,
    totalCents: 52_000,
    tempFolio: 'T1-0007',
    folio: 'V-2026-0007',
    publicCode: 'ABCDEFGH',
    issuedAt: '2026-10-31T18:05:00.000Z',
    userId: 'u1',
    deviceId: 'd1',
    cashShiftId: null,
    cancelledAt: null,
    cancelReason: null,
    cancelledBy: null,
    syncStatus: 'SENT',
    reviewReason: null,
    updatedAt: '2026-10-31T18:05:00.000Z',
    ...cambios,
  }) as CounterSale;

const pago: Payment = {
  id: 'p1',
  groupId: 'g1',
  targetType: 'COUNTER_SALE',
  targetId: 'v1',
  kind: 'SALE',
  method: 'CASH',
  amountCents: 52_000,
  cashReceivedCents: 60_000,
  changeCents: 8_000,
  reference: null,
  userId: 'u1',
  deviceId: 'd1',
  paidAt: '2026-10-31T18:05:00.000Z',
  cashShiftId: null,
};

function deps(autofacturacion: boolean, conLogo = true) {
  return {
    negocio: {
      name: 'ZAMMIR (datos de prueba)',
      phone: '5598765432',
      address: 'Otumba, Edo. Méx.',
      ...(conLogo ? { logo: { bytes: LOGO, format: 'png' as const } } : {}),
    },
    condiciones: 'Sin cambios ni devoluciones en vidrio a medida.',
    autofacturacion,
    leyendaDeAutofacturacion: 'Pida su factura antes de que termine el mes.',
    direccionBase: null,
    qrMatrix,
  };
}

async function generar(autofacturacion: boolean, conLogo = true) {
  const documento = comprobanteDeVenta(deps(autofacturacion, conLogo), {
    venta: venta(),
    pagos: [pago],
    cliente: null,
    cajero: 'Beto',
  });
  const pdf = await pdfLibRenderer().render(documento);
  if (!pdf.ok) {
    throw new Error('no se generó el PDF');
  }
  return pdf.value;
}

describe('comprobante de venta en hoja carta', () => {
  it('trae el detalle de la compra, los importes al centavo, el pago con su cambio y quién atendió', async () => {
    const bytes = await generar(false);
    const texto = await textoDe(bytes);
    expect(texto).toContain('COMPROBANTE DE VENTA');
    expect(texto).toContain('V-2026-0007');
    expect(texto).toContain('ZAMMIR (datos de prueba)');
    expect(texto).toContain('Cliente de mostrador');
    expect(texto).toContain('Atendió: Beto');
    expect(texto).toContain('Chapa de baño');
    expect(texto).toContain('80 cm × 60 cm × 1 = 0.48 m²');
    expect(texto).toContain('$448.28');
    expect(texto).toContain('$71.72');
    expect(texto).toContain('$520.00');
    expect(texto).toContain('Venta · Efectivo · $520.00 · 31 oct 2026 · Cambio $80.00');
    expect(texto).toMatch(/Pagado\s+\$520\.00/);
    expect(texto).toMatch(/Saldo\s+Liquidado/);
    expect(texto).not.toContain('Anticipo exigido');
    expect(texto).not.toContain('Garantía');
  });

  it('es una sola hoja tamaño carta', async () => {
    const doc = await abrir(await generar(false));
    expect(doc.numPages).toBe(1);
    const vista = (await doc.getPage(1)).view;
    expect([(vista[2] ?? 0) - (vista[0] ?? 0), (vista[3] ?? 0) - (vista[1] ?? 0)]).toEqual([
      612, 792,
    ]);
  });

  it('lleva el logo de ZAMMIR, y sin él sale igual', async () => {
    const con = await generar(false, true);
    const sin = await generar(false, false);
    const imagenes = (b: Uint8Array): number =>
      (
        Buffer.from(b)
          .toString('latin1')
          .match(/\/Subtype\s*\/Image/g) ?? []
      ).length;
    // El PNG con transparencia lleva dos objetos de imagen: la imagen y su máscara.
    expect(imagenes(con)).toBeGreaterThan(0);
    expect(imagenes(sin)).toBe(0);
    expect(await textoDe(sin)).toContain('COMPROBANTE DE VENTA');
  });

  it('con la facturación en pausa no menciona la factura ni lleva QR ni código [ADR-0039]', async () => {
    const texto = await textoDe(await generar(false));
    expect(texto).not.toMatch(/factura/i);
    expect(texto).not.toContain('Código');
    expect(texto).not.toContain('ABCDEFGH');
  });

  it('con la facturación encendida lleva el QR, el código y la leyenda', async () => {
    const texto = await textoDe(await generar(true));
    expect(texto).toContain('Pida su factura');
    expect(texto).toContain('Código de verificación: ABCDEFGH');
  });
});
