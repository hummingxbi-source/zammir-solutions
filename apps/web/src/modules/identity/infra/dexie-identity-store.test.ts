import 'fake-indexeddb/auto';
import {
  localLoginStoreContract,
  pinAttemptGuardContract,
  POLITICA_DEL_CONTRATO,
  copiaDePrueba,
  personaDePrueba,
} from '@zammir/core/testing';
import { asId } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { dexieIdentity } from './dexie-identity-store';

let contador = 0;
const nombreNuevo = (): string => {
  contador += 1;
  return `prueba-identidad-${String(contador)}`;
};

localLoginStoreContract('IndexedDB (Dexie)', () => dexieIdentity(nombreNuevo()).store);

pinAttemptGuardContract('IndexedDB (Dexie)', () => {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  return {
    guard: dexieIdentity(nombreNuevo()).guard({ now: () => new Date(ahora) }, () =>
      Promise.resolve(POLITICA_DEL_CONTRATO),
    ),
    avanzar: (s) => {
      ahora += s * 1000;
    },
  };
});

describe('dexieIdentity', () => {
  it('los intentos fallidos y la copia sobreviven a cerrar y abrir la aplicación', async () => {
    const nombre = nombreNuevo();
    const ahora = new Date('2026-10-30T12:00:00.000Z');
    const primera = dexieIdentity(nombre);
    await primera.store.replace(copiaDePrueba([personaDePrueba('a')]));
    const g1 = primera.guard({ now: () => ahora }, () => Promise.resolve(POLITICA_DEL_CONTRATO));
    for (let i = 0; i < 3; i += 1) {
      await g1.recordFailure(asId<'User'>('a'));
    }
    const reabierta = dexieIdentity(nombre);
    expect((await reabierta.store.load())?.users).toHaveLength(1);
    const g2 = reabierta.guard({ now: () => ahora }, () => Promise.resolve(POLITICA_DEL_CONTRATO));
    expect(await g2.check(asId<'User'>('a'))).toEqual({ locked: true, retryAfterSeconds: 30 });
  });

  it('con la política por definir no bloquea nunca', async () => {
    const g = dexieIdentity(nombreNuevo()).guard({ now: () => new Date(0) }, () =>
      Promise.resolve(null),
    );
    for (let i = 0; i < 20; i += 1) {
      await g.recordFailure(asId<'User'>('a'));
    }
    expect(await g.check(asId<'User'>('a'))).toEqual({ locked: false });
  });
});
