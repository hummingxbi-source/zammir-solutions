import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  adjustmentFieldsFor,
  adjustmentsToTexts,
  NO_ADJUSTMENTS,
  paramsWithAdjustments,
  parseAdjustmentTexts,
  readAdjustments,
  type ChargeAdjustments,
} from './adjustments';
import { createPriceRegistry, defaultRules } from './registry';

const TODOS = adjustmentFieldsFor('AREA');

describe('ajustes del cobro por producto [RF-M1-14]', () => {
  it('cada regla admite solo sus ajustes', () => {
    expect(adjustmentFieldsFor('AREA')).toEqual([
      'measureStepMm',
      'minAreaMm2',
      'minAmountCents',
      'maxWidthMm',
      'maxHeightMm',
    ]);
    expect(adjustmentFieldsFor('LINEAR', 'LENGTH')).toEqual([
      'measureStepMm',
      'minAmountCents',
      'maxWidthMm',
    ]);
    expect(adjustmentFieldsFor('LINEAR', 'PERIMETER')).toEqual([
      'measureStepMm',
      'minAmountCents',
      'maxWidthMm',
      'maxHeightMm',
    ]);
    expect(adjustmentFieldsFor('PIECE')).toEqual([]);
    expect(adjustmentFieldsFor('SERVICE')).toEqual([]);
  });

  it('lo capturado se convierte: milímetros, m² con 3 decimales y pesos', () => {
    const r = parseAdjustmentTexts(
      {
        measureStepMm: '50',
        minAreaMm2: '0.5',
        minAmountCents: '350',
        maxWidthMm: '1800',
        maxHeightMm: ' 2600 ',
      },
      TODOS,
    );
    expect(r.errors).toEqual([]);
    expect(r.adjustments).toEqual({
      measureStepMm: 50,
      minAreaMm2: 500_000,
      minAmountCents: 350_00,
      maxWidthMm: 1800,
      maxHeightMm: 2600,
    });
    expect(parseAdjustmentTexts({ minAreaMm2: '1.255' }, TODOS).adjustments.minAreaMm2).toBe(
      1_255_000,
    );
    expect(parseAdjustmentTexts({ minAreaMm2: '2' }, TODOS).adjustments.minAreaMm2).toBe(2_000_000);
  });

  it('vacío es apagado: sin mínimo y con la medida exacta', () => {
    const r = parseAdjustmentTexts({}, TODOS);
    expect(r).toEqual({ adjustments: NO_ADJUSTMENTS, errors: [] });
  });

  it('lo que no es válido se avisa campo por campo', () => {
    const r = parseAdjustmentTexts(
      {
        measureStepMm: '0',
        minAreaMm2: '0.0005',
        minAmountCents: '-5',
        maxWidthMm: '18.5',
        maxHeightMm: 'dos',
      },
      TODOS,
    );
    expect(r.errors.map((e) => e.code)).toEqual([
      'MEASURE_STEP_INVALID',
      'MIN_AREA_INVALID',
      'MIN_AMOUNT_INVALID',
      'MAX_WIDTH_INVALID',
      'MAX_HEIGHT_INVALID',
    ]);
    expect(parseAdjustmentTexts({ minAreaMm2: '0' }, TODOS).errors).toHaveLength(1);
    expect(parseAdjustmentTexts({ minAmountCents: '0' }, TODOS).errors).toHaveLength(1);
  });

  it('un campo que la regla no admite se ignora', () => {
    const r = parseAdjustmentTexts(
      { minAreaMm2: 'no válido', maxHeightMm: '100' },
      adjustmentFieldsFor('LINEAR', 'LENGTH'),
    );
    expect(r).toEqual({ adjustments: NO_ADJUSTMENTS, errors: [] });
  });

  it('los parámetros guardan solo lo encendido y conservan la base del metro lineal', () => {
    const ajustes: ChargeAdjustments = {
      ...NO_ADJUSTMENTS,
      measureStepMm: 10,
      maxHeightMm: 2400,
      minAreaMm2: 500_000,
    };
    expect(paramsWithAdjustments('AREA', {}, ajustes)).toEqual({
      measureStepMm: 10,
      minAreaMm2: 500_000,
      maxHeightMm: 2400,
    });
    expect(paramsWithAdjustments('LINEAR', { basis: 'LENGTH' }, ajustes)).toEqual({
      basis: 'LENGTH',
      measureStepMm: 10,
    });
    expect(paramsWithAdjustments('PIECE', {}, ajustes)).toEqual({});
  });

  it('leer los parámetros guardados: lo que falta o no es válido queda apagado', () => {
    expect(readAdjustments(undefined)).toEqual(NO_ADJUSTMENTS);
    expect(readAdjustments('texto')).toEqual(NO_ADJUSTMENTS);
    expect(
      readAdjustments({ measureStepMm: 50, minAreaMm2: null, minAmountCents: -1, maxWidthMm: 1.5 }),
    ).toEqual({ ...NO_ADJUSTMENTS, measureStepMm: 50 });
  });

  it('a texto y de regreso da lo mismo', () => {
    const ajustes: ChargeAdjustments = {
      measureStepMm: 5,
      minAreaMm2: 250_000,
      minAmountCents: 120_50 as ChargeAdjustments['minAmountCents'],
      maxWidthMm: 1800,
      maxHeightMm: 2600,
    };
    expect(adjustmentsToTexts(ajustes)).toEqual({
      measureStepMm: '5',
      minAreaMm2: '0.25',
      minAmountCents: '120.50',
      maxWidthMm: '1800',
      maxHeightMm: '2600',
    });
    expect(adjustmentsToTexts(NO_ADJUSTMENTS).minAreaMm2).toBe('');
    expect(adjustmentsToTexts({ ...NO_ADJUSTMENTS, minAreaMm2: 3_000_000 }).minAreaMm2).toBe('3');
  });

  it('propiedad: cualquier área de hasta 3 decimales va y vuelve sin perder nada', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (milesimas) => {
        const mm2 = milesimas * 1000;
        const texto = adjustmentsToTexts({ ...NO_ADJUSTMENTS, minAreaMm2: mm2 }).minAreaMm2;
        expect(parseAdjustmentTexts({ minAreaMm2: texto }, TODOS).adjustments.minAreaMm2).toBe(mm2);
      }),
    );
  });

  it('lo que se arma lo acepta la regla de precio', () => {
    const reglas = createPriceRegistry(defaultRules);
    if (!reglas.ok) throw new Error('registro');
    const { adjustments } = parseAdjustmentTexts(
      {
        measureStepMm: '50',
        minAreaMm2: '0.5',
        minAmountCents: '350',
        maxWidthMm: '1800',
        maxHeightMm: '2600',
      },
      TODOS,
    );
    const r = reglas.value.calculate('AREA', paramsWithAdjustments('AREA', {}, adjustments), {
      unitPrice: 0 as never,
      widthMm: 1000 as never,
      heightMm: 1000 as never,
      quantity: 1,
      displayUnit: 'm',
    });
    expect(r.ok).toBe(true);
  });
});
