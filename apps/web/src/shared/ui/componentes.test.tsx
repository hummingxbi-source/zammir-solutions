import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Aviso } from './Aviso';
import { Boton } from './Boton';
import { Campo, CampoNumerico } from './Campo';
import { Confirmacion } from './Confirmacion';

describe('Boton', () => {
  it('es de tipo button por defecto y usa la clase del sistema de diseño', () => {
    render(<Boton>Guardar</Boton>);
    const boton = screen.getByRole('button', { name: 'Guardar' });
    expect(boton).toHaveAttribute('type', 'button');
    expect(boton).toHaveClass('boton');
  });

  it.each([
    ['secundario', 'boton--secundario'],
    ['peligro', 'boton--peligro'],
  ] as const)('la variante %s agrega %s', (variante, clase) => {
    render(<Boton variante={variante}>Acción</Boton>);
    expect(screen.getByRole('button')).toHaveClass(clase);
  });

  it('respeta que se deshabilite', () => {
    render(<Boton disabled>Cobrar</Boton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Campo', () => {
  it('liga la etiqueta con la entrada', () => {
    render(<Campo etiqueta="Nombre" />);
    expect(screen.getByLabelText('Nombre')).toHaveClass('campo__entrada');
  });

  it('muestra el error y lo liga a la entrada', () => {
    render(<Campo etiqueta="WhatsApp" error="Escribe 10 dígitos" />);
    const entrada = screen.getByLabelText('WhatsApp');
    expect(entrada).toHaveAttribute('aria-invalid', 'true');
    expect(entrada).toHaveAccessibleDescription('Escribe 10 dígitos');
  });

  it('sin error no marca la entrada como inválida', () => {
    render(<Campo etiqueta="Nombre" error="" />);
    const entrada = screen.getByLabelText('Nombre');
    expect(entrada).toHaveAttribute('aria-invalid', 'false');
    expect(entrada).not.toHaveAttribute('aria-describedby');
  });
});

describe('CampoNumerico', () => {
  it('abre el teclado numérico con decimales por defecto', () => {
    render(<CampoNumerico etiqueta="Ancho" />);
    expect(screen.getByLabelText('Ancho')).toHaveAttribute('inputmode', 'decimal');
  });

  it('con entero abre el teclado numérico de enteros', () => {
    render(<CampoNumerico etiqueta="Cantidad" entero />);
    expect(screen.getByLabelText('Cantidad')).toHaveAttribute('inputmode', 'numeric');
  });
});

describe('Aviso', () => {
  it('un error se anuncia como alerta y dice qué hacer', () => {
    render(
      <Aviso tipo="error" queHacer="Revisa la conexión e intenta de nuevo">
        No se pudo enviar
      </Aviso>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo enviar');
    expect(screen.getByText('Revisa la conexión e intenta de nuevo')).toBeInTheDocument();
  });

  it('un éxito se anuncia como estado', () => {
    render(<Aviso tipo="exito">Guardado en la tablet</Aviso>);
    expect(screen.getByRole('status')).toHaveTextContent('Guardado en la tablet');
  });
});

describe('Confirmacion', () => {
  function mostrar(peligrosa: boolean): { onConfirmar: () => void; onCancelar: () => void } {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(
      <Confirmacion
        titulo="Cancelar la venta"
        mensaje="Esto no se puede deshacer."
        textoConfirmar="Sí, cancelar"
        textoCancelar="No, volver"
        peligrosa={peligrosa}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    );
    return { onConfirmar, onCancelar };
  }

  it('describe la acción y no ejecuta nada hasta confirmar', () => {
    const { onConfirmar, onCancelar } = mostrar(true);
    const dialogo = screen.getByRole('alertdialog', { name: 'Cancelar la venta' });
    expect(dialogo).toHaveAccessibleDescription('Esto no se puede deshacer.');
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(onCancelar).not.toHaveBeenCalled();
  });

  it('confirmar y cancelar llaman a su función', () => {
    const { onConfirmar, onCancelar } = mostrar(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'No, volver' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('una acción peligrosa se confirma con el botón de peligro', () => {
    mostrar(true);
    expect(screen.getByRole('button', { name: 'Sí, cancelar' })).toHaveClass('boton--peligro');
  });

  it('una acción normal se confirma con el botón primario', () => {
    mostrar(false);
    expect(screen.getByRole('button', { name: 'Sí, cancelar' })).not.toHaveClass('boton--peligro');
  });
});
