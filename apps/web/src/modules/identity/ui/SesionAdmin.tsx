import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  hasIdleExpired,
  signInAdmin,
  type AdminAuth,
  type AuthenticatedUser,
  type AuthError,
  type Clock,
  type Result,
} from '@zammir/core';

/** Cada cuánto se revisa si la sesión lleva demasiado tiempo sin actividad. */
const REVISION_CADA_MS = 30_000;
const EVENTOS_DE_ACTIVIDAD = ['pointerdown', 'keydown', 'touchstart'] as const;

export interface SesionAdmin {
  readonly usuario: AuthenticatedUser | null;
  /** `true` mientras se averigua si ya hay una sesión abierta. */
  readonly cargando: boolean;
  readonly entrar: (
    email: string,
    password: string,
  ) => Promise<Result<AuthenticatedUser, AuthError>>;
  readonly salir: () => Promise<void>;
}

const SesionSinProveedor: SesionAdmin = {
  usuario: null,
  cargando: false,
  entrar: () => Promise.resolve({ ok: false, error: { code: 'NETWORK_UNAVAILABLE' } }),
  salir: () => Promise.resolve(),
};

const Contexto = createContext<SesionAdmin>(SesionSinProveedor);

export function useSesionAdmin(): SesionAdmin {
  return useContext(Contexto);
}

export interface ProveedorSesionAdminProps {
  readonly auth: AdminAuth;
  readonly clock: Clock;
  /** Minutos de inactividad para cerrar la sesión; `null` = por definir (PD-21). Se pide al servidor
   *  una vez que hay un administrador con sesión. */
  readonly cargarLimiteInactividad: () => Promise<number | null>;
  readonly children: ReactNode;
}

/** Guarda quién tiene la sesión de administrador y la cierra por inactividad [DC §4, PD-21]. */
export function ProveedorSesionAdmin({
  auth,
  clock,
  cargarLimiteInactividad,
  children,
}: ProveedorSesionAdminProps): ReactElement {
  const [usuario, setUsuario] = useState<AuthenticatedUser | null>(null);
  const [cargando, setCargando] = useState(true);
  const [limite, setLimite] = useState<number | null>(null);
  const ultimaActividad = useRef<Date>(clock.now());

  useEffect(() => {
    let vigente = true;
    void auth.currentUser().then((actual) => {
      if (vigente) {
        setUsuario(actual);
        setCargando(false);
      }
    });
    return () => {
      vigente = false;
    };
  }, [auth]);

  useEffect(() => {
    if (usuario?.role !== 'ADMIN') {
      setLimite(null);
      return;
    }
    let vigente = true;
    void cargarLimiteInactividad().then((minutos) => {
      if (vigente) {
        setLimite(minutos);
      }
    });
    return () => {
      vigente = false;
    };
  }, [usuario, cargarLimiteInactividad]);

  const salir = useCallback(async (): Promise<void> => {
    await auth.signOut();
    setUsuario(null);
  }, [auth]);

  const entrar = useCallback(
    async (email: string, password: string): Promise<Result<AuthenticatedUser, AuthError>> => {
      const resultado = await signInAdmin(auth, email, password);
      if (resultado.ok) {
        ultimaActividad.current = clock.now();
        setUsuario(resultado.value);
      }
      return resultado;
    },
    [auth, clock],
  );

  useEffect(() => {
    if (usuario === null) {
      return;
    }
    const registrarActividad = (): void => {
      ultimaActividad.current = clock.now();
    };
    for (const evento of EVENTOS_DE_ACTIVIDAD) {
      window.addEventListener(evento, registrarActividad);
    }
    const intervalo = window.setInterval(() => {
      if (hasIdleExpired(ultimaActividad.current, clock.now(), limite)) {
        void salir();
      }
    }, REVISION_CADA_MS);
    return () => {
      for (const evento of EVENTOS_DE_ACTIVIDAD) {
        window.removeEventListener(evento, registrarActividad);
      }
      window.clearInterval(intervalo);
    };
  }, [usuario, limite, clock, salir]);

  const valor = useMemo<SesionAdmin>(
    () => ({ usuario, cargando, entrar, salir }),
    [usuario, cargando, entrar, salir],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
