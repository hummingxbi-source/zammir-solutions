import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LENGTH,
  buildErrorReport,
  fingerprintOf,
  parseErrorReport,
  scrubRoute,
  scrubText,
} from './error-report';

describe('scrubText', () => {
  it.each([
    ['Falló para ana.lopez@ejemplo.invalid al guardar', 'ana.lopez@ejemplo.invalid', '[correo]'],
    ['Llamar al 593 123 4567', '593 123 4567', '[número]'],
    ['Llamar al +52 (595) 123-4567', '(595) 123-4567', '[número]'],
    ['RFC XAXX010101000 inválido', 'XAXX010101000', '[rfc]'],
    ['RFC de persona moral ABC010101AB1', 'ABC010101AB1', '[rfc]'],
    ['CURP GOMA800101HDFRRN09 no existe', 'GOMA800101HDFRRN09', '[curp]'],
    [
      'sesión eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk roto',
      'eyJhbGciOiJIUzI1NiJ9',
      '[token]',
    ],
    ['password: hunter2hunter2', 'hunter2hunter2', '[secreto]'],
    ['Bearer abc123xyz', 'abc123xyz', '[secreto]'],
    ['pin=4821', '4821', '[secreto]'],
    ['id 5c000000-0000-4000-8000-000000000001 repetido', '5c000000', '[id]'],
  ])('%s', (texto, dato, marca) => {
    const limpio = scrubText(texto);
    expect(limpio).not.toContain(dato);
    expect(limpio).toContain(marca);
  });

  it('quita la consulta y el fragmento de una dirección y conserva el sitio y la ruta', () => {
    expect(
      scrubText('GET https://x.invalid/factura?folio=V-2026-0001&codigo=ABCD#frag falló'),
    ).toBe('GET https://x.invalid/factura falló');
    expect(scrubText('en /factura?codigo=ABCD')).toBe('en /factura');
  });

  it('no toca números chicos como las posiciones de la pila', () => {
    expect(scrubText('at f (assets/index.js:123:45)')).toBe('at f (assets/index.js:123:45)');
  });

  it('un texto sin datos personales queda igual', () => {
    expect(scrubText('No se pudo guardar la cotización')).toBe('No se pudo guardar la cotización');
  });

  it('nunca deja pasar un correo, sin importar lo que lo rodee', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.stringMatching(/^[a-z0-9]{3,10}$/),
        fc.stringMatching(/^[a-z]{3,8}$/),
        fc.string({ maxLength: 20 }),
        (antes, usuario, dominio, despues) => {
          const correo = `${usuario}@${dominio}.com`;
          expect(scrubText(`${antes} ${correo} ${despues}`)).not.toContain(correo);
        },
      ),
    );
  });
});

describe('scrubRoute', () => {
  it('deja solo la ruta', () => {
    expect(scrubRoute('/factura?folio=V-2026-0001#x')).toBe('/factura');
    expect(scrubRoute('https://zammir.invalid/clientes?q=ana')).toBe('/clientes');
  });
  it('cambia identificadores y folios por :id', () => {
    expect(scrubRoute('/clientes/5c000000-0000-4000-8000-000000000001')).toBe('/clientes/:id');
    expect(scrubRoute('/ordenes/OT-2026-0007')).toBe('/ordenes/:id');
    expect(scrubRoute('/clientes/123456/ficha')).toBe('/clientes/:id/ficha');
  });
  it('una ruta vacía es la raíz y una larga se acota', () => {
    expect(scrubRoute('')).toBe('/');
    expect(scrubRoute(`/${'a'.repeat(500)}`).length).toBeLessThanOrEqual(200);
  });
});

