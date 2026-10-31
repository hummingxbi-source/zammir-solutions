import type { Timer } from '@zammir/core';

/** Temporizador del navegador para el motor de envío. */
export const browserTimer: Timer = {
  after(ms, accion) {
    const id = window.setTimeout(accion, ms);
    return () => {
      window.clearTimeout(id);
    };
  },
};
