import { asId, type Id, type IdGenerator } from '@zammir/core';

/** Adaptador real del puerto IdGenerator: UUID generado en el dispositivo,
 *  para que un registro creado sin conexión tenga identidad desde el inicio. */
export const uuidIdGenerator: IdGenerator = {
  newId<Entidad extends string>(): Id<Entidad> {
    return asId<Entidad>(crypto.randomUUID());
  },
};
