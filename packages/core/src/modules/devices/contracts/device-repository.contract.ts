import { describe, expect, it } from 'vitest';

import { asId, type DeviceId } from '../../../shared-kernel/id';
import type { RedeemInput, DeviceRepository } from '../application/ports';

export interface DeviceRepositoryDelContrato {
  readonly repo: DeviceRepository;
  /** Hace que el código ya haya vencido (avanza el reloj o recorre la fecha guardada). */
  readonly vencerCodigo: (code: string) => Promise<void>;
  /** Una identidad nueva para la tablet, como la que crea el servidor al canjear. */
  readonly nuevaCuenta: () => Promise<string>;
  /** Las entradas de bitácora de un dispositivo, leídas por un camino independiente del puerto. */
  readonly bitacoraDe: (id: DeviceId) => Promise<readonly string[]>;
}

/** Batería de contrato de DeviceRepository: la pasan todos los adaptadores (memoria, Supabase…). */
export function deviceRepositoryContract(
  nombre: string,
  crear: () => DeviceRepositoryDelContrato | Promise<DeviceRepositoryDelContrato>,
  nuevoId: () => string,
): void {
  describe(`contrato de DeviceRepository: ${nombre}`, () => {
    async function registrar(h: DeviceRepositoryDelContrato, name = 'Tablet del mostrador') {
      const emitido = await h.repo.issueCode(15);
      if (!emitido.ok) {
        throw new Error('no se pudo emitir el código');
      }
      const entrada: RedeemInput = {
        code: emitido.value.code,
        name,
        authUserId: await h.nuevaCuenta(),
      };
      return { entrada, resultado: await h.repo.redeemCode(entrada) };
    }

    it('un código vigente crea el dispositivo activo y ya no sirve', async () => {
      const h = await crear();
      const { entrada, resultado } = await registrar(h);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) {
        return;
      }
      expect(resultado.value.name).toBe('Tablet del mostrador');
      expect(resultado.value.status).toBe('ACTIVE');
      expect(resultado.value.tempSeries).toBeGreaterThanOrEqual(1);
      expect(resultado.value.lastSentAt).toBeNull();
      expect(resultado.value.revokedAt).toBeNull();

      const otraVez = await h.repo.redeemCode({ ...entrada, authUserId: await h.nuevaCuenta() });
      expect(!otraVez.ok && otraVez.error.code).toBe('CODE_INVALID');
    });

    it('un código que no existe se rechaza', async () => {
      const h = await crear();
      const resultado = await h.repo.redeemCode({
        code: 'NOEXISTE',
        name: 'Tablet',
        authUserId: await h.nuevaCuenta(),
      });
      expect(!resultado.ok && resultado.error.code).toBe('CODE_INVALID');
    });

    it('un código vencido se rechaza y no crea el dispositivo', async () => {
      const h = await crear();
      const emitido = await h.repo.issueCode(15);
      if (!emitido.ok) {
        throw new Error('no se pudo emitir el código');
      }
      await h.vencerCodigo(emitido.value.code);
      const resultado = await h.repo.redeemCode({
        code: emitido.value.code,
        name: 'Tablet vencida',
        authUserId: await h.nuevaCuenta(),
      });
      expect(!resultado.ok && resultado.error.code).toBe('CODE_INVALID');
      const lista = await h.repo.list();
      expect(lista.ok && lista.value.some((d) => d.name === 'Tablet vencida')).toBe(false);
    });

    it('cada dispositivo recibe una serie de folios temporales distinta', async () => {
      const h = await crear();
      const a = await registrar(h, 'Tablet A');
      const b = await registrar(h, 'Tablet B');
      expect(a.resultado.ok && b.resultado.ok).toBe(true);
      if (a.resultado.ok && b.resultado.ok) {
        expect(a.resultado.value.tempSeries).not.toBe(b.resultado.value.tempSeries);
      }
    });

    it('la lista incluye al dispositivo registrado', async () => {
      const h = await crear();
      const { resultado } = await registrar(h, 'Tablet en lista');
      const lista = await h.repo.list();
      expect(lista.ok).toBe(true);
      if (resultado.ok && lista.ok) {
        expect(lista.value.find((d) => d.id === resultado.value.id)?.name).toBe('Tablet en lista');
      }
    });

    it('revocar marca al dispositivo y fija la hora; revocarlo otra vez no cambia nada', async () => {
      const h = await crear();
      const { resultado } = await registrar(h);
      if (!resultado.ok) {
        throw new Error('no se pudo registrar');
      }
      const primera = await h.repo.revoke(resultado.value.id);
      expect(primera.ok && primera.value.status).toBe('REVOKED');
      expect(primera.ok && primera.value.revokedAt).not.toBeNull();

      const segunda = await h.repo.revoke(resultado.value.id);
      expect(segunda.ok && segunda.value.revokedAt).toEqual(primera.ok && primera.value.revokedAt);
    });

    it('revocar un dispositivo que no existe se rechaza', async () => {
      const h = await crear();
      const resultado = await h.repo.revoke(asId<'Device'>(nuevoId()));
      expect(!resultado.ok && resultado.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('registrar y revocar dejan cada uno su entrada de bitácora, una sola vez', async () => {
      const h = await crear();
      const { resultado } = await registrar(h);
      if (!resultado.ok) {
        throw new Error('no se pudo registrar');
      }
      expect(await h.bitacoraDe(resultado.value.id)).toEqual(['DEVICE_REGISTERED']);

      await h.repo.revoke(resultado.value.id);
      await h.repo.revoke(resultado.value.id);
      expect(await h.bitacoraDe(resultado.value.id)).toEqual([
        'DEVICE_REGISTERED',
        'DEVICE_REVOKED',
      ]);
    });
  });
}
