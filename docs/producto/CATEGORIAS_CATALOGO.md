# Categorías del catálogo: investigación y propuesta

> **Estado:** propuesta del desarrollador (29 oct 2026) para validar con Luis. Parte de las categorías iniciales de RF-M1-02. **No es una regla del cliente:** todo aquí se puede cambiar desde el catálogo sin tocar código. Pendiente: PD-49.
> Los nombres de productos y precios de este documento son ejemplos; no hay datos reales de ZAMMIR [ADR-0010].

## Para qué sirve

S1-05 crea el catálogo con categorías iniciales. Como nadie del equipo de desarrollo conoce el giro a fondo, se investigó cómo se organiza una vidriería y cancelería de aluminio en México, para llevarle a Luis una propuesta que solo tenga que **corregir**, no escribir desde cero.

## Qué se encontró y qué tan firme es

| Tema | Hallazgo | Respaldo |
|---|---|---|
| Vidrio flotado o recocido | Es el vidrio base; de él salen el templado, el laminado y el espejo | Fuentes sólidas (tesis UNAM, fabricantes) |
| Templado | Tratamiento térmico que aumenta la resistencia; se rompe en trozos pequeños; para ventanales y puertas | Fuentes sólidas |
| Laminado | Vidrio de seguridad; evita entrada forzada; puede combinarse con templado | Fuentes sólidas. **No está en RF-M1-02** |
| Espejo | Se hace aplicando capas al flotado claro | Fuentes sólidas |
| Control solar y reflectivo | Los fabricantes (Vitro) venden tonos gris y bronce, reflectivos y decorativos | Catálogo de fabricante; para una vidriería chica es probable que sea poco relevante |
| Termopanel (doble acristalamiento) | Aparece como "vidrio insulado" | Fuente delgada |
| Esmerilado, satinado, arenado, catedral, martillado | No se encontraron fuentes confiables | **Conocimiento general del giro, sin respaldo: confirmar** |
| Aluminio | Se vende por **líneas** de perfil (Cuprum y otros muestran series con medidas de perfil en pulgadas, p. ej. 2" y 3") y como **sistemas**: ventanas fijas, corredizas y batientes, puertas, canceles de baño, pasamanos, fachadas | Catálogos de fabricantes; el detalle de líneas no se pudo confirmar |
| Herrajes | Bisagras (vidrio-vidrio, muro-vidrio, de piso), chapas, jaladeras, carretillas y conectores para canceles corredizos, contras y clips | Catálogo de fabricante (Herralum) |
| Accesorios de cancelería | Felpa, vinil, junquillo, escuadras, cremonas, cerraderos, selladores | Catálogos y cotizaciones de usuarios |
| Productos armados | Canceles de baño, mamparas, barandales de cristal, puertas de cristal templado, domos y marquesinas, espejos | Vidrierías de CDMX, Estado de México y Puebla |
| Plásticos | Las vidrierías y los distribuidores venden acrílico (transparente, de color, espejo) y policarbonato (sólido y celular) en hoja, con corte a medida | Directorios de proveedores |
| Servicios | Medición, corte, instalación, retiro, reposición de cristal, reparación | Sitios de vidrierías |
| Cantos pulidos, perforaciones, biselado | No se encontraron fuentes. **En el sistema son cargos adicionales de la regla de precio** (RN-02), no productos | Conocimiento del giro: confirmar |
| Vitropiso | No se encontraron proveedores en México | Se deja fuera |

## Propuesta de categorías

Las 11 de RF-M1-02 más 3 que la investigación sugiere. Marcadas con **NUEVA** las que no estaban.

