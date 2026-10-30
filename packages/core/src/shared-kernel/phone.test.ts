import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['5512345678', '5512345678'],
    ['55 1234 5678', '5512345678'],
    ['55-1234-5678', '5512345678'],
    ['(55) 1234-5678', '5512345678'],
    ['55.1234.5678', '5512345678'],
    ['  55 1234 5678  ', '5512345678'],
    ['+52 55 1234 5678', '5512345678'],
    ['+525512345678', '5512345678'],
    ['52 55 1234 5678', '5512345678'],
    ['+52 (55) 1234-5678', '5512345678'],
  ])('%j → %s', (entrada, esperado) => {
    expect(normalizePhone(entrada)).toEqual({ ok: true, value: esperado });
  });

  it.each([
    '',
    '   ',
    '55123456',
    '55123456789',
    '551234567a',
    'abcdefghij',
    '+1 555 123 4567',
    '+52 55 1234 567',
    '++52 55 1234 5678',
    '5512345678 ext 12',
  ])('rechaza %j', (entrada) => {
    expect(normalizePhone(entrada)).toEqual({
      ok: false,
      error: { code: 'PHONE_MUST_HAVE_10_DIGITS' },
    });
  });

  it('un número de 10 dígitos que empieza con 52 no se confunde con la clave de país', () => {
    expect(normalizePhone('5212345678')).toEqual({ ok: true, value: '5212345678' });
  });

  it('propiedad: cualquier número de 10 dígitos escrito con separadores da los mismos 10 dígitos', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{10}$/),
        fc.constantFrom('', ' ', '-', '.'),
        fc.constantFrom('', '+52', '52 ', '+52 '),
        (digitos, separador, pais) => {
          const escrito = `${pais}${digitos.slice(0, 2)}${separador}${digitos.slice(2, 6)}${separador}${digitos.slice(6)}`;
          expect(normalizePhone(escrito)).toEqual({ ok: true, value: digitos });
        },
      ),
    );
  });
});
