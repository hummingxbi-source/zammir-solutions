import { describe, expect, it } from 'vitest';

import type { ErrorReport } from '../domain/error-report';
import { createErrorReporter } from './error-reporter';

function montar(opciones: { falla?: boolean; maxReports?: number } = {}) {
  const enviados: ErrorReport[] = [];
  const reportero = createErrorReporter({
    source: 'CLIENT',
    appVersion: '1.0.0',
    ...(opciones.maxReports === undefined ? {} : { maxReports: opciones.maxReports }),
    send: (r) => {
      if (opciones.falla === true) {
        return Promise.reject(new Error('sin red'));
      }
      enviados.push(r);
      return Promise.resolve();
    },
  });
  return { reportero, enviados };
}

describe('reportero de errores', () => {
  it('envía el error limpio y con la versión', async () => {
    const { reportero, enviados } = montar();
    expect(await reportero.report(new Error('Falló para ana@ejemplo.invalid'), '/x?q=1')).toBe(
      true,
    );
    expect(enviados[0]).toMatchObject({
      source: 'CLIENT',
      message: 'Falló para [correo]',
      route: '/x',
      appVersion: '1.0.0',
    });
  });
  it('no repite el mismo error', async () => {
    const { reportero, enviados } = montar();
    const igual = () => new Error('igual');
    await reportero.report(igual());
    expect(await reportero.report(igual())).toBe(false);
    expect(enviados).toHaveLength(1);
  });
  it('respeta el tope de reportes distintos por sesión', async () => {
    const { reportero, enviados } = montar({ maxReports: 2 });
    await reportero.report(new Error('a'));
    await reportero.report(new Error('b'));
    expect(await reportero.report(new Error('c'))).toBe(false);
    expect(enviados).toHaveLength(2);
  });
  it('con el tope por omisión deja pasar 10', async () => {
    const { reportero, enviados } = montar();
    for (let i = 0; i < 12; i++) {
      await reportero.report(new Error(`e${String(i)}`));
    }
    expect(enviados).toHaveLength(10);
  });
  it('si el envío falla no lanza', async () => {
    const { reportero } = montar({ falla: true });
    expect(await reportero.report(new Error('x'))).toBe(false);
  });
});
