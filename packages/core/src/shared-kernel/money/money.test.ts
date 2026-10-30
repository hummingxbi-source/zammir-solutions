import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  add,
  compare,
  formatMoney,
  isZero,
  money,
  multiply,
  subtract,
  sum,
  ZERO,
  type Money,
} from './money';

/** Monto de prueba: falla fuerte si los centavos no valen. */
function m(centavos: number): Money {
  const resultado = money(centavos);
  if (!resultado.ok) {
    throw new Error(`centavos no válidos en la prueba: ${String(centavos)}`);
  }
  return resultado.value;
}

function valor(resultado: ReturnType<typeof add>): number {
  if (!resultado.ok) {
    throw new Error(`se esperaba un monto: ${resultado.error.code}`);
  }
  return resultado.value;
}

// Montos que, sumados de dos o tres en dos o tres, nunca salen del rango seguro.
const centavos = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 });

describe('money()', () => {
  it('acepta enteros, incluido cero y los extremos seguros', () => {
    for (const c of [0, 1, -1, 12_345, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
      const r = money(c);
      expect(r.ok && r.value).toBe(c);
    }
  });

  it('convierte -0 en 0', () => {
    const r = money(-0);
    expect(r.ok && Object.is(r.value, 0)).toBe(true);
  });

  it.each([0.5, 1.01, -0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rechaza %s por no ser un entero',
    (c) => {
      const r = money(c);
      expect(!r.ok && r.error.code).toBe('NOT_INTEGER');
    },
  );

  it.each([Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, 1e300])(
    'rechaza %s por salir del rango seguro',
    (c) => {
      const r = money(c);
      expect(!r.ok && r.error.code).toBe('OUT_OF_RANGE');
    },
  );
});

describe('aritmética', () => {
  it('suma, resta y multiplica exacto en centavos (sin errores de flotantes)', () => {
    expect(valor(add(m(10), m(20)))).toBe(30);
    expect(valor(subtract(m(10), m(20)))).toBe(-10);
    expect(valor(multiply(m(1999), 3))).toBe(5997);
    // 0.1 + 0.2 en flotantes no es 0.3; en centavos sí es exacto.
    expect(valor(add(m(10), m(20)))).toBe(30);
  });

  it('multiplicar por cero da cero y por uno no cambia el monto', () => {
    expect(valor(multiply(m(777), 0))).toBe(0);
    expect(valor(multiply(m(777), 1))).toBe(777);
  });

  it('multiplicar rechaza cantidades no enteras o negativas', () => {
    const fraccion = multiply(m(100), 1.5);
    expect(!fraccion.ok && fraccion.error.code).toBe('NOT_INTEGER');
    const negativa = multiply(m(100), -1);
    expect(!negativa.ok && negativa.error.code).toBe('NEGATIVE_QUANTITY');
  });

  it('si el resultado sale del rango seguro lo dice en lugar de dar un monto falso', () => {
    const suma = add(m(Number.MAX_SAFE_INTEGER), m(1));
    expect(!suma.ok && suma.error.code).toBe('OUT_OF_RANGE');
    const resta = subtract(m(Number.MIN_SAFE_INTEGER), m(1));
    expect(!resta.ok && resta.error.code).toBe('OUT_OF_RANGE');
    const producto = multiply(m(Number.MAX_SAFE_INTEGER), 2);
    expect(!producto.ok && producto.error.code).toBe('OUT_OF_RANGE');
  });

  it('el último valor seguro todavía se puede alcanzar', () => {
    expect(valor(add(m(Number.MAX_SAFE_INTEGER - 1), m(1)))).toBe(Number.MAX_SAFE_INTEGER);
    expect(valor(multiply(m(Number.MAX_SAFE_INTEGER), 1))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('un monto nunca sale como -0', () => {
    expect(Object.is(valor(subtract(m(5), m(5))), 0)).toBe(true);
    expect(Object.is(valor(multiply(m(-5), 0)), 0)).toBe(true);
  });
});

describe('sum()', () => {
  it('suma una lista y una lista vacía da cero', () => {
    const r = sum([m(100), m(250), m(-50)]);
    expect(r.ok && r.value).toBe(300);
    const vacia = sum([]);
    expect(vacia.ok && vacia.value).toBe(0);
  });

  it('se detiene si algún paso sale del rango', () => {
    const r = sum([m(Number.MAX_SAFE_INTEGER), m(1), m(-1)]);
    expect(!r.ok && r.error.code).toBe('OUT_OF_RANGE');
  });
});

describe('comparar', () => {
  it('compare devuelve -1, 0 o 1', () => {
    expect(compare(m(1), m(2))).toBe(-1);
    expect(compare(m(2), m(2))).toBe(0);
    expect(compare(m(3), m(2))).toBe(1);
  });

  it('isZero solo es verdadero para cero', () => {
    expect(isZero(ZERO)).toBe(true);
    expect(isZero(m(1))).toBe(false);
    expect(isZero(m(-1))).toBe(false);
  });
});

describe('formatMoney', () => {
  it.each([
    [0, '$0.00'],
    [1, '$0.01'],
    [9, '$0.09'],
    [10, '$0.10'],
    [99, '$0.99'],
    [100, '$1.00'],
    [123_456, '$1,234.56'],
    [100_000, '$1,000.00'],
    [99_999, '$999.99'],
    [100_000_000, '$1,000,000.00'],
    [-5, '-$0.05'],
    [-123_456, '-$1,234.56'],
    [Number.MAX_SAFE_INTEGER, '$90,071,992,547,409.91'],
  ])('%i centavos → %s', (c, texto) => {
    expect(formatMoney(m(c))).toBe(texto);
  });
});

describe('propiedades', () => {
  it('la suma es conmutativa', () => {
    fc.assert(
      fc.property(centavos, centavos, (a, b) => {
        expect(valor(add(m(a), m(b)))).toBe(valor(add(m(b), m(a))));
      }),
    );
  });

  it('la suma es asociativa', () => {
    fc.assert(
      fc.property(centavos, centavos, centavos, (a, b, c) => {
        const izq = valor(add(m(valor(add(m(a), m(b)))), m(c)));
        const der = valor(add(m(a), m(valor(add(m(b), m(c))))));
        expect(izq).toBe(der);
      }),
    );
  });

  it('sumar y restar lo mismo regresa al original', () => {
    fc.assert(
      fc.property(centavos, centavos, (a, b) => {
        const ida = m(valor(add(m(a), m(b))));
        expect(valor(subtract(ida, m(b)))).toBe(a);
      }),
    );
  });

  it('multiplicar por n es lo mismo que sumar n veces', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100_000, max: 100_000 }),
        fc.integer({ min: 0, max: 50 }),
        (a, n) => {
          let acumulado = ZERO;
          for (let i = 0; i < n; i += 1) {
            acumulado = m(valor(add(acumulado, m(a))));
          }
          expect(valor(multiply(m(a), n))).toBe(acumulado);
        },
      ),
    );
  });

  it('todo monto válido se formatea y vuelve a los mismos centavos', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), (c) => {
        const texto = formatMoney(m(c));
        const limpio = texto.replace(/[$,]/g, '');
        const [pesos = '', cent = ''] = limpio.split('.');
        const reconstruido = Math.sign(c) * (Math.abs(Number(pesos)) * 100 + Number(cent));
        expect(reconstruido || 0).toBe(c);
      }),
    );
  });
});
