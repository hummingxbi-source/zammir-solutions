import { useEffect, useId, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  adjustmentFieldsFor,
  adjustmentsToTexts,
  isProductServiceKey,
  isUnitKey,
  MAX_DESCRIPTION_LENGTH,
  MAX_SALE_UNIT_LENGTH,
  paramsWithAdjustments,
  parseAdjustmentTexts,
  parseMoney,
  readAdjustments,
  SALE_UNIT_SUGGESTIONS,
  type AdjustmentField,
  type AdjustmentTexts,
  type Category,
  type ChargeUnit,
  type PriceChange,
  type Product,
  type ProductDraft,
  type ProductKind,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { formatearFecha, formatearPesos } from '../../../shared/ui/formatos';

const t = textos.catalogo;

const UNIDADES_POR_TIPO: Readonly<Record<ProductKind, readonly ChargeUnit[]>> = {
  CUSTOM: ['SQUARE_METER', 'LINEAR_METER', 'PIECE'],
  STANDARD: ['PIECE'],
  SERVICE: ['SERVICE'],
  // Cargo extra (cantos, perforaciones, biselados): m² por omisión [RF-M1-09].
  EXTRA: ['SQUARE_METER', 'LINEAR_METER', 'PIECE'],
};

const REGLA_POR_UNIDAD: Readonly<Record<ChargeUnit, string>> = {
  SQUARE_METER: 'AREA',
  LINEAR_METER: 'LINEAR',
  PIECE: 'PIECE',
  SERVICE: 'SERVICE',
};

export interface FormularioDeProductoProps {
  readonly categorias: readonly Category[];
  /** El producto que se edita; sin él, es un alta. */
  readonly inicial?: Product;
  readonly historial?: readonly PriceChange[];
  /** Unidades de venta que ya usa el catálogo; se suman a las sugerencias para que todos escriban igual. */
  readonly unidadesDeVenta?: readonly string[];
  /** Guarda el producto; devuelve el código de error o `null` si se guardó. */
  readonly onGuardar: (borrador: ProductDraft) => Promise<string | null>;
  readonly onCancelar: () => void;
}

/** Etiqueta de cada ajuste del cobro; con base en el largo, el máximo es el del largo. */
function etiquetaDeAjuste(campo: AdjustmentField, porLargo: boolean): string {
  const f = t.formulario;
  const etiquetas: Readonly<Record<AdjustmentField, string>> = {
    measureStepMm: f.redondeo,
    minAreaMm2: f.areaMinima,
    minAmountCents: f.minimo,
    maxWidthMm: porLargo ? f.largoMaximo : f.anchoMaximo,
    maxHeightMm: f.altoMaximo,
  };
  return etiquetas[campo];
}

function pesosATexto(centavos: number): string {
  return `${String(Math.floor(centavos / 100))}.${String(centavos % 100).padStart(2, '0')}`;
}

/** Alta y edición de un producto: nombre, categoría, tipo, cómo se cobra y su precio de lista con IVA
 *  [RF-M1-01, RF-M1-04]. Los datos fiscales los hereda de su categoría; un cambio de precio deja su historial
 *  [RF-M1-06]. */
export function FormularioDeProducto({
  categorias,
  inicial,
  historial,
  unidadesDeVenta = [],
  onGuardar,
  onCancelar,
}: FormularioDeProductoProps): ReactElement {
  const idSugerencias = useId();
  const [nombre, setNombre] = useState(inicial?.name ?? '');
  const [codigo, setCodigo] = useState(inicial?.code ?? '');
  // Solo se ofrecen las categorías activas, más la que ya tiene el producto al editarlo [RF-M1-08].
  const ofrecidas = categorias.filter(
    (c) => (c.isActive as boolean | undefined) !== false || c.id === inicial?.categoryId,
  );
  const [categoriaId, setCategoriaId] = useState<string>(
    inicial?.categoryId ?? ofrecidas[0]?.id ?? '',
  );
  const [tipo, setTipo] = useState<ProductKind>(inicial?.kind ?? 'CUSTOM');
  const [unidad, setUnidad] = useState<ChargeUnit>(inicial?.chargeUnit ?? 'SQUARE_METER');
  const [base, setBase] = useState<'LENGTH' | 'PERIMETER'>(() => {
    const parametros = inicial?.ruleParams as { basis?: string } | undefined;
    return parametros?.basis === 'PERIMETER' ? 'PERIMETER' : 'LENGTH';
  });
  const [precio, setPrecio] = useState(inicial === undefined ? '' : pesosATexto(inicial.listPrice));
  const [exento, setExento] = useState(inicial?.isTaxExempt ?? false);
  const [abierto, setAbierto] = useState(inicial?.isOpenPrice === true);
  const [descripcion, setDescripcion] = useState(inicial?.description ?? '');
  const [unidadDeVenta, setUnidadDeVenta] = useState(inicial?.saleUnitName ?? '');
  // Claves SAT [RF-M1-11]: vacías, se usan las de la categoría. Al editar, solo se muestran si son propias.
  const categoriaInicial = categorias.find((c) => c.id === inicial?.categoryId);
  const propia = (
    clave: string | null | undefined,
    deCategoria: string | null | undefined,
  ): string => (clave === null || clave === undefined || clave === deCategoria ? '' : clave);
  const [claveSat, setClaveSat] = useState(
    propia(inicial?.fiscal.productServiceKey, categoriaInicial?.fiscalDefaults.productServiceKey),
  );
  const [claveUnidad, setClaveUnidad] = useState(
    propia(inicial?.fiscal.unitKey, categoriaInicial?.fiscalDefaults.unitKey),
  );
  // Ajustes del cobro [RF-M1-14]: apagados (vacíos) mientras no se capturen.
  const [ajustes, setAjustes] = useState<AdjustmentTexts>(() =>
    adjustmentsToTexts(readAdjustments(inicial?.ruleParams)),
  );
  const porPiezaOServicio = unidad === 'PIECE' || unidad === 'SERVICE';
  const sugerencias = [...new Set([...SALE_UNIT_SUGGESTIONS, ...unidadesDeVenta])].sort((a, b) =>
    a.localeCompare(b, 'es-MX'),
  );
  const categoriaElegida = categorias.find((c) => c.id === categoriaId);
  const camposDeAjuste = adjustmentFieldsFor(
    REGLA_POR_UNIDAD[unidad],
    unidad === 'LINEAR_METER' ? base : null,
  );
  const [garantia, setGarantia] = useState(
    inicial?.warrantyMonths === null || inicial?.warrantyMonths === undefined
      ? ''
      : String(inicial.warrantyMonths),
  );
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  // Al cambiar el tipo, la unidad se queda en una que ese tipo admita.
  useEffect(() => {
    if (!UNIDADES_POR_TIPO[tipo].includes(unidad)) {
      setUnidad(UNIDADES_POR_TIPO[tipo][0] ?? 'PIECE');
    }
  }, [tipo, unidad]);

  function mostrarError(codigoDeError: string): void {
    const clave = (
      codigoDeError in t.errores ? codigoDeError : 'CATALOG_UNAVAILABLE'
    ) as keyof typeof t.errores;
    setError(t.errores[clave]);
  }

  async function guardar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    const monto = parseMoney(precio);
    if (!monto.ok) {
      mostrarError('PRICE_INVALID');
      return;
    }
    const categoria = categorias.find((c) => c.id === categoriaId);
    if (categoria === undefined) {
      mostrarError('CATEGORY_NOT_FOUND');
      return;
    }
    let meses: number | null = null;
    if (garantia.trim() !== '') {
      meses = /^\d+$/.test(garantia.trim()) ? Number(garantia.trim()) : Number.NaN;
      if (!Number.isInteger(meses) || meses <= 0) {
        mostrarError('WARRANTY_INVALID');
        return;
      }
    }
    const sat = claveSat.trim();
    const satUnidad = claveUnidad.trim().toUpperCase();
    if (sat !== '' && !isProductServiceKey(sat)) {
      mostrarError('SAT_KEY_INVALID');
      return;
    }
    if (satUnidad !== '' && !isUnitKey(satUnidad)) {
      mostrarError('SAT_UNIT_KEY_INVALID');
      return;
    }
    const fiscalBase =
      inicial?.categoryId === categoria.id ? inicial.fiscal : categoria.fiscalDefaults;
    const leidos = parseAdjustmentTexts(ajustes, camposDeAjuste);
    const primerError = leidos.errors[0];
    if (primerError !== undefined) {
      mostrarError(primerError.code);
      return;
    }
    const borrador: ProductDraft = {
      code: codigo.trim() === '' ? null : codigo.trim(),
      name: nombre,
      categoryId: categoria.id,
      kind: tipo,
      chargeUnit: unidad,
      listPrice: monto.value,
      isTaxExempt: exento,
      isActive: inicial?.isActive ?? true,
      ruleId: REGLA_POR_UNIDAD[unidad],
      ruleParams: paramsWithAdjustments(
        REGLA_POR_UNIDAD[unidad],
        unidad === 'LINEAR_METER' ? { basis: base } : {},
        leidos.adjustments,
      ),
      fiscal: {
        ...fiscalBase,
        productServiceKey: sat === '' ? categoria.fiscalDefaults.productServiceKey : sat,
        unitKey: satUnidad === '' ? categoria.fiscalDefaults.unitKey : satUnidad,
      },
      warrantyMonths: meses,
      warrantyText: inicial?.warrantyText ?? null,
      // Un cargo extra copia su precio a la pieza: nunca tiene precio abierto [RF-M1-10].
      ...(abierto && tipo !== 'EXTRA' ? { isOpenPrice: true } : {}),
      ...(descripcion.trim() === '' ? {} : { description: descripcion }),
      ...(unidadDeVenta.trim() === '' || !porPiezaOServicio ? {} : { saleUnitName: unidadDeVenta }),
    };
    setTrabajando(true);
    const falla = await onGuardar(borrador);
    setTrabajando(false);
    if (falla !== null) {
      mostrarError(falla);
    }
  }

  return (
    <form
      className="formulario"
      onSubmit={(e) => {
        void guardar(e);
      }}
      aria-label={inicial === undefined ? t.formulario.tituloAlta : t.formulario.tituloEdicion}
    >
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      <Campo
        etiqueta={t.formulario.nombre}
        value={nombre}
        autoComplete="off"
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      <div className="formulario__par">
        <Seleccion
          etiqueta={t.formulario.categoria}
          value={categoriaId}
          opciones={ofrecidas.map((c) => ({ valor: c.id, texto: c.name }))}
          onChange={(e) => {
            setCategoriaId(e.target.value);
          }}
        />
        <Campo
          etiqueta={t.formulario.codigo}
          value={codigo}
          autoComplete="off"
          onChange={(e) => {
            setCodigo(e.target.value);
          }}
        />
      </div>
      <div className="formulario__par">
        <Seleccion
          etiqueta={t.formulario.tipo}
          value={tipo}
          opciones={(['CUSTOM', 'STANDARD', 'SERVICE', 'EXTRA'] as const).map((k) => ({
            valor: k,
            texto: t.tipos[k],
          }))}
          onChange={(e) => {
            setTipo(e.target.value as ProductKind);
          }}
        />
        <Seleccion
          etiqueta={t.formulario.unidad}
          value={unidad}
          opciones={UNIDADES_POR_TIPO[tipo].map((u) => ({ valor: u, texto: t.unidades[u] }))}
          onChange={(e) => {
            setUnidad(e.target.value as ChargeUnit);
          }}
        />
      </div>
      {unidad === 'LINEAR_METER' ? (
        <Seleccion
          etiqueta={t.formulario.baseLineal}
          value={base}
          opciones={[
            { valor: 'LENGTH', texto: t.formulario.largo },
            { valor: 'PERIMETER', texto: t.formulario.perimetro },
          ]}
          onChange={(e) => {
            setBase(e.target.value === 'PERIMETER' ? 'PERIMETER' : 'LENGTH');
          }}
        />
      ) : null}
      <div className="formulario__par">
        <CampoNumerico
          etiqueta={t.formulario.precio}
          value={precio}
          onChange={(e) => {
            setPrecio(e.target.value);
          }}
        />
        <CampoNumerico
          etiqueta={t.formulario.garantia}
          entero
          value={garantia}
          onChange={(e) => {
            setGarantia(e.target.value);
          }}
        />
      </div>
      {porPiezaOServicio ? (
        <div className="campo">
          <Campo
            etiqueta={t.formulario.unidadDeVenta}
            value={unidadDeVenta}
            maxLength={MAX_SALE_UNIT_LENGTH}
            autoComplete="off"
            list={idSugerencias}
            onChange={(e) => {
              setUnidadDeVenta(e.target.value);
            }}
          />
          <datalist id={idSugerencias}>
            {sugerencias.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <p className="formulario__ayuda">{t.formulario.unidadDeVentaAyuda}</p>
        </div>
      ) : null}
      {camposDeAjuste.length === 0 ? null : (
        <fieldset className="formulario__grupo">
          <legend>{t.formulario.ajustes}</legend>
          <p className="formulario__ayuda">{t.formulario.ajustesAyuda}</p>
          <div className="formulario__par">
            {camposDeAjuste.map((campo) => (
              <CampoNumerico
                key={campo}
                etiqueta={etiquetaDeAjuste(campo, unidad === 'LINEAR_METER' && base === 'LENGTH')}
                entero={campo !== 'minAreaMm2' && campo !== 'minAmountCents'}
                value={ajustes[campo]}
                onChange={(e) => {
                  const valor = e.target.value;
                  setAjustes((antes) => ({ ...antes, [campo]: valor }));
                }}
              />
            ))}
          </div>
        </fieldset>
      )}
      <label className="casilla">
        <input
          type="checkbox"
          checked={exento}
          onChange={(e) => {
            setExento(e.target.checked);
          }}
        />
        {t.formulario.exento}
      </label>
      <AreaDeTexto
        etiqueta={t.formulario.descripcion}
        value={descripcion}
        maxLength={MAX_DESCRIPTION_LENGTH}
        rows={3}
        onChange={(e) => {
          setDescripcion(e.target.value);
        }}
      />
      {tipo === 'EXTRA' ? null : (
        <label className="casilla">
          <input
            type="checkbox"
            checked={abierto}
            onChange={(e) => {
              setAbierto(e.target.checked);
            }}
          />
          <span>
            {t.formulario.precioAbierto}
            <span className="casilla__ayuda">{t.formulario.precioAbiertoAyuda}</span>
          </span>
        </label>
      )}

      <div className="formulario__par">
        <div className="campo">
          <CampoNumerico
            etiqueta={t.formulario.claveSat}
            entero
            value={claveSat}
            onChange={(e) => {
              setClaveSat(e.target.value);
            }}
          />
          <p className="formulario__ayuda">
            {t.formulario.claveHeredada(categoriaElegida?.fiscalDefaults.productServiceKey ?? null)}
          </p>
        </div>
        <div className="campo">
          <Campo
            etiqueta={t.formulario.claveUnidadSat}
            value={claveUnidad}
            autoComplete="off"
            maxLength={3}
            onChange={(e) => {
              setClaveUnidad(e.target.value);
            }}
          />
          <p className="formulario__ayuda">
            {t.formulario.claveHeredada(categoriaElegida?.fiscalDefaults.unitKey ?? null)}
          </p>
        </div>
      </div>

      {historial !== undefined && historial.length > 0 ? (
        <section aria-label={t.formulario.historial}>
          <h3 className="rotulo">{t.formulario.historial}</h3>
          <ul className="lineas">
            {[...historial].reverse().map((c) => (
              <li key={c.changedAt.toISOString()}>
                {formatearFecha(c.changedAt)} · {formatearPesos(c.oldPrice)} →{' '}
                {formatearPesos(c.newPrice)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="formulario__acciones">
        <Boton type="submit" disabled={trabajando}>
          {trabajando ? t.formulario.guardando : t.formulario.guardar}
        </Boton>
        <Boton variante="secundario" onClick={onCancelar}>
          {t.formulario.cancelar}
        </Boton>
      </div>
    </form>
  );
}
