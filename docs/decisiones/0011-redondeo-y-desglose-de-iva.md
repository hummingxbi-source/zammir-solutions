# ADR-0011: Redondeo y desglose de IVA

- **Estado:** Aceptada el 2026-10-26 (desglose por línea, mitad hacia arriba, anticipo hacia arriba). Queda por verificar la tolerancia del PAC (§7, PD-01/PD-05)
- **Fecha:** 2026-10-26
- **Decide:** Juanito
- **Completa:** [ADR-0004], [RN-05], [RN-06], [RN-07]

## Contexto

Los precios incluyen IVA [ADR-0004]. Al desglosar (dividir entre 1.16) aparecen fracciones de centavo, y redondear en lugares distintos hace que ticket, PDF y factura difieran por un centavo [RN-07]. Hay que fijar **dónde** y **cómo** se redondea.

## Decisión propuesta

Toda la aritmética vive en `packages/core/shared-kernel` (`Money`, `TaxCalculator`), en **enteros de centavos**, sin flotantes. Medidas en **milímetros enteros**.

1. **Regla de redondeo:** mitad hacia arriba (`0.5 → 1`), solo con aritmética entera: `redondear(n / d) = floor((2n + d) / 2d)`.
2. **Importe de una línea:** `precio_por_unidad × medidas × cantidad`, redondeado **una sola vez**, al final, a centavos. Ninguna medida ni resultado intermedio se redondea [RN-02: la regla básica no tiene redondeos; los de medidas serán parámetros de la regla de precio, PD-02].
3. **El total de una línea es la verdad.** Total del documento = suma de totales de línea. Nunca se recalcula desde un subtotal.
4. **Desglose por línea (no por documento):** `base_línea = redondear(total_línea × 100 / 116)` e `IVA_línea = total_línea − base_línea`. El IVA se obtiene **por resta**, así `base + IVA = total` siempre, al centavo.
5. **Subtotal del documento = suma de bases de línea; IVA del documento = suma de IVA de línea.** Ticket, PDF y factura leen estos mismos números; ninguno los recalcula.
6. **Producto exento:** `base = total`, `IVA = 0`.
7. La tasa (16%) y el porcentaje de anticipo son configuración, no literales.
8. **Anticipo:** `anticipo = redondear_hacia_arriba(total × porcentaje)` (techo, a centavos enteros) y `saldo = total − pagos recibidos`, siempre por resta. Así anticipo + saldo = total.

## Por qué por línea

- El CFDI informa base e impuesto **por concepto**; si el sistema desglosa por línea, los números del comprobante son los mismos que los de la factura.
- Desglosar por documento da un resultado distinto en ciertos casos (ver casos D1 y D2 de los casos de oro: diferencia de 1 centavo). Con el desglose por línea, la suma de lo que se ve en cada renglón siempre coincide con el pie del documento.

## Riesgo abierto — verificar con el PAC (PD-01 §7, PD-05)

Con el desglose por resta, el IVA de una línea puede diferir en 1 centavo de `redondear(base × 16%)`, que es como el CFDI suele calcular el impuesto de un concepto. En un barrido de totales de 1.00 a 999.99 pesos, **cerca del 14% de los totales** no se pueden reproducir exactamente con la fórmula `base + redondear(base × 16%)`.

Esto no se puede resolver sin conocer la tolerancia que acepta el PAC y el SAT. **No se supone:** se confirma con §7 y el sandbox del PAC. Si hubiera que ajustar, el cambio queda dentro de `TaxCalculator` y de los casos de oro, sin tocar UI ni base de datos [ADR-0007].

## Alternativas consideradas

- **Desglose por documento:** más simple, pero no coincide con la estructura por concepto del CFDI.
- **Redondear precios unitarios a centavos antes de multiplicar:** acumula error en piezas con muchas unidades.
- **Redondeo bancario (mitad al par):** estadísticamente neutro, pero distinto del que espera un cliente al verificar a mano.

## Consecuencias

- `Money`, `TaxCalculator` y las reglas de precio tienen 100% de cobertura y mutación ≥ 90% [principios §4.2].
- Una propiedad de pruebas (fast-check): para cualquier lista de líneas, `subtotal + IVA = total`.
- El anticipo se redondea hacia arriba (decisión de Juanito, 2026-10-26); lo registra también RN-08.
