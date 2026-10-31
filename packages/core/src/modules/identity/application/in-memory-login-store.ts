import type { LocalLoginStore, LoginSnapshot } from './sign-in-with-pin';

/** Copia local de las personas en memoria, para pruebas. */
export function inMemoryLoginStore(): LocalLoginStore {
  let copia: LoginSnapshot | null = null;
  return {
    replace: (nueva) => {
      copia = nueva;
      return Promise.resolve();
    },
    load: () => Promise.resolve(copia),
  };
}
