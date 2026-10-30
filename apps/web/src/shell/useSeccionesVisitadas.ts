import { useCallback, useState } from 'react';

const CLAVE = 'zammir.secciones-visitadas';

function leer(): ReadonlySet<string> {
  try {
    const texto = window.localStorage.getItem(CLAVE);
    if (texto === null) {
      return new Set();
    }
    const valor: unknown = JSON.parse(texto);
    return new Set(
      Array.isArray(valor) ? valor.filter((x): x is string => typeof x === 'string') : [],
    );
  } catch {
    // Sin almacenamiento o con datos dañados la marca simplemente no se recuerda.
    return new Set();
  }
}

function guardar(visitadas: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify([...visitadas]));
  } catch {
    // Sin almacenamiento disponible: la marca vive solo mientras la aplicación está abierta.
  }
}

/** Secciones que la persona ya visitó, para marcarlas en la navegación [RF-UX-01]. */
export function useSeccionesVisitadas(): {
  readonly visitadas: ReadonlySet<string>;
  readonly marcar: (id: string) => void;
} {
  const [visitadas, setVisitadas] = useState<ReadonlySet<string>>(leer);

  const marcar = useCallback((id: string): void => {
    setVisitadas((actuales) => {
      if (actuales.has(id)) {
        return actuales;
      }
      const siguientes = new Set(actuales).add(id);
      guardar(siguientes);
      return siguientes;
    });
  }, []);

  return { visitadas, marcar };
}
