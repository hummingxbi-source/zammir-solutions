import { describe, expect, it } from 'vitest';

import { parseBusinessSettings } from './business-settings';
import { filasValidas } from './business-settings.fixtures';

describe('parseBusinessSettings', () => {
  it('acepta los valores iniciales y deja en null lo que está por definir', () => {
    const resultado = parseBusinessSettings(filasValidas());
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.tax_rate_bps).toBe(1600);
      expect(resultado.value.feature_p1).toBe(false);
      expect(resultado.value.admin_idle_logout_minutes).toBeNull();
      expect(resultado.value.warranty_months_default).toBeNull();
    }
  });

  it('acepta un valor ya definido en lugar de null', () => {
    const resultado = parseBusinessSettings(
      filasValidas({ warranty_months_default: 6, business_name: 'Negocio de prueba' }),
    );
    expect(resultado.ok && resultado.value.warranty_months_default).toBe(6);
    expect(resultado.ok && resultado.value.business_name).toBe('Negocio de prueba');
  });

  it('avisa qué ajustes faltan', () => {
    const sinIva = filasValidas().filter((fila) => fila.key !== 'tax_rate_bps');
    const resultado = parseBusinessSettings(sinIva);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe('SETTINGS_INVALID');
      expect(resultado.error.problemas.join(' ')).toContain('tax_rate_bps');
    }
  });

  it.each([
    ['una tasa de IVA mayor al 100 %', { tax_rate_bps: 10_001 }],
    ['una tasa de IVA con decimales', { tax_rate_bps: 16.5 }],
    ['un anticipo negativo', { deposit_percent_bps: -1 }],
    ['una vigencia de cero días', { quote_validity_days: 0 }],
    ['un tratamiento de anticipos desconocido', { deposit_tax_treatment: 'c' }],
    ['un interruptor que no es verdadero o falso', { feature_p1: 'si' }],
    ['un nombre vacío en lugar de null', { business_name: '' }],
    ['un aviso de timbres mayor al 100 %', { stamps_warning_percent: 101 }],
  ])('rechaza %s', (_descripcion, cambio) => {
    const resultado = parseBusinessSettings(filasValidas(cambio));
    expect(resultado.ok).toBe(false);
  });

  it('con varios problemas los reporta todos', () => {
    const resultado = parseBusinessSettings(
      filasValidas({ tax_rate_bps: -5, quote_validity_days: 0 }),
    );
    expect(!resultado.ok && resultado.error.problemas).toHaveLength(2);
  });

  it('acepta el tratamiento de anticipos "b" cuando el contador lo exija', () => {
    const resultado = parseBusinessSettings(filasValidas({ deposit_tax_treatment: 'b' }));
    expect(resultado.ok && resultado.value.deposit_tax_treatment).toBe('b');
  });

  it('acepta los textos y datos del negocio ya definidos', () => {
    const resultado = parseBusinessSettings(
      filasValidas({
        self_invoicing_legend: 'Factura tu compra antes de que termine el mes',
        business_address: 'Calle de prueba 123, Otumba',
        business_phone: '5512345678',
        business_logo_url: 'https://ejemplo.invalid/logo.png',
        pin_max_failed_attempts: 5,
        pin_lock_seconds: 30,
        stamps_yearly_limit: 1200,
        local_retention_days: 90,
        admin_idle_logout_minutes: 30,
      }),
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.self_invoicing_legend).toBe(
        'Factura tu compra antes de que termine el mes',
      );
      expect(resultado.value.business_address).toBe('Calle de prueba 123, Otumba');
      expect(resultado.value.business_phone).toBe('5512345678');
      expect(resultado.value.business_logo_url).toBe('https://ejemplo.invalid/logo.png');
    }
  });

  it('nombra el ajuste con problema al inicio del aviso', () => {
    const resultado = parseBusinessSettings(filasValidas({ idle_lock_minutes: 0 }));
    expect(!resultado.ok && resultado.error.problemas[0]).toMatch(/^idle_lock_minutes: /);
  });
});
