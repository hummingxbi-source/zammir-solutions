# ADR-0004: Los precios del catálogo incluyen IVA

- **Estado:** Aceptada. El algoritmo de redondeo queda como Propuesta hasta la Fase 2.
- **Fecha:** 2026-10-26
- **Decide:** Juanito, con información de Luis

## Contexto

El documento dejaba abierto si los precios incluyen IVA [DC §5.6]. Juanito confirmó que **los precios de ZAMMIR ya incluyen IVA**.

Ticket, PDF y factura deben coincidir al centavo [DC §5.6]. Al sacar el IVA de un precio que ya lo incluye (dividir entre 1.16) aparecen decimales, y redondear en lugares distintos produce diferencias de un centavo.

## Decisión

- El precio de catálogo se guarda tal cual, con IVA incluido, en centavos.
- La tasa (16%) es un ajuste global del negocio; un producto puede marcarse exento.
- El desglose (subtotal e IVA) se calcula solo cuando un documento lo necesita.
- **Toda** la aritmética de dinero e impuestos vive en un único módulo del dominio, sin dependencias de interfaz ni de base de datos, con pruebas automáticas desde el Sprint 0.

**Pendiente (Fase 2):** definir en un ADR el algoritmo exacto de redondeo (por línea o por documento) y cómo cuadra contra el CFDI.

## Consecuencias

- Ningún componente de interfaz, función de base de datos ni adaptador calcula IVA por su cuenta.
- Las pruebas del módulo de dinero incluyen casos con muchos conceptos y montos que provocan diferencias de redondeo.
