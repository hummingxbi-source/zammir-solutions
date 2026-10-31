import { operationReceiverContract } from '@zammir/core/testing';

import { harness } from './servidor-de-pruebas';

// Contra el servidor local real: función de borde + receive_operation. Corre con `pnpm test:integracion`.
operationReceiverContract('Supabase (función de borde + receive_operation)', () => harness);
