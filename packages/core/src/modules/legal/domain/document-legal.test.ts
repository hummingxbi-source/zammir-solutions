import { describe, expect, it } from 'vitest';

import {
  buildDocumentLegal,
  legalLink,
  type DocumentLegalLabels,
  type LegalSnapshot,
} from './document-legal';

const etiquetas: DocumentLegalLabels = {
  noNotice: 'Pide el aviso a tu vendedor.',
  notice: (v, desde) => `Aviso v${String(v)} desde ${desde}.`,
  readFull: (enlace) => `Léelo en ${enlace}.`,
  rights: (canal) => `Derechos: ${canal}.`,
  termsTitle: (v) => `Términos v${String(v)}`,
  termsLink: (enlace) => `Completos en ${enlace}`,
};

const AHORA = new Date('2026-11-03T18:00:00.000Z');

const legal: LegalSnapshot = {
  privacy: [
    { version: 1, effectiveFrom: '2026-10-30T00:00:00.000Z', body: 'viejo' },
    { version: 2, effectiveFrom: '2026-11-01T06:00:00.000Z', body: 'nuevo' },
    { version: 3, effectiveFrom: '2026-12-01T06:00:00.000Z', body: 'futuro' },
  ],
  terms: [
    {
      version: 1,
      effectiveFrom: '2026-10-30T00:00:00.000Z',
      body: ' Anticipo del 50 %.\n\n  Garantía de 12 meses.  \n',
    },
  ],
};

function armar(cambios: Partial<Parameters<typeof buildDocumentLegal>[0]> = {}) {
  return buildDocumentLegal({
    legal,
    now: AHORA,
    publicBaseUrl: 'https://zammir.example/',
    rightsContact: 'WhatsApp 5500000000',
    labels: etiquetas,
    ...cambios,
  });
}

describe('enlaces públicos', () => {
  it('une la dirección base y la ruta sin dejar diagonales de más', () => {
    expect(legalLink('https://zammir.example/', 'aviso')).toBe('https://zammir.example/aviso');
    expect(legalLink('https://zammir.example///', 'terminos')).toBe(
      'https://zammir.example/terminos',
    );
    expect(legalLink('  https://zammir.example  ', 'aviso')).toBe('https://zammir.example/aviso');
  });

  it('sin dirección base no hay enlace', () => {
    expect(legalLink(null, 'aviso')).toBeNull();
    expect(legalLink('   ', 'terminos')).toBeNull();
  });
});

describe('pie legal de los documentos', () => {
  it('el aviso lleva la versión vigente con su fecha de México, el enlace y el canal de derechos', () => {
    // La versión 2 rige desde el 1 nov 2026 a las 00:00 de México; la 3 es futura y no cuenta.
    expect(armar().privacyNotice).toBe(
      'Aviso v2 desde 1 nov 2026. Léelo en https://zammir.example/aviso. Derechos: WhatsApp 5500000000.',
    );
  });

  it('la fecha del aviso es la de México, no la de UTC', () => {
    const r = armar({
      legal: {
        privacy: [{ version: 1, effectiveFrom: '2026-11-02T03:00:00.000Z', body: 'x' }],
        terms: [],
      },
    });
    expect(r.privacyNotice).toContain('desde 1 nov 2026');
  });

  it('una versión con vigencia futura todavía no rige', () => {
    const r = armar({ now: new Date('2026-12-02T18:00:00.000Z') });
    expect(r.privacyNotice).toContain('Aviso v3');
  });

  it('sin dirección base no escribe enlace; sin canal de contacto no lo inventa', () => {
    const r = armar({ publicBaseUrl: null, rightsContact: '  ' });
    expect(r.privacyNotice).toBe('Aviso v2 desde 1 nov 2026.');
    expect(r.terms?.lines).toEqual(['Anticipo del 50 %.', 'Garantía de 12 meses.']);
  });

  it('sin aviso publicado dice que lo da el vendedor y conserva el canal de derechos', () => {
    expect(armar({ legal: null }).privacyNotice).toBe(
      'Pide el aviso a tu vendedor. Derechos: WhatsApp 5500000000.',
    );
    expect(armar({ legal: { privacy: [], terms: [] } }).privacyNotice).toContain(
      'Pide el aviso a tu vendedor.',
    );
  });

  it('los términos vigentes salen renglón por renglón, con su versión y el enlace a los completos', () => {
    expect(armar().terms).toEqual({
      title: 'Términos v1',
      lines: [
        'Anticipo del 50 %.',
        'Garantía de 12 meses.',
        'Completos en https://zammir.example/terminos',
      ],
    });
  });

  it('sin términos publicados, o con el texto en blanco, no se muestran', () => {
    expect(armar({ legal: null }).terms).toBeNull();
    expect(armar({ legal: { privacy: legal.privacy, terms: [] } }).terms).toBeNull();
    expect(
      armar({
        legal: {
          privacy: legal.privacy,
          terms: [{ version: 1, effectiveFrom: '2026-10-30T00:00:00.000Z', body: ' \n ' }],
        },
      }).terms,
    ).toBeNull();
  });
});