| # | Categoría | Qué incluye (ejemplos) | Tipo y cobro típico (RN-01) |
|---|---|---|---|
| 1 | Vidrio claro / flotado | Claro por espesor; tintados (bronce, gris, verde, azul) | A medida, por m² |
| 2 | Vidrio templado | Claro y tintado; piezas para puertas, canceles y barandales | A medida, por m² |
| 3 | Vidrio laminado **NUEVA** | Laminado claro o de color | A medida, por m² |
| 4 | Esmerilado / satinado | Esmerilado, satinado, arenado | A medida, por m² |
| 5 | Decorado / emplomado | Catedral, martillado, emplomado, otros decorados | A medida, por m² |
| 6 | Espejo | Claro y tintado | A medida, por m² |
| 7 | Cristal doble / termopanel | Doble acristalamiento con cámara | A medida, por m² |
| 8 | Acrílico y policarbonato **AMPLÍA RF-M1-02** | Acrílico transparente, de color y espejo; policarbonato sólido y celular | A medida, por m² |
| 9 | Aluminio y cancelería | Perfiles por línea; ventanas, puertas, canceles de baño, fachadas | A medida (m², metro lineal) o pieza estándar |
| 10 | Canceles, mamparas y barandales **NUEVA** | Cancel de baño, mampara, barandal de cristal, puerta de cristal templado, domo | Pieza estándar o a medida; depende de cómo lo cotice ZAMMIR |
| 11 | Herrajes y accesorios | Bisagras, chapas, jaladeras, carretillas, conectores, cremonas, felpa, vinil, junquillo, escuadras | Pieza o metro lineal |
| 12 | Selladores y silicón | Silicón, sellador acrílico, pegamentos | Pieza |
| 13 | Servicios | Medición, instalación, retiro, reposición de cristal, flete | Visita o unidad |
| 14 | Otros | Para lo que no encaje; se revisa cada mes | Cualquiera |

## Lo que **no** son categorías (para no multiplicar el catálogo)

- **Espesor** (3, 4, 5, 6, 8, 10, 12 mm…): es un dato del producto, no una categoría. Cada espesor es un producto distinto con su precio.
- **Color o tono** y **acabado del aluminio** (natural, blanco, bronce…): datos del producto.
- **Cantos pulidos, perforaciones, biselado, grabado:** cargos adicionales de la regla de precio (RN-02, PD-02), no productos.
- **Línea de aluminio** (2", 3"…): dato del producto o subcategoría, según lo que prefiera Luis.

## Preguntas para Luis (máximo 7, de opción rápida)

1. ¿Venden **vidrio laminado**? (sí / no)
2. ¿Venden **acrílico o policarbonato**? (sí / no)
3. **Canceles de baño, mamparas y barandales:** ¿se cotizan como producto armado con un solo precio, o se cobra el vidrio más los herrajes por separado?
4. **Cantos pulidos, perforaciones, biselados:** ¿se cobran aparte o van incluidos en el precio del vidrio?
5. **Aluminio:** ¿venden también **perfil suelto** (por tramo) o solo cancelería armada?
6. **Herrajes y accesorios:** ¿les sirve verlos juntos en una sola categoría o prefieren separarlos?
7. ¿Falta alguna categoría que manejen y no aparece aquí?

## Fuentes consultadas

- Tesis y documentos de la UNAM sobre vidrio en edificación: <https://ru.dgb.unam.mx/bitstream/20.500.14330/TES01000220216/3/0220216.pdf>
- Catálogos de Vitro Vidrio Arquitectónico: <https://www.vitroglazings.com/media/sownqqvz/vitro-arquitectonico-catalogo-2024.pdf>
- Cuprum, catálogo Panorama 2024-2025 (perfiles): <https://cuprum.com/wp/wp-content/uploads/2024/12/Catalogo-Panorama-Solo-Perfiles-2024-2025-V_241016.pdf>
- Cuprum, manual de armado de la serie 1400: <https://cuprum.com/wp/wp-content/uploads/2023/09/1400-–-Manual-de-Armado-V_250410.pdf>
- Herralum, catálogo 2025 (herrajes y accesorios): <https://herralum.com/assets/files/herralum_2025.pdf>
- Herralum, herrajes negros: <https://herralum.com/assets/files/2027_Folleto_Herrajes Negros.pdf>
- Vidrierías y canceles en CDMX, Estado de México y Puebla: <https://www.cronoshare.com.mx/croner-380565-vidrieria-y-canceleria-de-aluminio-de-puebla>, <https://www.cronoshare.com.mx/croner-733207-ventan45>
- Acrílico y policarbonato en hoja: <https://www.cosmos.com.mx/producto/hoja-mn41/hoja-de-policarbonato-hlwn/hoja-de-policarbonato-plasticos-beraca-gmdxi4444.html>
- Cómo elegir la clave SAT de producto o servicio: <https://www.facturadorelectronico.com/blog/?p=4621>

## Pendiente fiscal

Las claves SAT de producto o servicio, de unidad y el objeto de impuesto de cada categoría **no se asignan aquí**: se validan con el contador o el PAC (PD-29). S1-05 usa valores de prueba.
