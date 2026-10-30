import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { buildCustomer, NO_FISCAL_PROFILE, type CustomerDraft } from './customer';

const id = asId<'Customer'>('c-1');
const minimo: CustomerDraft = {
  name: 'Ana López',
  phone: '55 1234 5678',
  email: null,
  notes: null,
  fiscal: NO_FISCAL_PROFILE,
  privacyNoticeVersion: null,
};

function codigo(cambios: Partial<CustomerDraft>): string {
  const r = buildCustomer(id, { ...minimo, ...cambios });
  return r.ok ? 'válido' : r.error.code;
}

describe('buildCustomer', () => {
  it('con solo nombre y WhatsApp basta; el resto queda vacío', () => {
    const r = buildCustomer(id, minimo);
    expect(r.ok && r.value).toEqual({
      id,
      name: 'Ana López',
      phone: '5512345678',
      email: null,
      notes: null,
      fiscal: NO_FISCAL_PROFILE,
      privacyNoticeVersion: null,
      anonymizedAt: null,
    });
  });

  it('el nombre es obligatorio', () => {
    expect(codigo({ name: '' })).toBe('NAME_REQUIRED');
    expect(codigo({ name: '   ' })).toBe('NAME_REQUIRED');
  });

  it('el WhatsApp es obligatorio y de 10 dígitos', () => {
    expect(codigo({ phone: '' })).toBe('PHONE_INVALID');
    expect(codigo({ phone: '551234567' })).toBe('PHONE_INVALID');
    expect(codigo({ phone: '55123456789' })).toBe('PHONE_INVALID');
    expect(codigo({ phone: 'no es un número' })).toBe('PHONE_INVALID');
  });

  it('normaliza nombre, teléfono y quita espacios sobrantes de los textos', () => {
    const r = buildCustomer(id, {
      ...minimo,
      name: '  Ana López  ',
      phone: '+52 (55) 1234-5678',
      email: '  ana@ejemplo.invalid ',
      notes: '  Llamar en la tarde ',
    });
    expect(r.ok && [r.value.name, r.value.phone, r.value.email, r.value.notes]).toEqual([
      'Ana López',
      '5512345678',
      'ana@ejemplo.invalid',
      'Llamar en la tarde',
    ]);
  });

  it('un correo o notas en blanco quedan vacíos; un correo mal escrito se rechaza', () => {
    const r = buildCustomer(id, { ...minimo, email: '   ', notes: '  ' });
    expect(r.ok && [r.value.email, r.value.notes]).toEqual([null, null]);
    expect(codigo({ email: 'sin-arroba' })).toBe('EMAIL_INVALID');
    expect(codigo({ email: 'a@b' })).toBe('EMAIL_INVALID');
  });

  describe('RFC', () => {
    it.each(['XAXX010101000', 'XEXX010101000', 'ABC850101AB1', 'GODE561231GR8', 'Ñ&A850101AB1'])(
      'acepta %s (12 o 13 caracteres)',
      (rfc) => {
        expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, rfc } })).toBe('válido');
      },
    );

    it('lo guarda en mayúsculas y sin espacios', () => {
      const r = buildCustomer(id, {
        ...minimo,
        fiscal: { ...NO_FISCAL_PROFILE, rfc: ' xaxx010101000 ' },
      });
      expect(r.ok && r.value.fiscal.rfc).toBe('XAXX010101000');
    });

    it('vacío está permitido', () => {
      expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, rfc: '' } })).toBe('válido');
      expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, rfc: '   ' } })).toBe('válido');
    });

    it.each([
      'XAXX01010100',
      'XAXX0101010000',
      'ABC',
      'XAXX0101O1000',
      '1234567890123',
      'XA 010101000',
    ])('rechaza %s', (rfc) => {
      expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, rfc } })).toBe('RFC_INVALID');
    });
  });

  describe('código postal fiscal', () => {
    it('acepta 5 dígitos y vacío', () => {
      expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, fiscalZip: '55600' } })).toBe('válido');
      expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, fiscalZip: '' } })).toBe('válido');
    });

    it.each(['5560', '556000', 'ABCDE', '55 60'])('rechaza %s', (fiscalZip) => {
      expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, fiscalZip } })).toBe('FISCAL_ZIP_INVALID');
    });
  });

  it('el orden de las validaciones es nombre, teléfono, correo, RFC y código postal', () => {
    expect(codigo({ name: '', phone: '1' })).toBe('NAME_REQUIRED');
    expect(codigo({ phone: '1', email: 'x' })).toBe('PHONE_INVALID');
    expect(codigo({ email: 'x', fiscal: { ...NO_FISCAL_PROFILE, rfc: 'mal' } })).toBe(
      'EMAIL_INVALID',
    );
    expect(codigo({ fiscal: { ...NO_FISCAL_PROFILE, rfc: 'mal', fiscalZip: '1' } })).toBe(
      'RFC_INVALID',
    );
  });

  it('puede conservar la fecha de anonimización de un cliente ya anonimizado', () => {
    const fecha = new Date('2026-10-30T12:00:00.000Z');
    const r = buildCustomer(id, minimo, fecha);
    expect(r.ok && r.value.anonymizedAt).toEqual(fecha);
  });
});
