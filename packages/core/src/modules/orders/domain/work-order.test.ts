import { describe, expect, it } from 'vitest';

import {
  checkWorkOrderTransition,
  nextWorkOrderStatus,
  WORK_ORDER_TRANSITIONS,
  type WorkOrderStatus,
} from './work-order';

const TODOS: readonly WorkOrderStatus[] = [
  'WAITING',
  'IN_PROCESS',
  'READY',
  'DELIVERED',
  'CANCELLED',
];

describe('máquina de estados de la orden', () => {
  const validas: [WorkOrderStatus, WorkOrderStatus][] = [
    ['WAITING', 'IN_PROCESS'],
    ['IN_PROCESS', 'READY'],
    ['READY', 'DELIVERED'],
    ['WAITING', 'CANCELLED'],
    ['IN_PROCESS', 'CANCELLED'],
    ['READY', 'CANCELLED'],
  ];

  it.each(validas)('%s → %s es válida', (de, a) => {
    expect(checkWorkOrderTransition(de, a)).toEqual({ ok: true, value: a });
  });

  it('todas las demás son inválidas, con el error tipado', () => {
    for (const de of TODOS) {
      for (const a of TODOS) {
        const esValida = validas.some(([x, y]) => x === de && y === a);
        const r = checkWorkOrderTransition(de, a);
        expect(r.ok).toBe(esValida);
        if (!r.ok) {
          expect(r.error).toEqual({ code: 'INVALID_TRANSITION', from: de, to: a });
        }
      }
    }
  });

  it('entregado y cancelado son finales', () => {
    expect(WORK_ORDER_TRANSITIONS.DELIVERED).toEqual([]);
    expect(WORK_ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('el botón "Avanzar" sigue en espera → en proceso → listo → entregado y termina', () => {
    expect(nextWorkOrderStatus('WAITING')).toBe('IN_PROCESS');
    expect(nextWorkOrderStatus('IN_PROCESS')).toBe('READY');
    expect(nextWorkOrderStatus('READY')).toBe('DELIVERED');
    expect(nextWorkOrderStatus('DELIVERED')).toBeNull();
    expect(nextWorkOrderStatus('CANCELLED')).toBeNull();
  });
});
