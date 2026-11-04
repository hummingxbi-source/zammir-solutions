import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  parseMoney,
  type Category,
  type ChargeUnit,
  type PriceChange,
  type Product,
  type ProductDraft,
  type ProductKind,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
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
  /** Guarda el producto; devuelve el código de error o `null` si se guardó. */
  readonly onGuardar: (borrador: ProductDraft) => Promise<string | null>;
  readonly onCancelar: () => void;
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
  onGuardar,
  onCancelar,
}: FormularioDeProductoProps): ReactElement {
  const [nombre, setNombre] = useState(inicial?.name ?? '');
  const [codigo, setCodigo] = useState(inicial?.code ?? '');
  const [categoriaId, setCategoriaId] = useState<string>(
    inicial?.categoryId ?? categorias[0]?.id ?? '',
  );
  const [tipo, setTipo] = useState<ProductKind>(inicial?.kind ?? 'CUSTOM');
  const [unidad, setUnidad] = useState<ChargeUnit>(inicial?.chargeUnit ?? 'SQUARE_METER');
  const [base, setBase] = useState<'LENGTH' | 'PERIMETER'>(() => {
    const parametros = inicial?.ruleParams as { basis?: string } | undefined;
    return parametros?.basis === 'PERIMETER' ? 'PERIMETER' : 'LENGTH';
  });
  const [precio, setPrecio] = useState(inicial === undefined ? '' : pesosATexto(inicial.listPrice));
  const [exento, setExento] = useState(inicial?.isTaxExempt ?? false);
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
    const mismaUnidad = inicial?.chargeUnit === unidad;
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
      ruleParams:
        unidad === 'LINEAR_METER' ? { basis: base } : mismaUnidad ? inicial.ruleParams : {},
      fiscal: inicial?.categoryId === categoria.id ? inicial.fiscal : categoria.fiscalDefaults,
      warrantyMonths: meses,
      warrantyText: inicial?.warrantyText ?? null,
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
          opciones={categorias.map((c) => ({ valor: c.id, texto: c.name }))}
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
          opciones={(['CUSTOM', 'STANDARD', 'SERVICE'] as const).map((k) => ({
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
