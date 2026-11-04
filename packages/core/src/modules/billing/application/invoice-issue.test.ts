import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { createPermissionPolicy } from '../../identity/domain/permissions';
import { authorizeInvoiceIssue, invoiceFolio } from './invoice-issue';

const ana = asId<'User'>('u-ana');
const luis = asId<'User'>('u-luis');
const autorizacion = { adminId: luis, authorizedAt: new Date('2026-11-03T18:00:00.000Z') };

describe('quién puede facturar', () => {
  it('un administrador factura y se respalda a sí mismo', () => {
    const r = authorizeInvoiceIssue({ userId: luis, role: 'ADMIN' });
    expect(r).toEqual({ ok: true, value: { authorizedBy: luis } });
  });

  it('un cajero sin autorización no factura y se le pide el PIN de un administrador', () => {
    const r = authorizeInvoiceIssue({ userId: ana, role: 'STAFF' });
    expect(!r.ok && r.error.code).toBe('AUTHORIZATION_REQUIRED');
  });

  it('un cajero con el PIN de un administrador factura, respaldado por ese administrador', () => {
    const r = authorizeInvoiceIssue({ userId: ana, role: 'STAFF' }, autorizacion);
    expect(r).toEqual({ ok: true, value: { authorizedBy: luis } });
  });

  it('un administrador no necesita autorización aunque se le mande una de otro', () => {
    const otro = { ...autorizacion, adminId: asId<'User'>('u-otro') };
    const r = authorizeInvoiceIssue({ userId: luis, role: 'ADMIN' }, otro);
    expect(r.ok && r.value.authorizedBy).toBe(luis);
  });

  it('sin rol, nadie factura, ni con autorización', () => {
    const r = authorizeInvoiceIssue({ userId: ana, role: null }, autorizacion);
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });

  it('respeta la política de permisos que se le dé', () => {
    const soloAdmin = createPermissionPolicy({ INVOICE_GENERATE: { STAFF: 'DENY' } });
    const r = authorizeInvoiceIssue({ userId: ana, role: 'STAFF' }, autorizacion, soloAdmin);
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });
});

describe('folio de la factura', () => {
  it('lleva F, el año de México y cuatro dígitos', () => {
    expect(invoiceFolio(new Date('2026-11-03T18:00:00.000Z'), 1)).toEqual({
      ok: true,
      value: 'F-2026-0001',
    });
    expect(invoiceFolio(new Date('2026-11-03T18:00:00.000Z'), 12_345)).toEqual({
      ok: true,
      value: 'F-2026-12345',
    });
  });

  it('el año es el de México, no el de UTC', () => {
    // 1 ene 2027 03:00 UTC todavía es 31 dic 2026 en México.
    expect(invoiceFolio(new Date('2027-01-01T03:00:00.000Z'), 7)).toEqual({
      ok: true,
      value: 'F-2026-0007',
    });
    expect(invoiceFolio(new Date('2027-01-01T07:00:00.000Z'), 7)).toEqual({
      ok: true,
      value: 'F-2027-0007',
    });
  });

  it('un número que no es positivo no vale', () => {
    const r = invoiceFolio(new Date('2026-11-03T18:00:00.000Z'), 0);
    expect(!r.ok && r.error.code).toBe('INVALID_NUMBER');
  });
});
