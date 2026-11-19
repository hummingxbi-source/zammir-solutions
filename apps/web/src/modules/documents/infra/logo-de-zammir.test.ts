import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cargarLogoDeZammir,
  negocioConLogo,
  olvidarLogoParaPruebas,
  RUTA_DEL_LOGO,
} from './logo-de-zammir';

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function respuesta(bytes: Uint8Array, ok = true): Response {
  return { ok, arrayBuffer: () => Promise.resolve(bytes.buffer) } as unknown as Response;
}

afterEach(() => {
  olvidarLogoParaPruebas();
});

describe('logo de ZAMMIR en los documentos', () => {
  it('baja el logo una sola vez y lo recuerda', async () => {
    const traer = vi.fn(() => Promise.resolve(respuesta(PNG)));
    const a = await cargarLogoDeZammir(traer);
    const b = await cargarLogoDeZammir(traer);
    expect(traer).toHaveBeenCalledTimes(1);
    expect(traer).toHaveBeenCalledWith(RUTA_DEL_LOGO);
    expect(a?.format).toBe('png');
    expect(Array.from(a?.bytes ?? [])).toEqual(Array.from(PNG));
    expect(b).toBe(a);
  });

  it('si no se puede bajar, el documento sale sin logo y se vuelve a intentar después', async () => {
    const traer = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin internet'))
      .mockResolvedValueOnce(respuesta(PNG));
    expect(await cargarLogoDeZammir(traer as unknown as typeof fetch)).toBeUndefined();
    expect(await cargarLogoDeZammir(traer as unknown as typeof fetch)).toBeDefined();
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('una respuesta con error o vacía no deja un logo roto', async () => {
    expect(await cargarLogoDeZammir(() => Promise.resolve(respuesta(PNG, false)))).toBeUndefined();
    expect(
      await cargarLogoDeZammir(() => Promise.resolve(respuesta(new Uint8Array()))),
    ).toBeUndefined();
  });

  it('agrega el logo a los datos del negocio sin tocar el resto', async () => {
    const negocio = { name: 'ZAMMIR', phone: null, address: null };
    const con = await negocioConLogo(negocio, () => Promise.resolve(respuesta(PNG)));
    expect(con.name).toBe('ZAMMIR');
    expect(con.logo?.format).toBe('png');
  });
});
