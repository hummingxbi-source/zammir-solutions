import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ContextoDeSeccion } from './ContextoDeSeccion';
import { EncabezadoDePagina } from './EncabezadoDePagina';
import { SECCIONES_CON_ILUSTRACION, tieneIlustracion } from './IlustracionDeSeccion';
import { SECCIONES } from '../../shell/secciones';

afterEach(cleanup);

describe('ilustración de cada sección', () => {
  it('cada sección del menú tiene su ilustración, y solo esas', () => {
    expect([...SECCIONES_CON_ILUSTRACION].sort()).toEqual(SECCIONES.map((s) => s.id).sort());
  });

  it('reconoce las secciones y descarta lo demás', () => {
    expect(tieneIlustracion('catalogo')).toBe(true);
    expect(tieneIlustracion('cuentas-por-cobrar')).toBe(true);
    expect(tieneIlustracion('inventada')).toBe(false);
    expect(tieneIlustracion(null)).toBe(false);
  });

  it('el encabezado de una sección lleva su ilustración, que no se lee en voz alta', () => {
    const { container } = render(
      <ContextoDeSeccion.Provider value="facturas">
        <EncabezadoDePagina titulo="Facturas" />
      </ContextoDeSeccion.Provider>,
    );
    const svg = container.querySelector('svg.pagina-encabezado__ilustracion');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('heading', { level: 1, name: 'Facturas' })).toBeTruthy();
  });

  it('sin sección, o con la opción de apagarla, no dibuja nada', () => {
    const fuera = render(<EncabezadoDePagina titulo="Suelto" />);
    expect(fuera.container.querySelector('svg')).toBeNull();
    cleanup();
    const apagada = render(
      <ContextoDeSeccion.Provider value="ordenes">
        <EncabezadoDePagina titulo="Detalle" sinIlustracion />
      </ContextoDeSeccion.Provider>,
    );
    expect(apagada.container.querySelector('svg')).toBeNull();
  });
});
