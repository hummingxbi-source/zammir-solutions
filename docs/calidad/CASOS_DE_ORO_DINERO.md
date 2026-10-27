# Casos de oro de dinero

> **Método aprobado por Juanito el 2026-10-26** [ADR-0011]; los valores de IVA siguen sujetos a la verificación con el PAC. Esta tabla es la referencia de verdad: si el código y la tabla no coinciden, gana la tabla [principios §4.3 punto 7].
> Todos los datos son inventados [ADR-0010]. Importes en **centavos** (la columna "pesos" es solo para leer). Medidas en **milímetros**.
> Fórmulas: `línea = redondear(precio_m² × ancho × alto × cantidad / 1 000 000)`; `base = redondear(total × 100 / 116)`; `IVA = total − base`. Redondeo: mitad hacia arriba.

## Líneas (cálculo de importe)

| # | Caso | Precio (c/m²) | Ancho × alto (mm) | Cant. | Total línea (c) | Pesos |
|---|---|---|---|---|---|---|
| L1 | Pieza exacta | 85 000 | 1 000 × 1 500 | 1 | 127 500 | 1 275.00 |
| L2 | Medidas con fracción | 92 000 | 835 × 1 213 | 3 | 279 548 | 2 795.48 |
| L3 | Mitad exacta de centavo (5 000.5 → 5 001) | 10 001 | 500 × 1 000 | 1 | 5 001 | 50.01 |
| L4 | Pieza estándar, 3 unidades | 45 000 por pieza | — | 3 | 135 000 | 1 350.00 |

## Desglose de IVA por línea

| # | Total línea (c) | Base (c) | IVA (c) | Comprobación base + IVA |
|---|---|---|---|---|
| T1 (de L1) | 127 500 | 109 914 | 17 586 | 127 500 |
| T2 (de L2) | 279 548 | 240 990 | 38 558 | 279 548 |
| T3 (de L3) | 5 001 | 4 311 | 690 | 5 001 |
| T4 (de L4) | 135 000 | 116 379 | 18 621 | 135 000 |
| T5 exento | 10 000 | 10 000 | 0 | 10 000 |
| T6 mínimo | 1 | 1 | 0 | 1 |

## Documentos completos (por qué desglosar por línea)

| # | Líneas (c) | Total | Σ bases por línea | IVA por línea | Base si se desglosara por documento | Diferencia |
|---|---|---|---|---|---|---|
| D1 | 10 037 · 10 074 · 10 111 · 10 148 · 10 185 · 10 222 · 10 259 | 71 036 | **61 237** | **9 799** | 61 238 | 1 centavo |
| D2 | 5 · 5 · 5 | 15 | **12** | **3** | 13 | 1 centavo |

Detalle de D1 (base / IVA por línea): 8 653 / 1 384 · 8 684 / 1 390 · 8 716 / 1 395 · 8 748 / 1 400 · 8 780 / 1 405 · 8 812 / 1 410 · 8 844 / 1 415.

**Con el método propuesto, el documento D1 muestra subtotal 612.37, IVA 97.99 y total 710.36.**

## Anticipo

| # | Total (c) | 50% | Anticipo (c) | Saldo (c) |
|---|---|---|---|---|
| A1 | 127 500 | 63 750 | 63 750 | 63 750 |
| A2 | 12 345 | 6 172.5 | **6 173** (hacia arriba) | 6 172 |

## Decisiones tomadas (2026-10-26)

1. Redondeo **mitad hacia arriba** (L3).
2. Desglose de IVA **por línea**; D1 y D2 son pruebas obligatorias.
3. Anticipo **redondeado hacia arriba**; saldo por resta (A2).

## Pendiente

- Casos con reglas de precio no básicas (mínimos, cargos extra): dependen de PD-02.
- Los valores de IVA de T1 a T6 se confirman contra el sandbox del PAC [ADR-0011].
