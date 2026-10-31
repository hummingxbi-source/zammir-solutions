import { describe, expect, it } from 'vitest';

import { err, ok } from '../../../shared-kernel/result';
import {
  conditionLines,
  inMemoryQuoteConditions,
  saveQuoteConditions,
  MAX_CONDITION_LENGTH,
  MAX_QUOTE_CONDITIONS,
  type QuoteConditionsStore,
} from './quote-conditions';

const admin = { role: 'ADMIN' } as const;

describe('condiciones de la cotización', () => {
  it('cada línea no vacía es una condición, sin espacios de más', () => {
    expect(conditionLines('  Uno \n\n Dos\r\n   \nTres')).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('un administrador las guarda ya normalizadas', async () => {
    const tienda = inMemoryQuoteConditions('viejo');
    const r = await saveQuoteConditions(tienda, admin, ' A \n\n B ');
    expect(r).toEqual(ok('A\nB'));
    expect(tienda.current()).toBe('A\nB');
  });

  it('un cajero, o quien no ha entrado, no las cambia y nada se guarda', async () => {
    const tienda = inMemoryQuoteConditions('viejo');
    expect(await saveQuoteConditions(tienda, { role: 'STAFF' }, 'Nuevo')).toEqual(
      err({ code: 'NOT_AUTHORIZED' }),
    );
    expect(await saveQuoteConditions(tienda, { role: null }, 'Nuevo')).toEqual(
      err({ code: 'NOT_AUTHORIZED' }),
    );
    expect(tienda.current()).toBe('viejo');
  });

  it('no acepta un texto vacío, demasiadas condiciones ni una demasiado larga', async () => {
    const tienda = inMemoryQuoteConditions('viejo');
    expect(await saveQuoteConditions(tienda, admin, ' \n ')).toEqual(err({ code: 'EMPTY' }));
    const muchas = Array.from({ length: MAX_QUOTE_CONDITIONS + 1 }, (_, i) => `c${String(i)}`);
    expect(await saveQuoteConditions(tienda, admin, muchas.join('\n'))).toEqual(
      err({ code: 'TOO_MANY' }),
    );
    expect(
      await saveQuoteConditions(tienda, admin, 'x'.repeat(MAX_CONDITION_LENGTH + 1)),
    ).toEqual(err({ code: 'TOO_LONG' }));
    expect(tienda.current()).toBe('viejo');
  });

  it('si el servidor falla, el error sale tal cual', async () => {
    const roto: QuoteConditionsStore = {
      read: () => Promise.resolve(err({ code: 'SETTINGS_UNAVAILABLE' })),
      write: () => Promise.resolve(err({ code: 'SETTINGS_UNAVAILABLE' })),
    };
    expect(await saveQuoteConditions(roto, admin, 'Algo')).toEqual(
      err({ code: 'SETTINGS_UNAVAILABLE' }),
    );
  });
});
