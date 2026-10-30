declare const marca: unique symbol;

/** Identificador con nombre: el id de un cliente no se puede pasar donde va el de una orden.
 *  En ejecución es un texto; la marca solo existe para el compilador. */
export type Id<Entidad extends string> = string & { readonly [marca]: Entidad };

export type CustomerId = Id<'Customer'>;
export type QuoteId = Id<'Quote'>;
export type WorkOrderId = Id<'WorkOrder'>;
export type ProductId = Id<'Product'>;
export type CategoryId = Id<'Category'>;
export type UserId = Id<'User'>;
export type DeviceId = Id<'Device'>;

/** Puerto: identificadores únicos, generados en el dispositivo [00-principios §6]. */
export interface IdGenerator {
  newId<Entidad extends string>(): Id<Entidad>;
}

/** Marca un texto ya existente (por ejemplo, el que llegó de la base) como un id con nombre. */
export function asId<Entidad extends string>(valor: string): Id<Entidad> {
  // Única aserción de tipo permitida: la marca del id no existe en ejecución, solo para el compilador.
  return valor as Id<Entidad>;
}

/** Generador de pruebas: determinista, `id-0001`, `id-0002`… */
export function sequentialIdGenerator(prefijo = 'id'): IdGenerator {
  let contador = 0;
  return {
    newId<Entidad extends string>(): Id<Entidad> {
      contador += 1;
      return asId<Entidad>(`${prefijo}-${String(contador).padStart(4, '0')}`);
    },
  };
}
