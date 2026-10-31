import type { Clock } from '../../../shared-kernel/clock';
import { formatTempFolio } from '../../../shared-kernel/folio/folio';
import type { CustomerId, IdGenerator, QuoteId, UserId } from '../../../shared-kernel/id';
import type { Random } from '../../../shared-kernel/random';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { SellableProduct } from '../../catalog/application/ports';
import type { PriceRegistry } from '../../catalog/domain/pricing/registry';
import type { UserRole } from '../../identity/domain/auth';
import { defaultPermissionPolicy, type PermissionPolicy } from '../../identity/domain/permissions';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { generatePublicCode } from '../../sync/domain/public-code';
import { CURRENT_SCHEMA_VERSION } from '../../sync/domain/operation';
import type { SyncOutbox } from '../../sync/application/ports';
import {
  checkTransition,
  quoteTotals,
  validUntil,
  type Quote,
  type QuoteLine,
  type QuoteStatus,
} from '../domain/quote';
import {
  buildQuoteLine,
  recalculateQuoteLine,
  repriceQuoteLine,
  type LineInput,
  type QuoteLineError,
} from '../domain/quote-line';
import type { QuoteStore } from './quote-store';

export type QuoteErrorCode =
  | 'NOT_FOUND'
  /** Solo los borradores se pueden cambiar. */
  | 'NOT_EDITABLE'
  | 'NOT_AUTHORIZED'
  /** Un cajero necesita el PIN de un administrador para esta acción. */
  | 'AUTHORIZATION_REQUIRED'
  | 'EMPTY_QUOTE'
  | 'LINE_NOT_FOUND'
  | 'INVALID_TRANSITION'
  /** La cotización no se pudo guardar en la cola de salida. */
  | 'STORAGE_FAILED'
  | QuoteLineError['code'];

export interface QuoteError {
  readonly code: QuoteErrorCode;
}

/** Quién opera: la persona que entró con su PIN [ADR-0013]. */
export interface QuoteActor {
  readonly userId: UserId;
  readonly role: UserRole | null;
}

export interface QuoteDeps {
  readonly store: QuoteStore;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
  readonly registry: PriceRegistry;
  /** Tasa de IVA en puntos base (de la configuración). */
  readonly taxRateBps: number;
  readonly policy?: PermissionPolicy;
}

const lineDeps = (d: QuoteDeps) => ({ registry: d.registry, taxRateBps: d.taxRateBps });
const permisos = (d: QuoteDeps): PermissionPolicy => d.policy ?? defaultPermissionPolicy;
const ahora = (d: QuoteDeps): string => d.clock.now().toISOString();

function puedeCotizar(d: QuoteDeps, actor: QuoteActor): boolean {
  return permisos(d).check(actor.role, 'QUOTE_CREATE') !== 'DENY';
}

async function cargarBorrador(d: QuoteDeps, id: QuoteId): Promise<Result<Quote, QuoteError>> {
  const q = await d.store.get(id);
  if (q === null) {
    return err({ code: 'NOT_FOUND' });
  }
  return q.status === 'DRAFT' ? ok(q) : err({ code: 'NOT_EDITABLE' });
}

async function guardar(d: QuoteDeps, q: Quote): Promise<Quote> {
  const guardada = { ...q, updatedAt: ahora(d) };
  await d.store.save(guardada);
  return guardada;
}

/** Empieza un borrador de cotización [RF-M2-01]. Sin folio. */
export async function createQuoteDraft(
  deps: QuoteDeps,
  actor: QuoteActor,
  entrada: { readonly customerId: CustomerId; readonly siteAddress?: string | null },
): Promise<Result<Quote, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const borrador: Quote = {
    id: deps.idGenerator.newId<'Quote'>(),
    status: 'DRAFT',
    customerId: entrada.customerId,
    siteAddress: entrada.siteAddress ?? null,
    lines: [],
    userId: actor.userId,
    tempFolio: null,
    folio: null,
    publicCode: null,
    issuedAt: null,
    validUntil: null,
    conditionsText: null,
    privacyNoticeVersion: null,
    catalogVersion: null,
    discountAuthorizedBy: null,
    syncStatus: 'DRAFT',
    reviewReason: null,
    updatedAt: ahora(deps),
  };
  return ok(await guardar(deps, borrador));
}

/** Cambia el cliente o la dirección de la obra de un borrador. */
export async function updateQuoteHeader(
  deps: QuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
  cambios: { readonly customerId?: CustomerId; readonly siteAddress?: string | null },
): Promise<Result<Quote, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const q = await cargarBorrador(deps, id);
  if (!q.ok) {
    return q;
  }
  return ok(
    await guardar(deps, {
      ...q.value,
      customerId: cambios.customerId ?? q.value.customerId,
      siteAddress: cambios.siteAddress === undefined ? q.value.siteAddress : cambios.siteAddress,
    }),
  );
}

/** Agrega una línea del catálogo con su cálculo [RF-M2-02]. Los cargos adicionales (instalación,
 *  medición, flete) son productos de tipo servicio del catálogo y entran por aquí [RF-M2-03, PD-42]. */
