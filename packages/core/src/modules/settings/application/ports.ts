import type { Result } from '../../../shared-kernel/result';
import type { BusinessSettings, SettingRow, SettingsError } from '../domain/business-settings';

/** Interruptores de lo que el cliente puede activar. Apagados por defecto [docs/producto/ALCANCE.md §3]. */
export type FeatureFlag = 'P1' | 'P2';

/** Puerto: ¿está encendido un interruptor? */
export interface FeatureFlags {
  isEnabled(flag: FeatureFlag): boolean;
}

/** Puerto: lectura de los ajustes del negocio. */
export interface SettingsRepository {
  load(): Promise<Result<BusinessSettings, SettingsError>>;
}

export type { SettingRow };
