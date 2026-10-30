import type { Clock } from '@zammir/core';

/** Adaptador real del puerto Clock: la hora del dispositivo. */
export const systemClock: Clock = {
  now: () => new Date(),
};