export async function addQuoteLine(
  deps: QuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
  producto: SellableProduct,
  entrada: Omit<LineInput, 'id'>,
): Promise<Result<Quote, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const q = await cargarBorrador(deps, id);
  if (!q.ok) {
    return q;
  }
  const linea = buildQuoteLine(
    producto,
    { ...entrada, id: deps.idGenerator.newId<'QuoteLine'>() },
    lineDeps(deps),
  );
  if (!linea.ok) {
    return linea;
  }
  return ok(await guardar(deps, { ...q.value, lines: [...q.value.lines, linea.value] }));
}

/** Cambia medidas o cantidad de una línea; el precio se conserva. */
export async function updateQuoteLine(
  deps: QuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
  lineId: string,
  cambios: Partial<Pick<LineInput, 'widthMm' | 'heightMm' | 'quantity' | 'displayUnit'>>,
): Promise<Result<Quote, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const q = await cargarBorrador(deps, id);
  if (!q.ok) {
    return q;
  }
  const actual = q.value.lines.find((l) => l.id === lineId);
  if (actual === undefined) {
    return err({ code: 'LINE_NOT_FOUND' });
  }
  const nueva = recalculateQuoteLine(actual, cambios, lineDeps(deps));
  if (!nueva.ok) {
    return nueva;
  }
  return ok(
    await guardar(deps, {
      ...q.value,
      lines: q.value.lines.map((l) => (l.id === lineId ? nueva.value : l)),
    }),
  );
}

export async function removeQuoteLine(
  deps: QuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
  lineId: string,
): Promise<Result<Quote, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const q = await cargarBorrador(deps, id);
  if (!q.ok) {
    return q;
  }
  if (!q.value.lines.some((l) => l.id === lineId)) {
    return err({ code: 'LINE_NOT_FOUND' });
  }
  return ok(
    await guardar(deps, { ...q.value, lines: q.value.lines.filter((l) => l.id !== lineId) }),
  );
}

/** Descuento o cambio de precio de una línea [RF-M2-03, PD-45, RN-19]. Un administrador puede hacerlo;
 *  un cajero necesita el PIN de un administrador (`authorization`). El precio anterior queda en la línea
 *  (`catalogPriceCents`) y la bitácora la escribe el servidor al recibir la cotización. */
export async function applyQuoteDiscount(
  deps: QuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
  lineId: string,
  nuevoPrecioCents: number,
  authorization?: Authorization,
): Promise<Result<Quote, QuoteError>> {
  const decision = permisos(deps).check(actor.role, 'PRICE_OVERRIDE');
  if (decision === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  if (decision === 'NEEDS_ADMIN_AUTHORIZATION' && authorization === undefined) {
    return err({ code: 'AUTHORIZATION_REQUIRED' });
  }
  const q = await cargarBorrador(deps, id);
  if (!q.ok) {
    return q;
  }
  const actual = q.value.lines.find((l) => l.id === lineId);
  if (actual === undefined) {
    return err({ code: 'LINE_NOT_FOUND' });
  }
  const nueva = repriceQuoteLine(actual, nuevoPrecioCents, lineDeps(deps));
  if (!nueva.ok) {
    return nueva;
  }
  const guardada = await guardar(deps, {
    ...q.value,
    lines: q.value.lines.map((l) => (l.id === lineId ? nueva.value : l)),
    // Queda quién autorizó: un administrador se autoriza a sí mismo; un cajero, con el PIN de otro.
    discountAuthorizedBy: authorization?.adminId ?? actor.userId,
  });
  return ok(guardada);
}

export interface IssueQuoteDeps extends QuoteDeps {
  readonly outbox: SyncOutbox;
  readonly random: Random;
  /** Identificador del dispositivo y su serie de folios provisionales (`T<n>`). */
  readonly device: { readonly id: string; readonly series: number };
  readonly settings: {
    readonly validityDays: number;
    readonly conditionsText: string;
    readonly privacyNoticeVersion: number | null;
    readonly catalogVersion: number | null;
  };
}

function aCarga(q: Quote, lineas: readonly QuoteLine[]) {
  const totales = quoteTotals(lineas);
  return {
    id: q.id,
    tempFolio: q.tempFolio,
    publicCode: q.publicCode,
    customerId: q.customerId,
    siteAddress: q.siteAddress,
    issuedAt: q.issuedAt,
    validUntil: q.validUntil,
    conditionsText: q.conditionsText,
    privacyNoticeVersion: q.privacyNoticeVersion,
    subtotalCents: totales.subtotalCents,
    taxCents: totales.taxCents,
    totalCents: totales.totalCents,
    catalogVersion: q.catalogVersion,
    lines: lineas.map((l) => ({
      id: l.id,
      productId: l.productId,
      name: l.name,
      chargeUnit: l.chargeUnit,
      unitPriceCents: l.unitPriceCents,
      catalogPriceCents: l.catalogPriceCents,
      ruleId: l.ruleId,
      ruleParams: l.ruleParams ?? {},
      widthMm: l.widthMm,
      heightMm: l.heightMm,
      quantity: l.quantity,
      lineTotalCents: l.lineTotalCents,
      baseCents: l.baseCents,
      taxCents: l.taxCents,
      isTaxExempt: l.isTaxExempt,
      detail: l.detail,
    })),
  };
}

/** Emite la cotización [RF-M2-07, RN-03, RN-12, RN-13, RN-16]: congela precios, calcula la vigencia, copia
 *  las condiciones y le da folio provisional y código público. El documento y su operación `IssueQuote`
 *  se guardan en la misma transacción local; el folio definitivo lo asigna el servidor al recibirla. */
export async function issueQuote(
  deps: IssueQuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
): Promise<Result<Quote, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const q = await cargarBorrador(deps, id);
  if (!q.ok) {
    return q;
  }
  if (q.value.lines.length === 0) {
    return err({ code: 'EMPTY_QUOTE' });
  }
  const instante = deps.clock.now();
  try {
    const emitida = await deps.outbox.transaction(async (tx): Promise<Quote> => {
      const numero = await tx.nextTempNumber();
      const folio = formatTempFolio(deps.device.series, numero);
      if (!folio.ok) {
        throw new Error('INVALID_TEMP_FOLIO');
      }
      const base: Quote = {
        ...q.value,
        status: 'SENT',
        tempFolio: folio.value,
        publicCode: generatePublicCode(deps.random),
        issuedAt: instante.toISOString(),
        validUntil: validUntil(instante, deps.settings.validityDays),
        conditionsText: deps.settings.conditionsText,
        privacyNoticeVersion: deps.settings.privacyNoticeVersion,
        catalogVersion: deps.settings.catalogVersion,
        syncStatus: 'SAVED_ON_TABLET',
        updatedAt: instante.toISOString(),
      };
      const operacion = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: 'IssueQuote',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        ...(base.discountAuthorizedBy === null ? {} : { authorizedBy: base.discountAuthorizedBy }),
        clientCreatedAt: instante.toISOString(),
        payload: aCarga(base, base.lines),
      });
      if (!operacion.ok) {
        throw new Error('INVALID_OPERATION');
      }
      await tx.putDocument('quotes', base.id, base);
      return base;
    });
    return ok(emitida);
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}