describe('buildErrorReport', () => {
  it('toma nombre, mensaje y pila de un Error y los limpia', () => {
    const e = new TypeError('Falló para ana@ejemplo.invalid');
    const r = buildErrorReport({
      source: 'CLIENT',
      error: e,
      route: '/x?a=1',
      appVersion: '1.2.3',
    });
    expect(r).toMatchObject({
      source: 'CLIENT',
      name: 'TypeError',
      route: '/x',
      appVersion: '1.2.3',
    });
    expect(r.message).toBe('Falló para [correo]');
    expect(r.stack).not.toContain('ana@ejemplo.invalid');
  });
  it('acepta un texto lanzado y cualquier otro valor sin copiarlo', () => {
    expect(buildErrorReport({ source: 'SERVER', error: 'boom' }).message).toBe('boom');
    const raro = buildErrorReport({
      source: 'SERVER',
      error: { nombre: 'Ana López', rfc: 'XAXX010101000' },
    });
    expect(JSON.stringify(raro)).not.toContain('Ana');
    expect(JSON.stringify(raro)).not.toContain('XAXX');
    expect(raro.appVersion).toBe('desconocida');
    expect(raro.route).toBe('/');
  });
  it('acota el tamaño del mensaje y de la pila', () => {
    const e = new Error('palabra '.repeat(1000));
    e.stack = 'at f '.repeat(2000);
    const r = buildErrorReport({ source: 'CLIENT', error: e });
    expect(r.message.length).toBe(MAX_MESSAGE_LENGTH);
    expect(r.stack.length).toBe(MAX_STACK_LENGTH);
  });
  it('una versión vacía cuenta como desconocida', () => {
    expect(buildErrorReport({ source: 'CLIENT', error: 'x', appVersion: '' }).appVersion).toBe(
      'desconocida',
    );
  });
  it('no incluye la causa del error', () => {
    const e = new Error('visible', { cause: new Error('ana@ejemplo.invalid') });
    expect(JSON.stringify(buildErrorReport({ source: 'CLIENT', error: e }))).not.toContain('ana@');
  });
});

describe('parseErrorReport', () => {
  const bueno = {
    source: 'CLIENT',
    name: 'Error',
    message: 'Falló para ana@ejemplo.invalid',
    stack: 'Error\n at f',
    route: '/x?q=ana',
    appVersion: '1',
  };
  it('vuelve a limpiar lo que llega por la red', () => {
    const r = parseErrorReport(bueno);
    expect(r?.message).toBe('Falló para [correo]');
    expect(r?.route).toBe('/x');
  });
  it('rellena lo que falta y rechaza lo que no tiene forma', () => {
    expect(parseErrorReport({ source: 'SERVER', name: 'E', message: 'm' })).toMatchObject({
      stack: '',
      route: '/',
      appVersion: 'desconocida',
    });
    expect(parseErrorReport(null)).toBeNull();
    expect(parseErrorReport('x')).toBeNull();
    expect(parseErrorReport({ ...bueno, source: 'OTRO' })).toBeNull();
    expect(parseErrorReport({ ...bueno, name: 3 })).toBeNull();
    expect(parseErrorReport({ ...bueno, message: undefined })).toBeNull();
  });
});

describe('fingerprintOf', () => {
  it('el mismo error da la misma huella y uno distinto otra', () => {
    const crear = (m: string) => buildErrorReport({ source: 'CLIENT', error: new Error(m) });
    const a = crear('uno');
    const b = crear('uno');
    const c = crear('dos');
    expect(fingerprintOf(a)).toBe(fingerprintOf(b));
    expect(fingerprintOf(a)).not.toBe(fingerprintOf(c));
  });
});

