import { Component } from 'react';
import type { ReactNode } from 'react';

import { textos } from '../i18n/textos';
import { Aviso } from './Aviso';
import { Boton } from './Boton';

export interface LimiteDeErroresProps {
  readonly children: ReactNode;
  /** Avisa del error al registro (sin datos personales: el reportero limpia todo) [RNF-34]. */
  readonly alError: (error: unknown) => void;
  /** Solo cambia en las pruebas. */
  readonly recargar?: () => void;
}

interface Estado {
  readonly fallo: boolean;
}

/** Si una pantalla se rompe, en vez de quedar en blanco dice qué hacer y registra el error sin datos personales. */
export class LimiteDeErrores extends Component<LimiteDeErroresProps, Estado> {
  override state: Estado = { fallo: false };

  static getDerivedStateFromError(): Estado {
    return { fallo: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.alError(error);
  }

  override render(): ReactNode {
    if (!this.state.fallo) {
      return this.props.children;
    }
    const t = textos.falla;
    return (
      <main style={{ padding: '1rem' }}>
        <Aviso tipo="error" queHacer={t.queHacer}>
          {t.mensaje}
        </Aviso>
        <Boton
          onClick={() => {
            (
              this.props.recargar ??
              (() => {
                window.location.reload();
              })
            )();
          }}
        >
          {t.recargar}
        </Boton>
      </main>
    );
  }
}
