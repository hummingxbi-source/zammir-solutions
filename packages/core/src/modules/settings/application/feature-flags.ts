import type { BusinessSettings } from '../domain/business-settings';
import type { FeatureFlag, FeatureFlags } from './ports';

/** Interruptores leídos de los ajustes del negocio. */
export function featureFlagsFromSettings(
  ajustes: Pick<BusinessSettings, 'feature_p1' | 'feature_p2'>,
): FeatureFlags {
  const encendidos: Record<FeatureFlag, boolean> = {
    P1: ajustes.feature_p1,
    P2: ajustes.feature_p2,
  };
  return {
    isEnabled: (flag) => encendidos[flag],
  };
}

/** Todos apagados: lo que hay antes de poder leer los ajustes, y lo que usan las pruebas. */
export const featureFlagsApagados: FeatureFlags = {
  isEnabled: () => false,
};
