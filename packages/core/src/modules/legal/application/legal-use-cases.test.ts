import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { currentVersion } from '../domain/legal-document';
import { inMemoryLegal } from './in-memory-legal';
import { getCurrentLegalDocument, publishLegalDocument } from './legal-use-cases';

function relojManual(): Clock & { avanzarDias: (dias: number) => void } {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  return {
    now: () => new Date(ahora),
    avanzarDias: (dias) => {
      ahora += dias * 86_400_000;
    },
  };
}

function entorno() {
  const clock = relojManual();
  const auditLog = inMemoryAuditLog();
  const legal = inMemoryLegal({ clock, idGenerator: sequentialIdGenerator('l'), auditLog });
  return { deps: { legal, clock }, clock, auditLog };
}

describe('publishLegalDocument', () => {
  it('un administrador publica una versión nueva con fecha de vigencia', async () => {
    const { deps, clock } = entorno();
    const r = await publishLegalDocument(
      deps,
      { role: 'ADMIN' },
      { type: 'PRIVACY_NOTICE', body: '  Texto  ' },
    );
    expect(r.ok && r.value).toMatchObject({
      type: 'PRIVACY_NOTICE',
      version: 1,
      body: 'Texto',
      effectiveFrom: clock.now(),
    });
  });

  it('editar es publicar otra versión: la anterior se conserva', async () => {
    const { deps } = entorno();
    await publishLegalDocument(
      deps,
      { role: 'ADMIN' },
      { type: 'PRIVACY_NOTICE', body: 'Primera' },
    );
    await publishLegalDocument(
      deps,
      { role: 'ADMIN' },
      { type: 'PRIVACY_NOTICE', body: 'Segunda' },
    );
    const lista = await deps.legal.list('PRIVACY_NOTICE');
    expect(lista.ok && lista.value.map((d) => [d.version, d.body])).toEqual([
      [1, 'Primera'],
      [2, 'Segunda'],
    ]);
  });

  it.each(['STAFF', 'DEVICE', null] as const)(
    '%s no puede editar el aviso ni los términos',
    async (role) => {
      const { deps, auditLog } = entorno();
      for (const type of ['PRIVACY_NOTICE', 'TERMS'] as const) {
        const r = await publishLegalDocument(deps, { role }, { type, body: 'Intento' });
        expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
      }
      const lista = await deps.legal.list('PRIVACY_NOTICE');
      expect(lista.ok && lista.value).toEqual([]);
      expect(auditLog.entries()).toEqual([]);
    },
  );

  it('un texto en blanco se rechaza', async () => {
    const { deps } = entorno();
    const r = await publishLegalDocument(deps, { role: 'ADMIN' }, { type: 'TERMS', body: '   ' });
    expect(!r.ok && r.error.code).toBe('BODY_REQUIRED');
  });
});

describe('getCurrentLegalDocument', () => {
  it('sin versiones no hay vigente', async () => {
    const { deps } = entorno();
    const r = await getCurrentLegalDocument(deps, 'PRIVACY_NOTICE');
    expect(!r.ok && r.error.code).toBe('NOT_FOUND');
  });

  it('devuelve la versión más nueva cuya vigencia ya empezó', async () => {
    const { deps, clock } = entorno();
    await publishLegalDocument(deps, { role: 'ADMIN' }, { type: 'PRIVACY_NOTICE', body: 'V1' });
    await publishLegalDocument(
      deps,
      { role: 'ADMIN' },
      {
        type: 'PRIVACY_NOTICE',
        body: 'V2 dentro de una semana',
        effectiveFrom: new Date(clock.now().getTime() + 7 * 86_400_000),
      },
    );
    const hoy = await getCurrentLegalDocument(deps, 'PRIVACY_NOTICE');
    expect(hoy.ok && hoy.value.body).toBe('V1');
    clock.avanzarDias(7);
    const luego = await getCurrentLegalDocument(deps, 'PRIVACY_NOTICE');
    expect(luego.ok && luego.value.body).toBe('V2 dentro de una semana');
  });
});

describe('currentVersion', () => {
  const v = (version: number, dia: number) => ({
    version,
    effectiveFrom: new Date(Date.UTC(2026, 9, dia)),
  });

  it('elige la versión más alta ya vigente, no la más reciente por fecha de captura', () => {
    const versiones = [v(1, 1), v(3, 20), v(2, 10)];
    expect(currentVersion(versiones, new Date(Date.UTC(2026, 9, 15)))?.version).toBe(2);
    expect(currentVersion(versiones, new Date(Date.UTC(2026, 9, 25)))?.version).toBe(3);
  });

  it('la vigencia empieza justo en su fecha y antes de la primera no hay vigente', () => {
    const versiones = [v(1, 10)];
    expect(currentVersion(versiones, new Date(Date.UTC(2026, 9, 10)))?.version).toBe(1);
    expect(currentVersion(versiones, new Date(Date.UTC(2026, 9, 9)))).toBeNull();
    expect(currentVersion([], new Date(0))).toBeNull();
  });
});
