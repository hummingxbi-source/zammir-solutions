import type { Result } from '../../../shared-kernel/result';
import type {
  BillingError,
  CancelOutcome,
  CancelRequest,
  InvoiceFiles,
  InvoiceStatus,
  StampedInvoice,
  StampRequest,
} from '../domain/invoice';

/** Puerto de facturación ("ProveedorTimbrado"): las cuatro cosas que el sistema le pide a un PAC. Cambiar de
 *  PAC es escribir otro adaptador, no tocar el sistema [RF-M10-01, ADR-0007]. Solo lo llaman funciones del
 *  servidor: ni la tablet ni el portal público hablan con el PAC, y el CSD nunca pasa por aquí [RF-M10-02]. */
export interface BillingProvider {
  /** Timbra. Con el mismo `requestId` devuelve la misma factura y nunca timbra dos veces [RN-24]. */
  stamp(solicitud: StampRequest): Promise<Result<StampedInvoice, BillingError>>;
  cancel(solicitud: CancelRequest): Promise<Result<CancelOutcome, BillingError>>;
  getStatus(uuid: string): Promise<Result<InvoiceStatus, BillingError>>;
  /** El XML y el PDF de una factura ya timbrada. */
  download(uuid: string): Promise<Result<InvoiceFiles, BillingError>>;
}
