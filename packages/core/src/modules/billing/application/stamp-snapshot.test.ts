import { describe, expect, it } from 'vitest';

import { SOLICITUD_DE_PRUEBA } from '../contracts/billing-provider.contract';
import { parseStampSnapshot } from './stamp-snapshot';

/** Lo que guarda la base: la solicitud pasada por JSON. */
const guardado = JSON.parse(JSON.stringify(SOLICITUD_DE_PRUEBA)) as Record<string, unknown>;

describe('lo que se mandó al PAC, leído de la base', () => {
  it('vuelve a ser la misma solicitud, con su fecha como fecha', () => {
    expect(parseStampSnapshot(guardado)).toEqual(SOLICITUD_DE_PRUEBA);
  });

  it('acepta una factura relacionada y la conserva', () => {
    const r = parseStampSnapshot({ ...guardado, relatedUuid: 'uuid-anterior' });
    expect(r?.relatedUuid).toBe('uuid-anterior');
    expect(
      parseStampSnapshot(guardado) !== null &&
        'relatedUuid' in (parseStampSnapshot(guardado) ?? {}),
    ).toBe(false);
  });

  it.each([
    ['nada', null],
    ['un texto', 'hola'],
    ['sin conceptos en lista', { ...guardado, concepts: 'x' }],
    ['con una forma de pago que no es 01 ni 03', { ...guardado, paymentForm: '99' }],
    ['con un método que no es PUE', { ...guardado, paymentMethod: 'PPD' }],
    ['con una fecha inválida', { ...guardado, issuedAt: 'no-es-fecha' }],
    ['sin receptor', { ...guardado, recipient: undefined }],
    [
      'con un objeto de impuesto raro',
      { ...guardado, concepts: [{ ...(SOLICITUD_DE_PRUEBA.concepts[0] ?? {}), taxObject: '09' }] },
    ],
  ])('si viene %s, no se reconstruye', (_nombre, valor) => {
    expect(parseStampSnapshot(valor)).toBeNull();
  });
});
