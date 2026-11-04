import { describe, expect, it } from 'vitest';

import {
  CFDI_USES,
  FISCAL_REGIMES,
  isFiscalRegime,
  isPortalCfdiUse,
  PORTAL_CFDI_USES,
  personTypeOfRfc,
  regimesForRfc,
} from './sat-catalogs';

describe('catálogos del SAT', () => {
  it('no repiten claves y cada una tiene nombre', () => {
    for (const lista of [FISCAL_REGIMES, CFDI_USES]) {
      const claves = lista.map((x) => x.code);
      expect(new Set(claves).size).toBe(claves.length);
      expect(lista.every((x) => x.name.trim() !== '')).toBe(true);
    }
  });

  it('las claves de régimen tienen tres dígitos y las de uso su letra y número', () => {
    expect(FISCAL_REGIMES.every((r) => /^\d{3}$/.test(r.code))).toBe(true);
    expect(CFDI_USES.every((u) => /^[A-Z]{1,2}\d{2}$/.test(u.code))).toBe(true);
  });

  it('el régimen "Sin obligaciones fiscales" y el "General de Ley Personas Morales" existen', () => {
    expect(isFiscalRegime('616')).toBe(true);
    expect(isFiscalRegime('601')).toBe(true);
    expect(isFiscalRegime('999')).toBe(false);
    expect(isFiscalRegime('')).toBe(false);
  });

  it('el portal no ofrece pagos, nómina ni devoluciones, pero sí "Gastos en general" y "Sin efectos fiscales"', () => {
    for (const clave of ['CP01', 'CN01', 'G02']) {
      expect(isPortalCfdiUse(clave)).toBe(false);
    }
    for (const clave of ['G01', 'G03', 'S01', 'I01', 'D10']) {
      expect(isPortalCfdiUse(clave)).toBe(true);
    }
    expect(PORTAL_CFDI_USES.length).toBe(CFDI_USES.length - 3);
  });

  it('el tipo de persona sale del largo del RFC', () => {
    expect(personTypeOfRfc('XAXX010101000')).toBe('FISICA');
    expect(personTypeOfRfc('ABC010101AB1')).toBe('MORAL');
    expect(personTypeOfRfc('CORTO')).toBeNull();
    expect(personTypeOfRfc('')).toBeNull();
  });

  it('los regímenes se filtran por tipo de persona y siempre incluyen los que valen para ambas', () => {
    const fisica = regimesForRfc('xaxx010101000').map((r) => r.code);
    expect(fisica).toContain('612');
    expect(fisica).toContain('626');
    expect(fisica).not.toContain('601');
    const moral = regimesForRfc('ABC010101AB1').map((r) => r.code);
    expect(moral).toContain('601');
    expect(moral).toContain('626');
    expect(moral).not.toContain('612');
    expect(regimesForRfc('lo que sea')).toEqual(FISCAL_REGIMES);
  });
});
