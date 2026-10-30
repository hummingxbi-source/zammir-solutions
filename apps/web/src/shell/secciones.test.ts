import { describe, expect, it } from 'vitest';

import { SECCIONES, seccionesVisibles, type Interruptor, type Seccion } from './secciones';

const apagados: ReadonlySet<Interruptor> = new Set();

const conInterruptores: readonly Seccion[] = [
  ...SECCIONES,
  {
    id: 'seguimiento',
    ruta: '/seguimiento',
    texto: 'Seguimiento',
    grupo: 'principal',
    interruptor: 'P1',
  },
  {
    id: 'existencias',
    ruta: '/existencias',
    texto: 'Existencias',
    grupo: 'secundaria',
    interruptor: 'P2',
  },
];

describe('seccionesVisibles', () => {
  it('con P1 y P2 apagados no aparece ninguna sección con interruptor', () => {
    const principal = seccionesVisibles('principal', apagados, conInterruptores).map((x) => x.id);
    const secundaria = seccionesVisibles('secundaria', apagados, conInterruptores).map((x) => x.id);
    expect(principal).not.toContain('seguimiento');
    expect(secundaria).not.toContain('existencias');
  });

  it('con el interruptor encendido la sección sí aparece, y solo esa', () => {
    const p1 = new Set<Interruptor>(['P1']);
    expect(seccionesVisibles('principal', p1, conInterruptores).map((x) => x.id)).toContain(
      'seguimiento',
    );
    expect(seccionesVisibles('secundaria', p1, conInterruptores).map((x) => x.id)).not.toContain(
      'existencias',
    );
  });

  it('el orden de las principales es el real del trabajo [RF-UX-01]', () => {
    expect(seccionesVisibles('principal', apagados).map((x) => x.id)).toEqual([
      'catalogo',
      'cotizador',
      'ordenes',
      'mostrador',
      'reportes',
    ]);
  });
});
