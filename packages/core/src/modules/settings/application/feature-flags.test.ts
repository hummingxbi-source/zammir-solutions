import { describe, expect, it } from 'vitest';

import { featureFlagsApagados, featureFlagsFromSettings } from './feature-flags';

describe('featureFlagsFromSettings', () => {
  it('con P1 y P2 apagados devuelve falso en ambos', () => {
    const flags = featureFlagsFromSettings({ feature_p1: false, feature_p2: false });
    expect(flags.isEnabled('P1')).toBe(false);
    expect(flags.isEnabled('P2')).toBe(false);
  });

  it('enciende solo el interruptor que está encendido', () => {
    const flags = featureFlagsFromSettings({ feature_p1: true, feature_p2: false });
    expect(flags.isEnabled('P1')).toBe(true);
    expect(flags.isEnabled('P2')).toBe(false);
  });
});

describe('featureFlagsApagados', () => {
  it('todo está apagado', () => {
    expect(featureFlagsApagados.isEnabled('P1')).toBe(false);
    expect(featureFlagsApagados.isEnabled('P2')).toBe(false);
  });
});
