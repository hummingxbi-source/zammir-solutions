import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  ok,
  type DocumentReplicaSource,
  type Payment,
  type ReplicatedSale,
  type ReplicatedWorkOrder,
  type WorkOrderLine,
  type WorkOrderStatus,
} from '@zammir/core';

interface FilaDeOrden {
  readonly id: string;
  readonly temp_folio: string;
  readonly folio: string | null;
  readonly public_code: string;
  readonly status: WorkOrderStatus;
  readonly customer_id: string;
  readonly quote_id: string | null;
  readonly site_address: string | null;
  readonly description: string | null;
  readonly issued_at: string;
  readonly subtotal_cents: number;
  readonly tax_cents: number;
  readonly total_cents: number;
  readonly deposit_percent_bps: number;
  readonly deposit_required_cents: number;
  readonly measured_by: string | null;
  readonly built_by: string | null;
  readonly installed_by: string | null;
  readonly estimated_delivery_date: string | null;
  readonly notes: string | null;
  readonly delivered_at: string | null;
  readonly delivered_with_balance: boolean;
  readonly delivery_reason: string | null;
  readonly delivery_authorized_by: string | null;
  readonly cancelled_at: string | null;
  readonly cancel_reason: string | null;
  readonly cancelled_from_status: WorkOrderStatus | null;
  readonly cancel_deposit_paid_cents: number | null;
  readonly user_id: string;
  readonly review_reason: string | null;
  readonly change_seq: number;
  readonly lines: readonly WorkOrderLine[];
}

interface FilaDeVenta {
  readonly id: string;
  readonly temp_folio: string;
  readonly folio: string | null;
  readonly public_code: string;
  readonly status: 'COMPLETED' | 'CANCELLED';
  readonly customer_id: string | null;
  readonly issued_at: string;
  readonly subtotal_cents: number;
  readonly tax_cents: number;
  readonly total_cents: number;
  readonly cancelled_at: string | null;
  readonly cancel_reason: string | null;
  readonly cancelled_by: string | null;
  readonly user_id: string;
  readonly review_reason: string | null;
  readonly change_seq: number;
  readonly lines: readonly WorkOrderLine[];
  readonly cash_shift_id: string | null;
}

interface FilaDePago {
  readonly id: string;
  readonly group_id: string;
  readonly work_order_id: string | null;
  readonly counter_sale_id: string | null;
  readonly kind: Payment['kind'];
  readonly method: Payment['method'];
  readonly amount_cents: number;
  readonly cash_received_cents: number | null;
  readonly change_cents: number | null;
  readonly reference: string | null;
  readonly user_id: string;
  readonly paid_at: string;
  readonly cash_shift_id: string | null;
  readonly change_seq: number;
}

const usuario = (id: string | null) => (id === null ? null : asId<'User'>(id));

/** De dónde baja la tablet las órdenes y los pagos de las demás tablets: las vistas
 *  `work_orders_for_device` y `payments_for_device`, sin datos fiscales [RNF-06]. */
export function supabaseDocumentReplica(cliente: SupabaseClient): DocumentReplicaSource {
  return {
    async ordersChangedAfter(seq, limit) {
      const r = await cliente
        .from('work_orders_for_device')
        .select('*')
        .gt('change_seq', seq)
        .order('change_seq')
        .limit(limit);
      if (r.error !== null) {
        return err({ code: 'DOCUMENTS_UNAVAILABLE' });
      }
      return ok(
        (r.data as FilaDeOrden[]).map((f): ReplicatedWorkOrder => ({
          id: asId<'WorkOrder'>(f.id),
          status: f.status,
          customerId: asId<'Customer'>(f.customer_id),
          quoteId: f.quote_id,
          siteAddress: f.site_address,
          description: f.description,
          lines: f.lines,
          subtotalCents: f.subtotal_cents,
          taxCents: f.tax_cents,
          totalCents: f.total_cents,
          depositPercentBps: f.deposit_percent_bps,
          depositRequiredCents: f.deposit_required_cents,
          measuredBy: usuario(f.measured_by),
          builtBy: usuario(f.built_by),
          installedBy: usuario(f.installed_by),
          estimatedDeliveryDate: f.estimated_delivery_date,
          notes: f.notes,
          tempFolio: f.temp_folio,
          folio: f.folio,
          publicCode: f.public_code,
          issuedAt: f.issued_at,
          deliveredAt: f.delivered_at,
          deliveredWithBalance: f.delivered_with_balance,
          deliveryReason: f.delivery_reason,
          deliveryAuthorizedBy: f.delivery_authorized_by,
          cancelledAt: f.cancelled_at,
          cancelReason: f.cancel_reason,
          cancelledFromStatus: f.cancelled_from_status,
          cancelDepositPaidCents: f.cancel_deposit_paid_cents,
          userId: asId<'User'>(f.user_id),
          syncStatus: 'SENT',
          reviewReason: f.review_reason,
          changeSeq: f.change_seq,
        })),
      );
    },

    async salesChangedAfter(seq, limit) {
      const r = await cliente
        .from('counter_sales_for_device')
        .select('*')
        .gt('change_seq', seq)
        .order('change_seq')
        .limit(limit);
      if (r.error !== null) {
        return err({ code: 'DOCUMENTS_UNAVAILABLE' });
      }
      return ok(
        (r.data as FilaDeVenta[]).map((f): ReplicatedSale => ({
          id: f.id,
          status: f.status,
          customerId: f.customer_id === null ? null : asId<'Customer'>(f.customer_id),
          lines: f.lines,
          subtotalCents: f.subtotal_cents,
          taxCents: f.tax_cents,
          totalCents: f.total_cents,
          tempFolio: f.temp_folio,
          folio: f.folio,
          publicCode: f.public_code,
          issuedAt: f.issued_at,
          userId: asId<'User'>(f.user_id),
          deviceId: null,
          cashShiftId: f.cash_shift_id,
          cancelledAt: f.cancelled_at,
          cancelReason: f.cancel_reason,
          cancelledBy: f.cancelled_by,
          syncStatus: 'SENT',
          reviewReason: f.review_reason,
          changeSeq: f.change_seq,
        })),
      );
    },

    async paymentsChangedAfter(seq, limit) {
      const r = await cliente
        .from('payments_for_device')
        .select('*')
        .gt('change_seq', seq)
        .order('change_seq')
        .limit(limit);
      if (r.error !== null) {
        return err({ code: 'DOCUMENTS_UNAVAILABLE' });
      }
      return ok(
        (r.data as FilaDePago[]).map((f) => ({
          id: f.id,
          groupId: f.group_id,
          targetType:
            f.work_order_id === null ? ('COUNTER_SALE' as const) : ('WORK_ORDER' as const),
          targetId: f.work_order_id ?? f.counter_sale_id ?? '',
          kind: f.kind,
          method: f.method,
          amountCents: f.amount_cents,
          cashReceivedCents: f.cash_received_cents,
          changeCents: f.change_cents,
          reference: f.reference,
          userId: f.user_id,
          deviceId: null,
          paidAt: f.paid_at,
          cashShiftId: f.cash_shift_id,
          changeSeq: f.change_seq,
        })),
      );
    },
  };
}