/** Marca una cotización enviada como aceptada o rechazada [RF-M2-07]. Se guarda en la tablet y sale como
 *  operación. */
export async function markQuote(
  deps: IssueQuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
  nuevo: Extract<QuoteStatus, 'ACCEPTED' | 'REJECTED'>,
): Promise<Result<Quote, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const q = await deps.store.get(id);
  if (q === null) {
    return err({ code: 'NOT_FOUND' });
  }
  const permitida = checkTransition(q.status, nuevo);
  if (!permitida.ok) {
    return err({ code: 'INVALID_TRANSITION' });
  }
  try {
    const instante = deps.clock.now().toISOString();
    const actualizada = await deps.outbox.transaction(async (tx): Promise<Quote> => {
      const nueva: Quote = {
        ...q,
        status: nuevo,
        syncStatus: 'SAVED_ON_TABLET',
        updatedAt: instante,
      };
      const operacion = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: nuevo === 'ACCEPTED' ? 'MarkQuoteAccepted' : 'MarkQuoteRejected',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        clientCreatedAt: instante,
        payload: { quoteId: q.id },
      });
      if (!operacion.ok) {
        throw new Error('INVALID_OPERATION');
      }
      await tx.putDocument('quotes', nueva.id, nueva);
      return nueva;
    });
    return ok(actualizada);
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}

/** Duplica una cotización como borrador nuevo, sin folio y con los precios ACTUALES del catálogo
 *  [RF-M2-09]. Los productos que ya no se pueden vender se omiten y se avisan. */
export async function duplicateQuote(
  deps: QuoteDeps,
  actor: QuoteActor,
  id: QuoteId,
  catalogo: (productId: string) => Promise<SellableProduct | null>,
): Promise<Result<{ readonly quote: Quote; readonly omitted: readonly string[] }, QuoteError>> {
  if (!puedeCotizar(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const origen = await deps.store.get(id);
  if (origen === null) {
    return err({ code: 'NOT_FOUND' });
  }
  const nuevo = await createQuoteDraft(deps, actor, {
    customerId: origen.customerId,
    siteAddress: origen.siteAddress,
  });
  if (!nuevo.ok) {
    return nuevo;
  }
  let actual = nuevo.value;
  const omitidas: string[] = [];
  for (const linea of origen.lines) {
    const producto = linea.productId === null ? null : await catalogo(linea.productId);
    if (producto === null) {
      omitidas.push(linea.name);
      continue;
    }
    const agregada = await addQuoteLine(deps, actor, actual.id, producto, {
      widthMm: linea.widthMm,
      heightMm: linea.heightMm,
      quantity: linea.quantity,
      displayUnit: linea.displayUnit,
    });
    if (!agregada.ok) {
      omitidas.push(linea.name);
      continue;
    }
    actual = agregada.value;
  }
  return ok({ quote: actual, omitted: omitidas });
}
