import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dona, GraficaDeColumnas, GraficaDeLinea, Sparkline } from './Graficas';
import { PanelDeIndicadores } from './PanelDeIndicadores';
import { Tarjeta } from './Tarjeta';

const pesos = (c: number): string => `$${String(c / 100)}`;

describe('Dona', () => {
  const datos = [
    { etiqueta: 'Efectivo', valor: 50, tono: 'exito' as const },
    { etiqueta: 'Transferencia', valor: 30, tono: 'acento' as const, nota: '3 cobros' },
    { etiqueta: 'Otros', valor: 20 },
  ];

  it('dibuja un arco por porción con su largo exacto y su inicio, con un hueco entre ellas', () => {
    const { container } = render(
      <Dona
        descripcion="Medios"
        datos={datos}
        formatear={String}
        centro={{ valor: '10', rotulo: 'cobros' }}
      />,
    );
    const arcos = [...container.querySelectorAll('circle.dona__arco')];
    expect(arcos.map((a) => a.getAttribute('stroke-dasharray'))).toEqual([
      '49.3 50.7',
      '29.3 70.7',
      '19.3 80.7',
    ]);
    expect(arcos.map((a) => a.getAttribute('stroke-dashoffset'))).toEqual(['0', '-50', '-80']);
    expect(arcos.map((a) => a.getAttribute('class'))).toEqual([
      'dona__arco dona__arco--exito',
      'dona__arco dona__arco--acento',
      'dona__arco dona__arco--exito',
    ]);
    expect(container.querySelector('circle.dona__pista')).not.toBeNull();
  });

  it('la leyenda dice en texto el valor y el porcentaje de cada porción, y la nota', () => {
    render(<Dona descripcion="Medios" datos={datos} formatear={String} />);
    const items = within(screen.getByRole('list', { name: 'Medios' })).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Efectivo50' + '50.0 %',
      'Transferencia3 cobros30' + '30.0 %',
      'Otros20' + '20.0 %',
    ]);
  });

  it('el centro lleva la cifra y su rótulo, y sin centro no hay hueco escrito', () => {
    const con = render(
      <Dona
        descripcion="d"
        datos={datos}
        formatear={String}
        centro={{ valor: '10', rotulo: 'cobros' }}
      />,
    );
    expect(con.container.querySelector('.dona__centro-valor')?.textContent).toBe('10');
    expect(con.container.querySelector('.dona__centro-rotulo')?.textContent).toBe('cobros');
    const sin = render(<Dona descripcion="d" datos={datos} formatear={String} />);
    expect(sin.container.querySelector('.dona__centro')).toBeNull();
  });

  it('con una sola porción no deja hueco y la cierra completa', () => {
    const { container } = render(
      <Dona
        descripcion="d"
        datos={[
          { etiqueta: 'A', valor: 7 },
          { etiqueta: 'B', valor: 0 },
        ]}
        formatear={String}
      />,
    );
    const arcos = container.querySelectorAll('circle.dona__arco');
    expect(arcos).toHaveLength(1);
    expect(arcos[0]?.getAttribute('stroke-dasharray')).toBe('100 0');
  });

  it('sin nada que repartir muestra el anillo vacío y la leyenda sin porcentajes', () => {
    const { container } = render(
      <Dona
        descripcion="d"
        datos={[
          { etiqueta: 'A', valor: 0 },
          { etiqueta: 'B', valor: 0 },
        ]}
        formatear={String}
      />,
    );
    expect(container.querySelectorAll('circle.dona__arco')).toHaveLength(0);
    expect(container.querySelector('.dona__porcentaje')).toBeNull();
    expect(container.querySelectorAll('.dona__item')).toHaveLength(2);
  });

  it('los colores por defecto siguen un orden fijo cuando el dato no trae tono', () => {
    const { container } = render(
      <Dona
        descripcion="d"
        formatear={String}
        datos={[
          { etiqueta: 'a', valor: 1 },
          { etiqueta: 'b', valor: 1 },
          { etiqueta: 'c', valor: 1 },
          { etiqueta: 'd', valor: 1 },
        ]}
      />,
    );
    expect(
      [...container.querySelectorAll('circle.dona__arco')].map((a) =>
        a.getAttribute('class')?.replace('dona__arco dona__arco--', ''),
      ),
    ).toEqual(['acento', 'laton', 'exito', 'aluminio']);
  });

  it('el dibujo no se lee: la leyenda y su descripción lo dicen todo', () => {
    const { container } = render(<Dona descripcion="Medios" datos={datos} formatear={String} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('figcaption')?.textContent).toBe('Medios');
  });
});

