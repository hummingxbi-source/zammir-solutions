import { describe, expect, it } from 'vitest';

import type { DocumentRenderer } from '../application/ports';
import type { DocumentLabels, QuoteDocument } from '../domain/quote-document';

export const ROTULOS_DE_PRUEBA: DocumentLabels = {
  title: 'Cotización',
  folio: 'Folio',
  date: 'Fecha',
  validUntil: 'Vigencia',
  customer: 'Cliente',
  phone: 'Teléfono',
  site: 'Obra',
  concept: 'Concepto',
  quantity: 'Cant.',
  unitPrice: 'Precio unit.',
  amount: 'Importe',
  subtotal: 'Subtotal',
  tax: 'IVA',
  total: 'Total',
  conditions: 'Condiciones',
  signature: 'Firma de conformidad',
  publicCode: 'Código',
  page: 'Página {n} de {total}',
  draft: 'BORRADOR',
};

/** Un documento de prueba con `n` líneas. */
export function documentoDePrueba(n = 2, cambios: Partial<QuoteDocument> = {}): QuoteDocument {
  return {
    business: {
      name: 'Vidriería de prueba',
      phone: '5512345678',
      address: 'Calle de prueba 123, Otumba',
    },
    folioLabel: 'COT-2026-0012',
    folio: 'COT-2026-0012',
    tempFolio: 'T1-0004',
    publicCode: 'ABCD2345',
    provisionalNote: null,
    issuedDate: '30 oct 2026',
    validUntilDate: '14 nov 2026',
    customer: { name: 'Ana López Núñez', phone: '5512345678' },
    siteAddress: 'Av. Hidalgo 45, Otumba',
    lines: Array.from({ length: n }, (_v, i) => ({
      position: i + 1,
      name: `Vidrio templado 6 mm número ${String(i + 1)}`,
      detail: '1.20 m × 0.80 m × 2 = 1.92 m² × $280.00 = $537.60',
      quantity: '2',
      unitPrice: '$280.00',
      amount: '$537.60',
    })),
    subtotal: '$463.45',
    tax: '$74.15',
    total: '$537.60',
    conditions: [
      'Se requiere el 50% de anticipo para iniciar fabricación o apartar material.',
      'El saldo se liquida contra entrega o instalación.',
      'El tiempo de entrega está sujeto a disponibilidad de material y a la medición física final en obra.',
    ],
    privacyNotice:
      'Aviso de privacidad (versión de prueba): tus datos se usan solo para esta cotización.',
    isDraft: false,
    labels: ROTULOS_DE_PRUEBA,
    ...cambios,
  };
}

export interface RendererDelContrato {
  readonly renderer: DocumentRenderer;
  /** Texto contenido en el archivo, leído por un camino independiente del renderizador. */
  readonly textOf: (bytes: Uint8Array) => Promise<string>;
  /** Número de páginas del archivo. */
  readonly pagesOf: (bytes: Uint8Array) => Promise<number>;
}

/** Batería de contrato de DocumentRenderer: la pasan el adaptador real (PDF) y el falso. */
export function documentRendererContract(
  nombre: string,
  crear: () => RendererDelContrato | Promise<RendererDelContrato>,
): void {
  describe(`contrato de DocumentRenderer: ${nombre}`, () => {
    async function generar(doc: QuoteDocument) {
      const h = await crear();
      const r = await h.renderer.render(doc);
      if (!r.ok) {
        throw new Error('no se generó el documento');
      }
      const texto = (await h.textOf(r.value)).replace(/\s+/g, ' ');
      return { h, bytes: r.value, texto };
    }

    it('trae los datos del negocio, el folio, la fecha, la vigencia y el cliente', async () => {
      const { texto } = await generar(documentoDePrueba());
      for (const esperado of [
        'Vidriería de prueba',
        'Calle de prueba 123, Otumba',
        'COT-2026-0012',
        '30 oct 2026',
        '14 nov 2026',
        'Ana López Núñez',
        'Av. Hidalgo 45, Otumba',
      ]) {
        expect(texto).toContain(esperado);
      }
    });

    it('cada línea sale con su nombre, su cálculo, cantidad, precio e importe', async () => {
      const { texto } = await generar(documentoDePrueba(3));
      for (let i = 1; i <= 3; i += 1) {
        expect(texto).toContain(`Vidrio templado 6 mm número ${String(i)}`);
      }
      expect(texto).toContain('1.92 m²');
      expect(texto).toContain('$280.00');
      expect(texto).toContain('$537.60');
    });

    it('subtotal, IVA y total salen idénticos al centavo a los del modelo', async () => {
      const { texto } = await generar(documentoDePrueba());
      expect(texto).toContain('$463.45');
      expect(texto).toContain('$74.15');
      expect(texto).toContain('Subtotal');
      expect(texto).toContain('IVA');
      expect(texto).toContain('Total');
    });

    it('trae las condiciones, el espacio de firma y el aviso de privacidad abreviado', async () => {
      const { texto } = await generar(documentoDePrueba());
      expect(texto).toContain('Se requiere el 50% de anticipo');
      expect(texto).toContain('disponibilidad de material');
      expect(texto).toContain('Firma de conformidad');
      expect(texto).toContain('Aviso de privacidad (versión de prueba)');
    });

    it('acentos, ñ y nombres largos no se cortan ni se pierden', async () => {
      const largo = 'Doña Ñoño Muñoz Hernández de la Peña y Castañeda de los Ángeles Güemes';
      const { texto } = await generar(
        documentoDePrueba(1, { customer: { name: largo, phone: '5512345678' } }),
      );
      for (const palabra of largo.split(' ')) {
        expect(texto).toContain(palabra);
      }
    });

    it('un nombre de producto muy largo se parte en renglones y no se pierde', async () => {
      const nombreLargo =
        'Cancel de baño en vidrio templado de 9 mm con herrajes cromados, perfil de aluminio, sellador ' +
        'y jaladera de acero inoxidable instalado en obra';
      const doc = documentoDePrueba(1);
      const [primera] = doc.lines;
      if (primera === undefined) {
        throw new Error('el documento de prueba trae una línea');
      }
      const { texto } = await generar({ ...doc, lines: [{ ...primera, name: nombreLargo }] });
      for (const palabra of nombreLargo.split(' ')) {
        expect(texto).toContain(palabra);
      }
    });

    it('con muchas líneas genera varias páginas y no pierde ninguna', async () => {
      const { h, bytes, texto } = await generar(documentoDePrueba(60));
      expect(await h.pagesOf(bytes)).toBeGreaterThan(1);
      expect(texto).toContain('Vidrio templado 6 mm número 1 ');
      expect(texto).toContain('Vidrio templado 6 mm número 60');
    });

    it('con una sola línea cabe en una página', async () => {
      const { h, bytes } = await generar(documentoDePrueba(1));
      expect(await h.pagesOf(bytes)).toBe(1);
    });

    it('sin enviar muestra el folio provisional y el código público', async () => {
      const { texto } = await generar(
        documentoDePrueba(2, {
          folio: null,
          folioLabel: 'Folio provisional T1-0004',
          provisionalNote: 'Folio provisional',
        }),
      );
      expect(texto).toContain('Folio provisional T1-0004');
      expect(texto).toContain('ABCD2345');
      expect(texto).not.toContain('COT-2026');
    });

    it('un borrador lo dice', async () => {
      const { texto } = await generar(documentoDePrueba(1, { isDraft: true }));
      expect(texto).toContain('BORRADOR');
    });
  });
}
