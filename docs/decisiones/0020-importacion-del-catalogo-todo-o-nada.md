# ADR-0020: Importación del catálogo: todo o nada, primero CSV

- **Estado:** Aceptada (propuesta por el desarrollador; Juanito puede cambiarla)
- **Fecha:** 2026-10-30
- **Decide:** Juanito (propuesta del desarrollador)

## Contexto

RF-M1-05 pide importar el catálogo real (50 a 150 productos) desde CSV o Excel, con plantilla descargable y vista previa de errores por fila. La historia S1-08 deja por decidir qué hacer con las filas inválidas y debe documentarlo en la historia y en la pantalla.

## Decisión

1. **Todo o nada.** Si una sola fila tiene un error, **no se importa ninguna**. La vista previa muestra cada error con su fila y su columna; la persona corrige el archivo y lo vuelve a subir.
   - Razón: evita un catálogo a medias y duplicados al volver a subir el mismo archivo; con 50 a 150 filas corregir es rápido; un precio mal importado es un error de dinero.
   - En la base, la importación es **una sola instrucción** (`createMany`): se guardan todos los productos o ninguno.
2. **La vista previa no guarda nada.** Importar exige confirmar después de ver la lista.
3. **Mismas reglas que el alta a mano.** Cada fila pasa por `buildProduct` (tipo con unidad, regla con unidad, parámetros de la regla, formato fiscal), así que un producto importado cumple lo mismo que uno capturado.
4. **Precios en pesos leídos como texto** (`parseMoney`): `280`, `280.5`, `"$1,234.56"` pasan a centavos sin números de coma flotante [RN-05]. Más de dos decimales se rechaza.
5. **CSV UTF-8 primero.** La plantilla se descarga en CSV UTF-8 con marca BOM para que Excel respete los acentos; el lector acepta coma o punto y coma y avisa si el archivo no está en UTF-8. **Leer `.xlsx` directamente queda pendiente**: hace falta agregar una biblioteca (no SheetJS de npm, por avisos de seguridad) y probarla con archivos reales. Mientras tanto, Excel guarda como "CSV UTF-8".
6. **El metro lineal pide su base** (`largo` o `perímetro`) en una columna, sin valor por omisión (PD-25).

## Consecuencias

- La carga del catálogo real de Luis (PD-03) se hace por esta vía, sin tocar código.
- Si más adelante se quiere importar "lo válido y omitir lo inválido", es un cambio de producto y de este ADR; la vista previa ya identifica cada fila.
- Pendiente: lectura directa de `.xlsx` (nuevo ADR de herramientas al elegir la biblioteca).
