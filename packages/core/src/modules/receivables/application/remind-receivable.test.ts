import { describe, expect, it } from 'vitest';

import { remindReceivable } from './remind-receivable';

const PLANTILLA =
  'Hola {cliente}, de {negocio}: la orden {folio} tiene un saldo de {saldo}. ¡Gracias!';

function entorno() {
  const abiertos: string[] = [];
  return { abiertos, deps: { openLink: (u: string) => abiertos.push(u) } };
}

describe('recordatorio por WhatsApp', () => {
  it('abre WhatsApp con el mensaje amable con folio y saldo', () => {
    const { abiertos, deps } = entorno();
    const r = remindReceivable(deps, {
      row: { folio: 'OT-2026-0003', balanceCents: 123_456 },
      customerName: 'Ana López',
      phone: '5512345678',
      businessName: 'ZAMMIR',
      template: PLANTILLA,
    });
    expect(r.ok).toBe(true);
    expect(abiertos).toHaveLength(1);
    const [base, texto] = (abiertos[0] ?? '').split('?text=');
    expect(base).toBe('https://wa.me/525512345678');
    expect(decodeURIComponent(texto ?? '')).toBe(
      'Hola Ana López, de ZAMMIR: la orden OT-2026-0003 tiene un saldo de $1,234.56. ¡Gracias!',
    );
  });

  it('sin teléfono no abre nada y avisa', () => {
    const { abiertos, deps } = entorno();
    for (const phone of [null, '', '   ']) {
      const r = remindReceivable(deps, {
        row: { folio: 'OT-1', balanceCents: 100 },
        customerName: 'Ana',
        phone,
        businessName: 'ZAMMIR',
        template: PLANTILLA,
      });
      expect(r).toEqual({ ok: false, error: { code: 'NO_PHONE' } });
    }
    expect(abiertos).toHaveLength(0);
  });
});
