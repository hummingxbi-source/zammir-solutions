import { act, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Ayuda } from './Ayuda';
import { AvisoCerrable } from './AvisoCerrable';
import { EncabezadoDePagina } from './EncabezadoDePagina';
import { EstadoVacio } from './EstadoVacio';
import { EtiquetaDeEstado } from './EtiquetaDeEstado';
import { FlechaDeComparacion } from './FlechaDeComparacion';
import { GraficaDeBarras, GraficaDeLinea } from './Graficas';
import { Icono, iconoDeSeccion } from './Icono';
import { Indicador } from './Indicador';
import { Pestanas } from './Pestanas';
import { Tabla } from './Tabla';
import { Tarjeta } from './Tarjeta';
import { Ventana } from './Ventana';

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

const pesos = (n: number): string => '$' + String(n / 100);

/** El elemento que tiene el foco; falla si ninguno lo tiene. */
function enfocado(): Element {
  const activo = document.activeElement;
  if (activo === null) {
    throw new Error('Nada tiene el foco');
  }
  return activo;
}

function fondoDeLaVentana(raiz: HTMLElement): Element {
  const fondo = raiz.querySelector('.ventana__fondo');
  if (fondo === null) {
    throw new Error('No hay ventana abierta');
  }
  return fondo;
}

