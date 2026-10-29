import { adminAuthContract } from '../contracts/admin-auth.contract';
import { inMemoryAdminAuth } from './in-memory-admin-auth';

const admin = { email: 'admin@ejemplo.invalid', password: 'clave-de-prueba-1' };
const cajero = { email: 'cajero@ejemplo.invalid', password: 'clave-de-prueba-2' };

adminAuthContract(
  'en memoria',
  () =>
    inMemoryAdminAuth([
      { userId: 'u-1', ...admin, role: 'ADMIN' },
      { userId: 'u-2', ...cajero, role: 'STAFF' },
    ]),
  { admin, cajero },
);
