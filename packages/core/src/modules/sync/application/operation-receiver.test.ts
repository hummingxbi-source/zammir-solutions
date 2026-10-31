import { fixedClock } from '../../../shared-kernel/clock';
import {
  codigoPublicoDePrueba,
  operationReceiverContract,
} from '../contracts/operation-receiver.contract';
import { inMemoryFolioAllocator } from './folio-allocator';
import { crearAlmacen, inMemoryOperationReceiver } from './operation-receiver';

let contador = 0;
let anio = 2200;

function uuidDePrueba(): string {
  contador += 1;
  return `00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`;
}

operationReceiverContract('memoria', () => {
  const almacen = crearAlmacen();
  const folios = inMemoryFolioAllocator();
  const clock = fixedClock(new Date('2026-10-30T12:00:00.000Z'));
  return {
    newDevice: () => {
      const id = uuidDePrueba();
      almacen.state.activeDevices.add(id);
      return Promise.resolve({
        id,
        receiver: inMemoryOperationReceiver({
          folios,
          clock,
          callerDeviceId: id,
          shared: almacen,
        }),
      });
    },
    newUser: (activa, administrador = false) => {
      const id = uuidDePrueba();
      if (activa) {
        almacen.state.activeUsers.add(id);
        if (administrador) {
          almacen.state.adminUsers.add(id);
        }
      }
      return Promise.resolve(id);
    },
    newCustomer: () => {
      const id = uuidDePrueba();
      almacen.state.knownCustomers.add(id);
      return Promise.resolve(id);
    },
    shiftState: (id) => {
      const turno = almacen.ordenesStore.turnos.get(id);
      return Promise.resolve(
        turno === undefined
          ? undefined
          : {
              status: turno.status,
              expectedCents: turno.expectedCents,
              differenceCents: turno.differenceCents,
            },
      );
    },
    saleState: (id) => {
      const venta = almacen.ordenesStore.ventas.get(id);
      return Promise.resolve(
        venta === undefined
          ? undefined
          : { status: venta.status, paidCents: venta.paidCents, folio: venta.folio },
      );
    },
    orderState: (id) => {
      const orden = almacen.ordenesStore.ordenes.get(id);
      return Promise.resolve(
        orden === undefined
          ? undefined
          : {
              status: orden.status,
              paidCents: almacen.ordenesStore.pagado.get(id) ?? 0,
              folio: orden.folio,
            },
      );
    },
    customerName: (id) => Promise.resolve(almacen.clientes.get(id)?.name),
    revokeDevice: (id) => {
      almacen.state.activeDevices.delete(id);
      return Promise.resolve();
    },
    newUuid: uuidDePrueba,
    newPublicCode: () => {
      contador += 1;
      return codigoPublicoDePrueba(contador);
    },
    newYear: () => {
      anio += 1;
      return Promise.resolve(anio);
    },
    // Cada prueba crea su propio servidor en memoria, así que cuenta todo lo que hay.
    countsFor: () =>
      Promise.resolve({ quotes: almacen.cotizaciones.size, operations: almacen.operaciones.size }),
  };
});
