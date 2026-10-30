import { parseBusinessSettings, type SettingRow } from '../domain/business-settings';
import type { SettingsRepository } from './ports';

/** Adaptador en memoria del puerto SettingsRepository, para pruebas. */
export function inMemorySettingsRepository(filas: readonly SettingRow[]): SettingsRepository {
  return {
    load: () => Promise.resolve(parseBusinessSettings(filas)),
  };
}
