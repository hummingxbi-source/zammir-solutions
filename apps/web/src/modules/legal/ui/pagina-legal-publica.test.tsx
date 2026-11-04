import { configure, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fixedClock,
  inMemoryAuditLog,
  inMemoryLegal,
  sequentialIdGenerator,
  type LegalDeps,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../../../App';
import { PaginaLegalPublica, type ContactoPublico } from './PaginaLegalPublica';

vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });

const AHORA = new Date('2026-11-03T18:00:00.000Z');

function entorno(): LegalDeps {
  const clock = fixedClock(AHORA);
  return {
    clock,
    legal: inMemoryLegal({
      clock,
      idGenerator: sequentialIdGenerator('l'),
      auditLog: inMemoryAuditLog(),
    }),
  };
}

const contacto =
  (c: Partial<ContactoPublico> = {}) =>
  () =>
    Promise.resolve<ContactoPublico | null>({
      name: 'ZAMMIR (prueba)',
      phone: '5500000000',
      address: null,
      ...c,
    });

function mostrar(deps: LegalDeps, tipo: 'PRIVACY_NOTICE' | 'TERMS', cargar = contacto()) {
  render(
    <MemoryRouter>
      <PaginaLegalPublica deps={deps} tipo={tipo} cargarContacto={cargar} />
    </MemoryRouter>,
  );
}

describe('página pública del aviso y los términos', () => {
  it('muestra la versión vigente con su fecha y el canal para ejercer derechos', async () => {
    const deps = entorno();
    await deps.legal.publish({
      type: 'PRIVACY_NOTICE',
      body: 'Texto viejo',
      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
    });
    await deps.legal.publish({
      type: 'PRIVACY_NOTICE',
      body: 'Texto vigente del aviso',
      effectiveFrom: new Date('2026-11-01T06:00:00.000Z'),
    });
    await deps.legal.publish({
      type: 'PRIVACY_NOTICE',
      body: 'Texto futuro',
      effectiveFrom: new Date('2027-01-01T06:00:00.000Z'),
    });
    mostrar(deps, 'PRIVACY_NOTICE');
    expect(await screen.findByRole('heading', { name: 'Aviso de privacidad' })).toBeTruthy();
    expect(await screen.findByText('Texto vigente del aviso')).toBeTruthy();
    expect(screen.queryByText('Texto viejo')).toBeNull();
    expect(screen.queryByText('Texto futuro')).toBeNull();
    expect(screen.getByText(/Versión 2 · vigente desde/)).toBeTruthy();
    expect(screen.getByText('ZAMMIR (prueba)')).toBeTruthy();
    expect(screen.getByText('Para ejercer tus derechos sobre tus datos')).toBeTruthy();
    expect(screen.getByText('Escríbenos por WhatsApp al 5500000000.')).toBeTruthy();
  });

  it('sin datos del negocio no inventa un canal: manda a preguntar al vendedor', async () => {
    const deps = entorno();
    await deps.legal.publish({ type: 'PRIVACY_NOTICE', body: 'Aviso', effectiveFrom: AHORA });
    mostrar(deps, 'PRIVACY_NOTICE', contacto({ name: null, phone: null }));
    expect(await screen.findByText('Aviso')).toBeTruthy();
    expect(
      screen.getByText('Pregunta a tu vendedor cómo comunicarte con el negocio.'),
    ).toBeTruthy();
    expect(screen.getByText('ZAMMIR')).toBeTruthy();
  });

  it('si el contacto no carga, el documento se lee igual', async () => {
    const deps = entorno();
    await deps.legal.publish({ type: 'TERMS', body: 'Anticipo del 50 %.', effectiveFrom: AHORA });
    mostrar(deps, 'TERMS', () => Promise.reject(new Error('sin red')));
    expect(await screen.findByRole('heading', { name: 'Términos del servicio' })).toBeTruthy();
    expect(await screen.findByText('Anticipo del 50 %.')).toBeTruthy();
  });

  it('sin documento publicado lo dice con amabilidad', async () => {
    mostrar(entorno(), 'TERMS');
    expect(
      await screen.findByText(
        'Todavía no hay términos del servicio publicados. Pídelos a tu vendedor.',
      ),
    ).toBeTruthy();
  });

  it('las rutas /aviso y /terminos de la aplicación se abren sin el marco ni entrar', async () => {
    const deps = entorno();
    await deps.legal.publish({
      type: 'PRIVACY_NOTICE',
      body: 'Aviso público',
      effectiveFrom: AHORA,
    });
    await deps.legal.publish({ type: 'TERMS', body: 'Términos públicos', effectiveFrom: AHORA });
    const { unmount } = render(
      <MemoryRouter initialEntries={['/aviso']}>
        <App legal={deps} contactoPublico={contacto()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Aviso público')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    unmount();
    render(
      <MemoryRouter initialEntries={['/terminos']}>
        <App legal={deps} contactoPublico={contacto()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Términos públicos')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
