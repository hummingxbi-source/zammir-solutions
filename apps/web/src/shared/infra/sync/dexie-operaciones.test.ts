import 'fake-indexeddb/auto';
import { fixedClock } from '@zammir/core';
import { operacionSinSeq, syncOutboxContract } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { dexieOperaciones } from './dexie-operaciones';

let contador = 0;
const nombreNuevo = (): string => {
  contador += 1;
  return `prueba-operaciones-${String(contador)}`;
};
const reloj = fixedClock(new Date('2026-10-30T12:00:00.000Z'));

syncOutboxContract('IndexedDB (Dexie)', () =>
  dexieOperaciones({ clock: reloj, nombre: nombreNuevo() }),
);

describe('dexieOperaciones', () => {
  it('la cola, los documentos y los contadores sobreviven a cerrar y abrir la aplicación', async () => {
    const nombre = nombreNuevo();
    const primera = dexieOperaciones({ clock: reloj, nombre });
    const op = await primera.transaction(async (tx) => {
      const r = await tx.enqueue(operacionSinSeq());
      await tx.putDocument('quotes', 'q1', { folio: 'T1-0001' });
      await tx.nextTempNumber();
      return r;
    });
    expect(op.ok).toBe(true);

    const reabierta = dexieOperaciones({ clock: reloj, nombre });
    expect(await reabierta.pendingCount()).toBe(1);
    expect(await reabierta.transaction((tx) => tx.getDocument('quotes', 'q1'))).toEqual({
      folio: 'T1-0001',
    });
    const siguiente = await reabierta.transaction(async (tx) => ({
      temp: await tx.nextTempNumber(),
      op: await tx.enqueue(operacionSinSeq()),
    }));
    expect(siguiente.temp).toBe(2);
    expect(siguiente.op.ok && siguiente.op.value.seq).toBe(2);
  });

  it('operaciones viejas en la cola no se borran al abrir la base de nuevo (actualización de la aplicación)', async () => {
    const nombre = nombreNuevo();
    const antes = dexieOperaciones({ clock: reloj, nombre });
    await antes.transaction((tx) => tx.enqueue(operacionSinSeq()));
    await antes.transaction((tx) => tx.enqueue(operacionSinSeq()));
    const despues = dexieOperaciones({ clock: reloj, nombre });
    expect((await despues.list()).map((o) => o.envelope.seq)).toEqual([1, 2]);
  });
});
