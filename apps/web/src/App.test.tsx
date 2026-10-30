import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('muestra el nombre del negocio', () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveTextContent('ZAMMIR');
  });
});
