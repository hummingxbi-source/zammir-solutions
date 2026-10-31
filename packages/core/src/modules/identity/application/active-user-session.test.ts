import { describe, expect, it, vi } from 'vitest';

import type { Clock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { createActiveUserSession } from './active-user-session';

const ana = { id: asId<'User'>('u-ana'), name: 'Ana', role: 'STAFF' as const };
const luis = { id: asId<'User'>('u-luis'), name: 'Luis', role: 'ADMIN' as const };

function entorno(minutos: number | null = 5) {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  const clock: Clock = { now: () => new Date(ahora) };
  return {
    sesion: createActiveUserSession(clock, () => minutos),
    avanzar: (segundos: number) => {
      ahora += segundos * 1000;
    },
  };
}

describe('ActiveUserSession', () => {
  it('nace bloqueada y sin persona activa', () => {
    const { sesion } = entorno();
    expect(sesion.state()).toEqual({ kind: 'LOCKED' });
    expect(sesion.actingUser()).toBeNull();
  });

  it('al entrar, las acciones se atribuyen a esa persona', () => {
    const { sesion } = entorno();
    sesion.enter(ana);
    expect(sesion.actingUser()).toEqual(ana);
  });

  it('la actividad renueva el tiempo: no bloquea mientras se use', () => {
    const { sesion, avanzar } = entorno();
    sesion.enter(ana);
    for (let i = 0; i < 4; i += 1) {
      avanzar(200);
      sesion.touch();
    }
    sesion.check();
    expect(sesion.actingUser()).toEqual(ana);
  });

  it('un segundo antes del límite no bloquea; al llegar al límite sí', () => {
    const { sesion, avanzar } = entorno(5);
    sesion.enter(ana);
    avanzar(299);
    sesion.check();
    expect(sesion.state().kind).toBe('ACTIVE');
    avanzar(1);
    sesion.check();
    expect(sesion.state()).toEqual({ kind: 'LOCKED' });
  });

  it('un toque después de pasado el tiempo no revive la sesión: bloquea', () => {
    const { sesion, avanzar } = entorno(5);
    sesion.enter(ana);
    avanzar(301);
    sesion.touch();
    expect(sesion.state()).toEqual({ kind: 'LOCKED' });
  });

  it('sin límite configurado no bloquea por inactividad', () => {
    const { sesion, avanzar } = entorno(null);
    sesion.enter(ana);
    avanzar(10 * 3600);
    sesion.check();
    expect(sesion.actingUser()).toEqual(ana);
  });

  it('cambiar de usuario vuelve a la pantalla de personas y conserva los borradores de cada quien', () => {
    const { sesion } = entorno();
    sesion.enter(ana);
    sesion.saveDraft(ana.id, 'cotizacion', { medidas: [800, 1200] });
    sesion.switchUser();
    expect(sesion.state()).toEqual({ kind: 'LOCKED' });
    sesion.enter(luis);
    expect(sesion.draft(luis.id, 'cotizacion')).toBeUndefined();
    sesion.switchUser();
    sesion.enter(ana);
    expect(sesion.draft(ana.id, 'cotizacion')).toEqual({ medidas: [800, 1200] });
  });

  it('el bloqueo por inactividad también conserva el borrador', () => {
    const { sesion, avanzar } = entorno(5);
    sesion.enter(ana);
    sesion.saveDraft(ana.id, 'cotizacion', 'a medias');
    avanzar(400);
    sesion.check();
    sesion.enter(ana);
    expect(sesion.draft(ana.id, 'cotizacion')).toBe('a medias');
  });

  it('avisa a quien escucha en cada cambio y deja de avisar al cancelar', () => {
    const { sesion } = entorno();
    const oyente = vi.fn();
    const cancelar = sesion.subscribe(oyente);
    sesion.enter(ana);
    sesion.switchUser();
    expect(oyente).toHaveBeenCalledTimes(2);
    cancelar();
    sesion.enter(ana);
    expect(oyente).toHaveBeenCalledTimes(2);
  });

  it('bloquear estando bloqueada no avisa de nada', () => {
    const { sesion } = entorno();
    const oyente = vi.fn();
    sesion.subscribe(oyente);
    sesion.switchUser();
    sesion.touch();
    sesion.check();
    expect(oyente).not.toHaveBeenCalled();
  });
});
