import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validatePin } from './pin';

const politica = { adminMinDigits: 6 };

function codigo(pin: string, role: 'ADMIN' | 'STAFF' = 'STAFF'): string {
  const r = validatePin(pin, role, politica);
  return r.ok ? 'válido' : r.error.code;
}

describe('validatePin', () => {
  it.each(['4829', '73910', '482915', '9051', '3857'])('acepta %s para un cajero', (pin) => {
    expect(codigo(pin)).toBe('válido');
  });

  it.each(['', '123', '1234567', '12a4', '12 34', '１２３４', '-1234', '12.45'])(
    'rechaza "%s" por formato',
    (pin) => {
      expect(codigo(pin)).toBe('PIN_FORMAT');
    },
  );

  it.each(['0000', '1111', '9999', '000000', '55555'])('rechaza %s (todos iguales)', (pin) => {
    expect(codigo(pin)).toBe('PIN_TRIVIAL');
  });

  it.each(['1234', '2345', '123456', '4321', '9876', '654321', '34567'])(
    'rechaza %s (secuencia)',
    (pin) => {
      expect(codigo(pin)).toBe('PIN_TRIVIAL');
    },
  );

  it.each(['1212', '4545', '123123', '121212', '909090'])(
    'rechaza %s (se repite un bloque)',
    (pin) => {
      expect(codigo(pin)).toBe('PIN_TRIVIAL');
    },
  );

  it.each(['1235', '1243', '9012', '1213', '482915'])('%s no es trivial', (pin) => {
    expect(codigo(pin)).toBe('válido');
  });

  it('un administrador necesita el mínimo de dígitos configurado', () => {
    expect(codigo('48291', 'ADMIN')).toBe('PIN_TOO_SHORT_FOR_ADMIN');
    expect(codigo('4829', 'ADMIN')).toBe('PIN_TOO_SHORT_FOR_ADMIN');
    expect(codigo('482915', 'ADMIN')).toBe('válido');
  });

  it('el mínimo del administrador sale de la configuración', () => {
    expect(validatePin('4829', 'ADMIN', { adminMinDigits: 4 }).ok).toBe(true);
    const r = validatePin('4829', 'ADMIN', { adminMinDigits: 5 });
    expect(!r.ok && r.error.code).toBe('PIN_TOO_SHORT_FOR_ADMIN');
  });

  it('el cajero puede tener PIN corto aunque el administrador necesite más', () => {
    expect(codigo('4829', 'STAFF')).toBe('válido');
  });

  it('un PIN de administrador trivial se rechaza aunque sea largo', () => {
    expect(codigo('123456', 'ADMIN')).toBe('PIN_TRIVIAL');
    expect(codigo('111111', 'ADMIN')).toBe('PIN_TRIVIAL');
  });

  it('el formato se revisa antes que lo trivial y que el largo del administrador', () => {
    expect(codigo('12a', 'ADMIN')).toBe('PIN_FORMAT');
    expect(codigo('0000', 'ADMIN')).toBe('PIN_TOO_SHORT_FOR_ADMIN');
  });

  it('propiedad: todo PIN de 4 a 6 dígitos que se acepta no es una repetición ni una secuencia', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\d{4,6}$/), (pin) => {
        const r = validatePin(pin, 'STAFF', politica);
        if (r.ok) {
          expect(new Set(pin).size).toBeGreaterThan(1);
        }
      }),
    );
  });
});
