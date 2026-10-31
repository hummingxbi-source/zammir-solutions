import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import type { PinAttemptGuard } from '../application/pin-attempt-guard';

export interface GuardDelContrato {
  readonly guard: PinAttemptGuard;
  /** Mueve el reloj del adaptador. */
  readonly avanzar: (segundos: number) => void;
}

/** Política con la que el contrato prepara el adaptador: 3 intentos, 30 s, tope 120 s. */
export const POLITICA_DEL_CONTRATO = { maxAttempts: 3, baseSeconds: 30, capSeconds: 120 } as const;

const ana = asId<'User'>('u-ana');
const luis = asId<'User'>('u-luis');

/** Batería de contrato de PinAttemptGuard: la pasan la memoria y el almacén de la tablet (IndexedDB). */
export function pinAttemptGuardContract(
  nombre: string,
  crear: () => GuardDelContrato | Promise<GuardDelContrato>,
): void {
  describe(`contrato de PinAttemptGuard: ${nombre}`, () => {
    async function fallar(h: GuardDelContrato, veces: number, quien = ana): Promise<void> {
      for (let i = 0; i < veces; i += 1) {
        await h.guard.recordFailure(quien);
      }
    }

    it('sin intentos fallidos no hay bloqueo', async () => {
      const h = await crear();
      expect(await h.guard.check(ana)).toEqual({ locked: false });
    });

    it('antes del máximo de intentos no bloquea', async () => {
      const h = await crear();
      await fallar(h, 2);
      expect(await h.guard.check(ana)).toEqual({ locked: false });
    });

    it('al llegar al máximo bloquea el tiempo base y el tiempo corre', async () => {
      const h = await crear();
      await fallar(h, 3);
      expect(await h.guard.check(ana)).toEqual({ locked: true, retryAfterSeconds: 30 });
      h.avanzar(10);
      expect(await h.guard.check(ana)).toEqual({ locked: true, retryAfterSeconds: 20 });
      h.avanzar(20);
      expect(await h.guard.check(ana)).toEqual({ locked: false });
    });

    it('cada intento fallido de más duplica el bloqueo, hasta el tope', async () => {
      const h = await crear();
      await fallar(h, 4);
      expect(await h.guard.check(ana)).toEqual({ locked: true, retryAfterSeconds: 60 });
      await fallar(h, 5);
      expect(await h.guard.check(ana)).toEqual({ locked: true, retryAfterSeconds: 120 });
    });

    it('un acierto borra los intentos fallidos', async () => {
      const h = await crear();
      await fallar(h, 3);
      await h.guard.recordSuccess(ana);
      expect(await h.guard.check(ana)).toEqual({ locked: false });
      await fallar(h, 2);
      expect(await h.guard.check(ana)).toEqual({ locked: false });
    });

    it('cada persona lleva su propia cuenta', async () => {
      const h = await crear();
      await fallar(h, 3, ana);
      expect(await h.guard.check(luis)).toEqual({ locked: false });
    });
  });
}