describe('Tarjeta', () => {
  it('con rótulo la región se nombra por él', () => {
    render(<Tarjeta rotulo="Ventas del día">contenido</Tarjeta>);
    expect(screen.getByRole('region', { name: 'Ventas del día' })).toBeTruthy();
  });

  it('sin rótulo no inventa nombre, y la variante panel cambia la clase', () => {
    const { container } = render(<Tarjeta variante="panel">algo</Tarjeta>);
    expect(container.querySelector('.tarjeta--panel')).not.toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('muestra las acciones junto al rótulo', () => {
    render(
      <Tarjeta rotulo="Corte" acciones={<button type="button">Imprimir</button>}>
        x
      </Tarjeta>,
    );
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeTruthy();
  });
});

describe('Indicador', () => {
  it('se lee como rótulo y cifra, con detalle y tono', () => {
    const { container } = render(
      <Indicador rotulo="Por cobrar" valor="$1,240.00" detalle="3 cuentas" tono="peligro" />,
    );
    expect(screen.getByText('Por cobrar').tagName).toBe('DT');
    expect(screen.getByText('$1,240.00').tagName).toBe('DD');
    expect(screen.getByText('3 cuentas')).toBeTruthy();
    expect(container.querySelector('.indicador--peligro')).not.toBeNull();
  });

  it('sin detalle no lo dibuja', () => {
    const { container } = render(<Indicador rotulo="A" valor="1" />);
    expect(container.querySelector('.indicador__detalle')).toBeNull();
    expect(container.querySelector('.indicador--neutro')).not.toBeNull();
  });
});

describe('EtiquetaDeEstado', () => {
  it('lleva siempre el texto y su punto no se lee', () => {
    const { container } = render(<EtiquetaDeEstado tono="proceso" texto="En proceso" />);
    expect(screen.getByText('En proceso')).toBeTruthy();
    expect(container.querySelector('.etiqueta-estado__punto')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(container.querySelector('.etiqueta-estado--proceso')).not.toBeNull();
  });
});

describe('Pestanas', () => {
  const lista = [
    { id: 'datos', texto: 'Datos' },
    { id: 'vista', texto: 'Vista previa' },
    { id: 'envio', texto: 'Envío' },
  ];

  function Montada(): ReturnType<typeof Pestanas> {
    const [activa, setActiva] = useState('datos');
    return (
      <Pestanas etiqueta="Cotización" pestanas={lista} activa={activa} onCambiar={setActiva} />
    );
  }

  it('marca la seleccionada y solo ella entra con Tab', () => {
    render(<Montada />);
    const datos = screen.getByRole('tab', { name: 'Datos' });
    expect(datos.getAttribute('aria-selected')).toBe('true');
    expect(datos.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'Vista previa' }).getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tablist', { name: 'Cotización' })).toBeTruthy();
  });

  it('las flechas, inicio y fin mueven la selección y el foco, dando la vuelta', () => {
    render(<Montada />);
    const datos = screen.getByRole('tab', { name: 'Datos' });
    datos.focus();
    fireEvent.keyDown(datos, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Vista previa' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Vista previa' }));
    fireEvent.keyDown(enfocado(), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Envío' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(enfocado(), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Datos' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(enfocado(), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Envío' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(enfocado(), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Datos' }).getAttribute('aria-selected')).toBe('true');
  });

  it('una tecla cualquiera no cambia nada, y tocar una pestaña la selecciona', () => {
    render(<Montada />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Datos' }), { key: 'a' });
    expect(screen.getByRole('tab', { name: 'Datos' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Envío' }));
    expect(screen.getByRole('tab', { name: 'Envío' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('Ventana', () => {
  function Abierta({ alCerrar = () => undefined }: { alCerrar?: () => void }) {
    return (
      <>
        <button type="button">Abrir</button>
        <Ventana
          titulo="Cancelar venta"
          onCerrar={alCerrar}
          acciones={
            <>
              <button type="button">Volver</button>
              <button type="button">Cancelar venta</button>
            </>
          }
        >
          <label>
            Motivo <input />
          </label>
        </Ventana>
      </>
    );
  }

  it('es un diálogo modal nombrado por su título y enfoca lo primero', () => {
    render(<Abierta />);
    const dialogo = screen.getByRole('dialog', { name: 'Cancelar venta' });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });

  it('Escape y tocar fuera la cierran; tocar dentro no', () => {
    const cerrar = vi.fn();
    const { container } = render(<Abierta alCerrar={cerrar} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(cerrar).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(cerrar).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(fondoDeLaVentana(container));
    expect(cerrar).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(cerrar).toHaveBeenCalledTimes(3);
  });

  it('Tab da la vuelta dentro de la ventana en ambos sentidos', () => {
    render(<Abierta />);
    const cerrar = screen.getByRole('button', { name: 'Cerrar' });
    const ultimo = screen.getByRole('button', { name: 'Cancelar venta' });
    ultimo.focus();
    fireEvent.keyDown(ultimo, { key: 'Tab' });
    expect(document.activeElement).toBe(cerrar);
    fireEvent.keyDown(cerrar, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
    // Tab en medio no se intercepta
    const campo = screen.getByLabelText('Motivo');
    campo.focus();
    const sinCancelar = fireEvent.keyDown(campo, { key: 'Tab' });
    expect(sinCancelar).toBe(true);
  });

  it('al cerrarse devuelve el foco a quien lo tenía', () => {
    function Con() {
      const [abierta, setAbierta] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setAbierta(true);
            }}
          >
            Abrir
          </button>
          {abierta ? (
            <Ventana
              titulo="Ayuda"
              onCerrar={() => {
                setAbierta(false);
              }}
            >
              texto
            </Ventana>
          ) : null}
        </>
      );
    }
    render(<Con />);
    const boton = screen.getByRole('button', { name: 'Abrir' });
    boton.focus();
    fireEvent.click(boton);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(boton);
  });
});

describe('Ayuda', () => {
  it('se abre con un toque, tiene nombre y se cierra con el mismo botón', () => {
    render(<Ayuda tema="ventas del día">Lo cobrado hoy.</Ayuda>);
    const boton = screen.getByRole('button', { name: 'Ayuda sobre ventas del día' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('note').textContent).toBe('Lo cobrado hoy.');
    expect(boton.getAttribute('aria-controls')).toBe(screen.getByRole('note').id);
    fireEvent.click(boton);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('Escape y tocar fuera la cierran; tocar dentro no', () => {
    render(
      <>
        <p>otra cosa</p>
        <Ayuda tema="x">texto</Ayuda>
      </>,
    );
    const boton = screen.getByRole('button');
    fireEvent.click(boton);
    fireEvent.pointerDown(screen.getByRole('note'));
    expect(screen.getByRole('note')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('note')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(boton);
    fireEvent.pointerDown(screen.getByText('otra cosa'));
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('AvisoCerrable', () => {
  it('se puede cerrar, no vuelve a salir en la sesión y su acción responde', () => {
    const ir = vi.fn();
    const { unmount } = render(
      <AvisoCerrable id="catalogo" accion={{ texto: 'Ir al Catálogo →', alTocar: ir }}>
        Revisa primero tu catálogo.
      </AvisoCerrable>,
    );
    expect(screen.getByRole('status').textContent).toContain('Revisa primero tu catálogo.');
    fireEvent.click(screen.getByRole('button', { name: 'Ir al Catálogo →' }));
    expect(ir).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar este aviso' }));
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    render(<AvisoCerrable id="catalogo">Revisa primero tu catálogo.</AvisoCerrable>);
    expect(screen.queryByRole('status')).toBeNull();
    // otro aviso distinto sí sale
    render(<AvisoCerrable id="otro">Otro.</AvisoCerrable>);
    expect(screen.getByText('Otro.')).toBeTruthy();
  });

  it('sin almacenamiento disponible sigue funcionando', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    render(
      <AvisoCerrable id="x" tono="aviso">
        Aviso.
      </AvisoCerrable>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar este aviso' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('EstadoVacio', () => {
  it('dice qué es, por qué y qué hacer', () => {
    render(
      <EstadoVacio titulo="Sin cotizaciones" descripcion="Haz la primera desde el Cotizador.">
        <button type="button">Ir al Cotizador</button>
      </EstadoVacio>,
    );
    expect(screen.getByText('Sin cotizaciones')).toBeTruthy();
    expect(screen.getByText('Haz la primera desde el Cotizador.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ir al Cotizador' })).toBeTruthy();
  });

  it('sin acción no deja un hueco', () => {
    const { container } = render(<EstadoVacio titulo="A" descripcion="B" />);
    expect(container.querySelector('.estado-vacio__accion')).toBeNull();
  });
});

describe('Tabla', () => {
  interface Fila {
    id: string;
    cliente: string;
    saldo: number;
    atrasada: boolean;
  }
  const filas: Fila[] = [
    { id: '1', cliente: 'Ana', saldo: 10_000, atrasada: true },
    { id: '2', cliente: 'Beto', saldo: 500, atrasada: false },
  ];
  const columnas = [
    { clave: 'cliente', rotulo: 'Cliente', celda: (f: Fila) => f.cliente },
    { clave: 'saldo', rotulo: 'Saldo', numerica: true, celda: (f: Fila) => pesos(f.saldo) },
  ];

  it('la primera columna es el encabezado de la fila y las demás llevan su rótulo', () => {
    render(
      <Tabla
        descripcion="Cuentas"
        columnas={columnas}
        filas={filas}
        claveDeFila={(f) => f.id}
        resaltada={(f) => f.atrasada}
      />,
    );
    const tabla = screen.getByRole('table', { name: 'Cuentas' });
    expect(tabla.className).toContain('tabla--apilada');
    const ana = within(tabla).getByRole('rowheader', { name: 'Ana' });
    expect(ana.getAttribute('scope')).toBe('row');
    const celda = within(tabla).getByText('$100');
    expect(celda.getAttribute('data-label')).toBe('Saldo');
    expect(celda.className).toBe('tabla__num');
    expect(within(tabla).getAllByRole('columnheader')).toHaveLength(2);
    const filasDom = within(tabla).getAllByRole('row').slice(1);
    expect(filasDom[0]?.className).toBe('fila--atrasada');
    expect(filasDom[1]?.className).toBe('');
  });

  it('sin filas dibuja solo el encabezado', () => {
    render(
      <Tabla descripcion="Vacía" columnas={columnas} filas={[]} claveDeFila={(f: Fila) => f.id} />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});

describe('FlechaDeComparacion', () => {
  const tonoDe = (c: HTMLElement): string => c.querySelector('.comparacion')?.className ?? '';

  it('subir en ventas es bueno y bajar es malo; igual es neutro', () => {
    const a = render(<FlechaDeComparacion tendencia="UP" texto="Sube 12.50 %" />);
    expect(tonoDe(a.container)).toContain('comparacion--exito');
    expect(a.container.querySelector('svg')).not.toBeNull();
    const b = render(<FlechaDeComparacion tendencia="DOWN" texto="Baja 5.00 %" />);
    expect(tonoDe(b.container)).toContain('comparacion--peligro');
    const c = render(<FlechaDeComparacion tendencia="SAME" texto="Igual" />);
    expect(tonoDe(c.container)).toContain('comparacion--neutro');
    expect(c.container.querySelector('svg')).not.toBeNull();
  });

  it('en un gasto, bajar es bueno y subir es malo', () => {
    const a = render(<FlechaDeComparacion tendencia="DOWN" buena="baja" texto="Baja" />);
    expect(tonoDe(a.container)).toContain('comparacion--exito');
    const b = render(<FlechaDeComparacion tendencia="UP" buena="baja" texto="Sube" />);
    expect(tonoDe(b.container)).toContain('comparacion--peligro');
  });

  it('sin periodo anterior no hay flecha, solo el texto', () => {
    const { container } = render(
      <FlechaDeComparacion tendencia="NO_BASELINE" texto="Sin ventas para comparar" />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('Sin ventas para comparar')).toBeTruthy();
    expect(tonoDe(container)).toContain('comparacion--neutro');
  });
});

describe('Gráficas', () => {
  it('las barras dicen su valor en texto y su largo es proporcional al mayor', () => {
    const { container } = render(
      <GraficaDeBarras
        descripcion="Cobros por persona"
        formatear={pesos}
        datos={[
          { etiqueta: 'Ana', valor: 20_000 },
          { etiqueta: 'Beto', valor: 5_000, tono: 'laton' },
        ]}
      />,
    );
    expect(screen.getByRole('list', { name: 'Cobros por persona' })).toBeTruthy();
    expect(screen.getByText('$200')).toBeTruthy();
    expect(screen.getByText('$50')).toBeTruthy();
    const barras = [...container.querySelectorAll<HTMLElement>('.barras__barra')];
    expect(barras.map((b) => b.style.inlineSize)).toEqual(['100%', '25%']);
    expect(barras[1]?.className).toContain('barras__barra--laton');
    expect(container.querySelector('.barras__pista')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('con todo en cero las barras miden cero (sin dividir entre cero)', () => {
    const { container } = render(
      <GraficaDeBarras descripcion="x" formatear={pesos} datos={[{ etiqueta: 'A', valor: 0 }]} />,
    );
    expect(container.querySelector<HTMLElement>('.barras__barra')?.style.inlineSize).toBe('0%');
  });

  it('la línea trae su tabla equivalente, el máximo y las fechas de los extremos', () => {
    const { container } = render(
      <GraficaDeLinea
        descripcion="Ventas de los últimos días"
        formatear={pesos}
        puntos={[
          { etiqueta: '01/11', valor: 10_000 },
          { etiqueta: '02/11', valor: 30_000 },
          { etiqueta: '03/11', valor: 20_000 },
        ]}
      />,
    );
    const tabla = screen.getByRole('table', { name: 'Ventas de los últimos días' });
    expect(within(tabla).getAllByRole('row')).toHaveLength(3);
    expect(within(tabla).getByText('$300')).toBeTruthy();
    expect(screen.getByText('Máximo $300')).toBeTruthy();
    const trazo = container.querySelector('.linea__trazo')?.getAttribute('d') ?? '';
    expect(trazo.startsWith('M')).toBe(true);
    expect(trazo.match(/L/g)).toHaveLength(2);
    expect(container.querySelector('.linea__extremos')?.textContent).toBe('01/1102/1103/11');
    // El eje trae números redondos de abajo hacia arriba y la base del dibujo
    expect([...container.querySelectorAll('.linea__eje li')].map((li) => li.textContent)).toEqual([
      '$320',
      '$240',
      '$160',
      '$80',
      '$0',
    ]);
    expect(container.querySelector('.linea__cuerpo')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('una línea sin puntos o con uno solo no truena', () => {
    const vacia = render(<GraficaDeLinea descripcion="v" formatear={pesos} puntos={[]} />);
    expect(vacia.container.querySelector('.linea__trazo')?.getAttribute('d')).toBe('');
    expect(vacia.container.querySelector('.linea__extremos')).toBeNull();
    const uno = render(
      <GraficaDeLinea descripcion="u" formatear={pesos} puntos={[{ etiqueta: 'a', valor: 0 }]} />,
    );
    expect(uno.container.querySelector('.linea__trazo')?.getAttribute('d')).toMatch(
      /^M300\.0 200\.0$/,
    );
  });
});

describe('EncabezadoDePagina', () => {
  it('es el único h1 y trae rótulo, descripción y acciones', () => {
    render(
      <EncabezadoDePagina
        rotulo="Orden OT-2026-0003"
        titulo="Cancel de baño"
        descripcion="Entrega estimada el 20 de noviembre."
        acciones={<button type="button">Avanzar</button>}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Orden OT-2026-0003')).toBeTruthy();
    expect(screen.getByText('Entrega estimada el 20 de noviembre.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Avanzar' })).toBeTruthy();
  });

  it('solo con título no dibuja nada más', () => {
    const { container } = render(<EncabezadoDePagina titulo="Reportes" />);
    expect(container.querySelector('.pagina-encabezado__descripcion')).toBeNull();
    expect(container.querySelector('.pagina-encabezado__acciones')).toBeNull();
    expect(container.querySelector('.pagina-encabezado__rotulo')).toBeNull();
  });
});

describe('Icono', () => {
  it('es decorativo: oculto a los lectores y sin foco', () => {
    const { container } = render(<Icono nombre="cotizador" tamano={24} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.getAttribute('width')).toBe('24');
  });

  it('cada sección tiene su ícono y lo desconocido cae en inicio', () => {
    expect(iconoDeSeccion('cuentas-por-cobrar')).toBe('cuentas');
    expect(iconoDeSeccion('catalogo')).toBe('catalogo');
    expect(iconoDeSeccion('nada')).toBe('inicio');
  });
});

describe('accesibilidad automática de los componentes juntos', () => {
  it('no hay violaciones estructurales (el contraste se mide en el navegador, no en jsdom)', async () => {
    const { container } = render(
      <main>
        <EncabezadoDePagina titulo="Muestra" descripcion="Todos los componentes" />
        <Tarjeta rotulo="Ventas" acciones={<Ayuda tema="ventas">Lo cobrado.</Ayuda>}>
          <Indicador rotulo="Hoy" valor="$10.00" detalle="1 venta" />
          <EtiquetaDeEstado tono="listo" texto="Listo" />
          <FlechaDeComparacion tendencia="UP" texto="Sube 5.00 %" />
        </Tarjeta>
        <Pestanas
          etiqueta="Vistas"
          pestanas={[
            { id: 'a', texto: 'A' },
            { id: 'b', texto: 'B' },
          ]}
          activa="a"
          onCambiar={() => undefined}
        />
        <AvisoCerrable id="axe">Aviso.</AvisoCerrable>
        <EstadoVacio titulo="Vacío" descripcion="Nada todavía." />
        <GraficaDeBarras
          descripcion="Barras"
          formatear={pesos}
          datos={[{ etiqueta: 'A', valor: 1 }]}
        />
        <GraficaDeLinea
          descripcion="Línea"
          formatear={pesos}
          puntos={[
            { etiqueta: '1', valor: 1 },
            { etiqueta: '2', valor: 2 },
          ]}
        />
        <Tabla
          descripcion="Tabla"
          columnas={[
            { clave: 'a', rotulo: 'A', celda: (f: { a: string; b: string }) => f.a },
            { clave: 'b', rotulo: 'B', celda: (f: { a: string; b: string }) => f.b },
          ]}
          filas={[{ a: 'x', b: 'y' }]}
          claveDeFila={(f) => f.a}
        />
      </main>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const resultado = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