describe('Sparkline', () => {
  it('con menos de dos puntos no dibuja nada', () => {
    expect(render(<Sparkline puntos={[]} />).container.innerHTML).toBe('');
    expect(render(<Sparkline puntos={[5]} />).container.innerHTML).toBe('');
  });

  it('dibuja el trazo y el área, con su tono, y no se lee', () => {
    const { container } = render(<Sparkline puntos={[0, 10, 5]} tono="exito" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toBe('sparkline sparkline--exito');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.sparkline__trazo')?.getAttribute('d')).toBe(
      'M0.0 28.0 L50.0 0.0 L100.0 14.0',
    );
    expect(container.querySelector('.sparkline__area')?.getAttribute('d')).toBe(
      'M0.0 28.0 L50.0 0.0 L100.0 14.0 L100.0 28 L0.0 28 Z',
    );
  });

  it('el tono por defecto es el acento', () => {
    const { container } = render(<Sparkline puntos={[1, 2]} />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe(
      'sparkline sparkline--acento',
    );
  });
});

describe('GraficaDeColumnas', () => {
  it('escribe el valor arriba, el nombre abajo, y pone en el acento solo a la que más vale', () => {
    const { container } = render(
      <GraficaDeColumnas
        descripcion="Cobros"
        formatear={pesos}
        datos={[
          { etiqueta: 'Ana', valor: 20_000 },
          { etiqueta: 'Beto', valor: 10_000 },
          { etiqueta: 'Cris', valor: 0 },
        ]}
      />,
    );
    const lista = screen.getByRole('list', { name: 'Cobros' });
    expect(lista.getAttribute('style')).toContain('repeat(3, minmax(0, 1fr))');
    const cols = within(lista).getAllByRole('listitem');
    expect(cols.map((c) => c.textContent)).toEqual(['$200Ana', '$100Beto', '$0Cris']);
    const barras = [...container.querySelectorAll<HTMLElement>('.columnas__barra')];
    expect(barras.map((b) => b.style.blockSize)).toEqual(['100%', '50%', '0%']);
    expect(barras.map((b) => b.className)).toEqual([
      'columnas__barra barras__barra--acento',
      'columnas__barra barras__barra--aluminio',
      'columnas__barra barras__barra--aluminio',
    ]);
  });

  it('sin ventas nadie va en el acento y las barras quedan en cero', () => {
    const { container } = render(
      <GraficaDeColumnas descripcion="d" formatear={pesos} datos={[{ etiqueta: 'A', valor: 0 }]} />,
    );
    expect(container.querySelector<HTMLElement>('.columnas__barra')?.style.blockSize).toBe('0%');
    expect(container.querySelector('.barras__barra--acento')).toBeNull();
  });

  it('un tono propio del dato manda sobre el del líder', () => {
    const { container } = render(
      <GraficaDeColumnas
        descripcion="d"
        formatear={pesos}
        datos={[{ etiqueta: 'A', valor: 5, tono: 'peligro' }]}
      />,
    );
    expect(container.querySelector('.barras__barra--peligro')).not.toBeNull();
  });
});

describe('GraficaDeLinea con eje', () => {
  it('el eje usa el formato corto que se le pida y la base queda marcada', () => {
    const { container } = render(
      <GraficaDeLinea
        descripcion="Tendencia"
        formatear={pesos}
        formatearEje={(v) => `~${String(v)}`}
        puntos={[
          { etiqueta: 'a', valor: 0 },
          { etiqueta: 'b', valor: 100 },
        ]}
      />,
    );
    expect([...container.querySelectorAll('.linea__eje li')].map((l) => l.textContent)).toEqual([
      '~100',
      '~75',
      '~50',
      '~25',
      '~0',
    ]);
    expect(container.querySelectorAll('line.linea__guia')).toHaveLength(4);
    expect(container.querySelectorAll('line.linea__base')).toHaveLength(1);
    expect(container.querySelector('.linea__punto')).not.toBeNull();
  });

  it('sin puntos no marca el último punto ni deja un área', () => {
    const { container } = render(<GraficaDeLinea descripcion="v" formatear={pesos} puntos={[]} />);
    expect(container.querySelector('.linea__punto')).toBeNull();
    expect(container.querySelector('svg path[fill^="url"]')).toBeNull();
  });

  it('con tres o más puntos muestra la fecha del medio entre las de los extremos', () => {
    const { container } = render(
      <GraficaDeLinea
        descripcion="v"
        formatear={pesos}
        puntos={[
          { etiqueta: '1', valor: 1 },
          { etiqueta: '2', valor: 2 },
          { etiqueta: '3', valor: 3 },
          { etiqueta: '4', valor: 4 },
        ]}
      />,
    );
    expect(
      [...container.querySelectorAll('.linea__extremos span')].map((s) => s.textContent),
    ).toEqual(['1', '2', '4']);
  });
});

describe('PanelDeIndicadores', () => {
  it('cada cifra es un grupo con nombre, con su variación, detalle y ayuda', () => {
    render(
      <PanelDeIndicadores
        descripcion="Cifras clave"
        items={[
          {
            clave: 'hoy',
            rotulo: 'Hoy',
            valor: '$100.00',
            tono: 'exito',
            variacion: <span>Sube 10 %</span>,
            detalle: 'Ayer: $90.00',
            ayuda: <button type="button">?</button>,
          },
          { clave: 'otro', rotulo: 'Otro', valor: '$5.00' },
        ]}
      />,
    );
    const panel = screen.getByRole('region', { name: 'Cifras clave' });
    const hoy = within(within(panel).getByRole('group', { name: 'Hoy' }));
    expect(hoy.getByText('$100.00')).toBeTruthy();
    expect(hoy.getByText('Sube 10 %')).toBeTruthy();
    expect(hoy.getByText('Ayer: $90.00')).toBeTruthy();
    expect(hoy.getByRole('button', { name: '?' })).toBeTruthy();
    expect(within(panel).getByRole('group', { name: 'Hoy' }).className).toContain('--exito');
    const otro = within(panel).getByRole('group', { name: 'Otro' });
    expect(otro.className).toContain('--neutro');
    expect(otro.querySelector('.panel-kpi__variacion')).toBeNull();
    expect(otro.querySelector('.panel-kpi__detalle')).toBeNull();
    expect(otro.querySelector('.panel-kpi__tendencia')).toBeNull();
  });

  it('la variante compacta cambia solo la clase de la franja', () => {
    const normal = render(
      <PanelDeIndicadores descripcion="n" items={[{ clave: 'a', rotulo: 'A', valor: '1' }]} />,
    );
    expect(normal.container.querySelector('section')?.className).toBe('panel-kpi');
    const compacto = render(
      <PanelDeIndicadores
        compacto
        descripcion="c"
        items={[{ clave: 'a', rotulo: 'A', valor: '1' }]}
      />,
    );
    expect(compacto.container.querySelector('section')?.className).toBe(
      'panel-kpi panel-kpi--compacto',
    );
  });

  it('el rótulo y la cifra quedan juntos, y la ayuda va aparte', () => {
    const { container } = render(
      <PanelDeIndicadores
        descripcion="d"
        items={[{ clave: 'a', rotulo: 'A', valor: '1', ayuda: <button type="button">?</button> }]}
      />,
    );
    const dt = container.querySelector('dt');
    expect(dt?.nextElementSibling?.textContent).toBe('1');
    expect(container.querySelector('.panel-kpi__ayuda button')).not.toBeNull();
  });

  it('la mini-tendencia solo sale si se le dan puntos, y con el tono pedido', () => {
    const { container } = render(
      <PanelDeIndicadores
        descripcion="d"
        items={[
          { clave: 'a', rotulo: 'A', valor: '1', tendencia: [1, 2, 3], tonoDeTendencia: 'exito' },
          { clave: 'b', rotulo: 'B', valor: '2', tendencia: [1, 2] },
        ]}
      />,
    );
    const tonos = [...container.querySelectorAll('.panel-kpi__tendencia svg')].map((s) =>
      s.getAttribute('class'),
    );
    expect(tonos).toEqual(['sparkline sparkline--exito', 'sparkline sparkline--acento']);
  });
});

describe('Tarjeta con clase de rejilla', () => {
  it('agrega la clase pedida sin perder la suya, y sin clase no deja un espacio sobrante', () => {
    const con = render(
      <Tarjeta rotulo="A" clase="tablero-datos__ancho">
        x
      </Tarjeta>,
    );
    expect(con.container.querySelector('section')?.className).toBe('tarjeta tablero-datos__ancho');
    const panel = render(
      <Tarjeta variante="panel" clase="otra">
        x
      </Tarjeta>,
    );
    expect(panel.container.querySelector('section')?.className).toBe('tarjeta tarjeta--panel otra');
    const sin = render(<Tarjeta>x</Tarjeta>);
    expect(sin.container.querySelector('section')?.className).toBe('tarjeta');
  });
});
