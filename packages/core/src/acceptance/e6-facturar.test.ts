import { describe, expect, it } from 'vitest';

import { asId } from '../shared-kernel/id';
import { authorizeInvoiceIssue } from '../modules/billing/application/invoice-issue';
import type { Authorization } from '../modules/identity/application/authorize-with-admin-pin';

/** E6 · Facturación por administrador [PRUEBAS_DE_ACEPTACION.md]: un cajero sin permiso no puede facturar; con la
 *  autorización de un administrador, sí; un administrador, por su cuenta. La parte del servidor (la función
 *  `facturar` solo atiende a administradores con sesión) la prueba `e5-e6-facturacion.integracion.test.ts`. */
const ADMIN_ID = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');
const ana = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF' as const,
};
const luis = { userId: ADMIN_ID, role: 'ADMIN' as const };
const conPin: Authorization = {
  adminId: ADMIN_ID,
  authorizedAt: new Date('2026-11-12T18:00:00.000Z'),
};

describe('E6 · quién puede facturar', () => {
  it('un cajero sin permiso no puede facturar', () => {
    const r = authorizeInvoiceIssue(ana);
    expect(!r.ok && r.error.code).toBe('AUTHORIZATION_REQUIRED');
  });

  it('con la autorización de un administrador, sí; y queda quién la respaldó', () => {
    const r = authorizeInvoiceIssue(ana, conPin);
    expect(r.ok && r.value.authorizedBy).toBe(ADMIN_ID);
  });

  it('un administrador factura por su cuenta y se respalda a sí mismo', () => {
    const r = authorizeInvoiceIssue(luis);
    expect(r.ok && r.value.authorizedBy).toBe(luis.userId);
  });

  it('la tablet sin persona y quien no ha entrado no pueden facturar, ni con autorización', () => {
    for (const role of ['DEVICE', null] as const) {
      const r = authorizeInvoiceIssue({ userId: ana.userId, role }, conPin);
      expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    }
  });
});