describe('scrubText, resultados exactos', () => {
  it.each([
    [
      'sesión eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc-DEF_123 fin',
      'sesión [token] fin',
    ],
    ['de a@mail.ejemplo.com.mx fin', 'de [correo] fin'],
    ['password = hunter2 fin', 'password = [secreto] fin'],
    ['token    abc123 fin', 'token    [secreto] fin'],
    ['pin=4821', 'pin=[secreto]'],
    ['clave: ab', 'clave: [secreto]'],
    ['GET https://x.invalid/factura?folio=1 falló', 'GET https://x.invalid/factura falló'],
    ['GET http://x.invalid/factura?folio=1 falló', 'GET http://x.invalid/factura falló'],
    ['en /a/b#frag y', 'en /a/b y'],
    ['Llamar 5931234567 ya', 'Llamar [número] ya'],
    ['Llamar +525931234567 ya', 'Llamar [número] ya'],
    ['ref abcdefghijklmnopqrstuvwxyz012345 fin', 'ref [secreto] fin'],
    ['ref abcdefghijklmnopqrstuvwxyz01234 fin', 'ref abcdefghijklmnopqrstuvwxyz01234 fin'],
    ['id 5C000000-0000-4000-8000-000000000001 fin', 'id [id] fin'],
  ])('%s', (texto, esperado) => {
    expect(scrubText(texto)).toBe(esperado);
  });
});

describe('scrubRoute, resultados exactos', () => {
  it('quita el sitio solo al principio, con http o https', () => {
    expect(scrubRoute('https://a.invalid/x')).toBe('/x');
    expect(scrubRoute('http://a.invalid/x')).toBe('/x');
    expect(scrubRoute('/ir/https://a.invalid')).toBe('/ir/https://a.invalid');
  });
  it('solo cambia por :id el segmento completo', () => {
    expect(scrubRoute('/x/abc12345')).toBe('/x/abc12345');
    expect(scrubRoute('/x/12345abc')).toBe('/x/12345abc');
    expect(scrubRoute('/x/123')).toBe('/x/123');
    expect(scrubRoute('/x/12345')).toBe('/x/:id');
  });
  it('acota a 200 caracteres exactos', () => {
    expect(scrubRoute(`/${'ab/'.repeat(300)}`).length).toBe(200);
  });
});

describe('buildErrorReport, resultados exactos', () => {
  it('un texto lanzado y un valor raro dan nombre Error y pila vacía', () => {
    expect(buildErrorReport({ source: 'CLIENT', error: 'boom' })).toMatchObject({
      name: 'Error',
      message: 'boom',
      stack: '',
    });
    expect(buildErrorReport({ source: 'CLIENT', error: 42 })).toMatchObject({
      name: 'Error',
      message: 'Se lanzó un valor que no es un error',
      stack: '',
    });
  });
  it('un Error sin pila queda con pila vacía', () => {
    const e = new Error('x');
    delete e.stack;
    expect(buildErrorReport({ source: 'CLIENT', error: e }).stack).toBe('');
  });
  it('un mensaje de exactamente 500 caracteres no se recorta y uno de 501 sí', () => {
    const justo = 'abcd '.repeat(100);
    expect(buildErrorReport({ source: 'CLIENT', error: justo }).message).toBe(justo);
    const largo = buildErrorReport({ source: 'CLIENT', error: `${justo}x` }).message;
    expect(largo.length).toBe(500);
    expect(largo.endsWith('…')).toBe(true);
  });
  it('sin ruta es la raíz', () => {
    expect(buildErrorReport({ source: 'CLIENT', error: 'x' }).route).toBe('/');
    expect(parseErrorReport({ source: 'CLIENT', name: 'E', message: 'm', route: '' })?.route).toBe(
      '/',
    );
  });
});

describe('fingerprintOf, resultados exactos', () => {
  const base = {
    source: 'CLIENT',
    name: 'Error',
    message: 'm',
    route: '/',
    appVersion: '1',
  } as const;
  it('usa nombre, mensaje y el segundo renglón de la pila sin espacios sobrantes', () => {
    expect(fingerprintOf({ ...base, stack: 'Error\n   at f  ' })).toBe('Error|m|at f');
    expect(fingerprintOf({ ...base, stack: '' })).toBe('Error|m|');
  });
  it('solo cuenta los primeros 120 caracteres del mensaje', () => {
    const a = fingerprintOf({ ...base, message: 'x'.repeat(120) + 'a', stack: '' });
    const b = fingerprintOf({ ...base, message: 'x'.repeat(120) + 'b', stack: '' });
    expect(a).toBe(b);
  });
});
