import { describe, expect, it } from 'vitest';

import type { PinHasher } from '../application/user-ports';

/** Batería de contrato de PinHasher: la pasan el adaptador falso y el real (WebCrypto). */
export function pinHasherContract(nombre: string, crear: () => PinHasher, vueltas = 1000): void {
  describe(`contrato de PinHasher: ${nombre}`, () => {
    it('un PIN verifica contra su propio verificador', async () => {
      const hasher = crear();
      const verificador = await hasher.hash('482915', vueltas);
      expect(await hasher.verify('482915', verificador)).toBe(true);
    });

    it('un PIN distinto no verifica, ni uno parecido', async () => {
      const hasher = crear();
      const verificador = await hasher.hash('482915', vueltas);
      expect(await hasher.verify('482916', verificador)).toBe(false);
      expect(await hasher.verify('48291', verificador)).toBe(false);
      expect(await hasher.verify('4829150', verificador)).toBe(false);
      expect(await hasher.verify('', verificador)).toBe(false);
    });

    it('guarda las vueltas pedidas y una versión', async () => {
      const verificador = await crear().hash('482915', vueltas);
      expect(verificador.iterations).toBe(vueltas);
      expect(verificador.version).toBeGreaterThanOrEqual(1);
    });

    it('el mismo PIN en dos usuarios da verificadores distintos (sal propia)', async () => {
      const hasher = crear();
      const a = await hasher.hash('482915', vueltas);
      const b = await hasher.hash('482915', vueltas);
      expect(a.salt).not.toBe(b.salt);
      expect(a.hash).not.toBe(b.hash);
      expect(await hasher.verify('482915', a)).toBe(true);
      expect(await hasher.verify('482915', b)).toBe(true);
    });

    it('lo guardado no contiene el PIN en claro', async () => {
      const pin = '739104';
      const verificador = await crear().hash(pin, vueltas);
      for (const valor of Object.values(verificador)) {
        expect(String(valor)).not.toContain(pin);
      }
      expect(JSON.stringify(verificador)).not.toContain(pin);
    });

    it('un verificador alterado no verifica', async () => {
      const hasher = crear();
      const verificador = await hasher.hash('482915', vueltas);
      const otroHash = await hasher.hash('111222', vueltas);
      expect(await hasher.verify('482915', { ...verificador, hash: otroHash.hash })).toBe(false);
      expect(await hasher.verify('482915', { ...verificador, salt: otroHash.salt })).toBe(false);
      expect(await hasher.verify('482915', { ...verificador, iterations: vueltas + 1 })).toBe(
        false,
      );
    });
  });
}
