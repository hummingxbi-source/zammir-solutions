import { describe, expect, it } from 'vitest';

import type { SettingsRepository } from '../application/ports';
import type { SettingRow } from '../domain/business-settings';
import { filasValidas } from '../domain/business-settings.fixtures';

/** Batería de contrato de SettingsRepository: la pasan TODOS los adaptadores
 *  (memoria, Supabase…) para que sean intercambiables [00-principios §2, Liskov]. */
export function settingsRepositoryContract(
  nombre: string,
  crear: (filas: readonly SettingRow[]) => SettingsRepository,
): void {
  describe(`contrato de SettingsRepository: ${nombre}`, () => {
    it('carga los ajustes válidos', async () => {
      const resultado = await crear(filasValidas()).load();
      expect(resultado.ok).toBe(true);
    });

    it('reporta ajustes inválidos con un error tipado, sin lanzar excepciones', async () => {
      const resultado = await crear(filasValidas({ tax_rate_bps: -1 })).load();
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error.code).toBe('SETTINGS_INVALID');
      }
    });

    it('reporta ajustes que faltan', async () => {
      const resultado = await crear([]).load();
      expect(resultado.ok).toBe(false);
    });
  });
}
