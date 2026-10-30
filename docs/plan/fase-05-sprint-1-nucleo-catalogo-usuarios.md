# Fase 5 — Sprint 1: Núcleo del dominio, catálogo, clientes y usuarios

- **Tipo:** código
- **Fechas:** 2 – 8 de noviembre de 2026
- **Lee antes:** [`00-principios-de-ingenieria.md`](00-principios-de-ingenieria.md), `REGLAS_DE_NEGOCIO.md` (RN-01 a RN-07, RN-18, RN-19), `MODELO_DE_DATOS.md`, `AUTENTICACION.md`

## Objetivo

Construir la base de la que depende todo lo demás: **el dinero que nunca se equivoca**, las reglas de precio, un catálogo limpio, la ficha de clientes y la entrada de los empleados con PIN.

## Entra si

- Sprint 0 cerrado con su compuerta en verde.
- ADR de redondeo aceptado y tabla de casos de oro validada por Juanito (Fase 2).

## Alcance

### 5.1 Núcleo del dominio (`packages/core`)
- **`Money`**: centavos enteros, suma, resta, multiplicación por cantidad, comparación, formato en pesos mexicanos. Sin flotantes en ningún paso [RN-05].
- **Medidas**: ancho, alto y largo en **milímetros enteros**, con conversión desde lo que captura el usuario (cm o m). Área en mm² enteros. Así ni las medidas ni el área pasan por flotantes [RN-04].
- **`TaxCalculator`**: desglose de IVA a partir de precios con IVA incluido, productos exentos, tasa desde configuración, con el algoritmo del ADR de redondeo [RN-06, RN-07, ADR-0004].
- **Reglas de precio** [RN-02, ADR-0006]:
  - Interfaz común: recibe medidas, cantidad y parámetros; devuelve importe y detalle legible del cálculo.
  - Reglas iniciales: por m², por metro lineal, por pieza, por servicio. Todas con los parámetros previstos (área mínima, redondeo de medida, mínimo) **apagados por defecto** hasta tener datos (PD-02).
  - Registro de reglas: una regla nueva se agrega sin tocar las existentes.
  - ⚠ PD-21: cómo se mide el metro lineal (largo capturado o perímetro). Se implementa configurable.

### 5.2 Catálogo — M1
- RF-M1-01 a RF-M1-06. RF-M1-07 (existencias) se construye en el Sprint 3, detrás del interruptor P2.
- Alta, edición y desactivación por administrador; nunca se borra.
- Categorías iniciales de RF-M1-02 con sus datos fiscales predeterminados (valores de prueba hasta tener los reales).
- Búsqueda tolerante a acentos y mayúsculas, con filtros.
- Importación desde CSV o Excel con plantilla descargable y vista previa de errores por fila. El comportamiento ante filas inválidas se define en la historia (Fase 3) y se documenta.
- Historial de cambios de precio.
- **Copia del catálogo en la tablet**, para que el cotizador funcione sin conexión en el Sprint 2.

### 5.3 Clientes — M5 (primera parte)
- RF-M5-01 ficha, RF-M5-04 búsqueda y aviso de duplicados por teléfono, RF-M5-05 anonimización.
- Validación de teléfono y, si se captura, del formato de RFC.
- RF-M5-02 (historial) y RF-M5-03 (cliente recurrente) se completan en el Sprint 3, cuando existan órdenes y ventas.

### 5.4 Legal — M9 (lo que necesitan los clientes)
- Aviso de privacidad con versión y fecha, editable por administradores, con el borrador base [RF-M9-01].
- Al capturar un cliente, registrar qué versión del aviso se le informó [RF-M9-03].
- El resto de M9 se completa en el Sprint 4.

### 5.5 Usuarios y acceso — M8
- RF-M8-01: crear, editar y desactivar usuarios; asignar rol y PIN; restablecer PIN.
- Entrada de empleados con PIN de 4 a 6 dígitos, guardado con hash, **solo en dispositivos registrados** [DC §4].
- Cambio de usuario en un toque y bloqueo por inactividad configurable [RF-M4-08].
- Autorización puntual de un administrador con su PIN para acciones restringidas (se usará en descuentos, entregas con saldo y facturación).
- Política de permisos del dominio que implementa la matriz de `REQUERIMIENTOS.md`, más las RLS equivalentes en la base de datos.
- RF-M8-03: pantalla de bitácora consultable.
- RF-M8-04: sin límite técnico de usuarios; capacidad prevista de 2 administradores y 3 a 5 empleados.

## Fuera de esta fase

- Cotizaciones, sincronización de documentos y folios (Sprint 2).
- Existencias (Sprint 3, P2).

## Diseño

- **S:** `Money` solo hace aritmética; `TaxCalculator` solo desglosa; cada regla de precio solo calcula su caso; el formato a texto vive aparte.
- **O:** reglas de precio como estrategias registradas [ADR-0006].
- **L:** batería de contrato de repositorios de productos, clientes y usuarios (memoria, IndexedDB donde aplique, Supabase).
- **I:** `ProductReader` (lo que necesita el cotizador) separado de `ProductAdmin` (lo que necesita la administración del catálogo).
- **D:** `PermissionPolicy` es dominio puro; la interfaz y la base de datos solo la consultan o la reflejan.

## Entregables

- `packages/core` con dinero, medidas, impuestos, reglas de precio y permisos, al 100% de cobertura.
- Pantallas de Catálogo, Clientes, Usuarios, Dispositivos y Bitácora.
- Entrada con PIN y cambio de usuario en la tablet.
- Catálogo disponible sin conexión.

## Pruebas obligatorias

**Dinero** (100% cobertura, mutación ≥ 90%)
- [ ] Suma, resta y multiplicación con centavos; resultados exactos.
- [ ] Rechazo de montos no enteros en centavos y de valores fuera de rango seguro.
- [ ] Formato en pesos: `$1,234.56`, cero, montos grandes.
- [ ] Propiedades: la suma es conmutativa y asociativa; sumar y restar el mismo monto regresa al original.

**Medidas**
- [ ] Conversión de cm y m a mm, incluidos decimales capturados (`1.255 m`, `125.5 cm`) sin pasar por flotantes en el resultado.
- [ ] Rechazo de medidas cero, negativas o absurdamente grandes (límite configurable).
- [ ] Área en mm² para combinaciones típicas y extremas.

**IVA** (100% cobertura, mutación ≥ 90%)
- [ ] **Toda la tabla de casos de oro** pasa exactamente.
- [ ] Propiedad: para cualquier conjunto de líneas, subtotal + IVA = total al centavo.
- [ ] Propiedad: el total del documento con IVA incluido nunca cambia por el desglose.
- [ ] Producto exento: IVA cero, total igual a subtotal.
- [ ] Documento mixto con productos exentos y gravados.

**Reglas de precio** (100% cobertura, mutación ≥ 90%)
- [ ] Por m²: casos de la tabla de oro con varias medidas y cantidades.
- [ ] Por metro lineal, por pieza y por servicio.
- [ ] Con área mínima, redondeo de medida y mínimo **encendidos** en pruebas, aunque en producción estén apagados.
- [ ] Parámetros inválidos rechazados con error tipado.
- [ ] Regla no registrada: error tipado, no excepción silenciosa.
- [ ] El detalle legible coincide con el importe (`1.20 m × 0.80 m = 0.96 m² × $280.00 = $268.80`).
- [ ] Agregar una regla de prueba nueva no requiere modificar ninguna existente (prueba de registro).

**Catálogo**
- [ ] Contrato de repositorio de productos.
- [ ] Búsqueda: "vidrio" encuentra "Vídrio"; "TEMPLADO" encuentra "templado"; filtros por categoría y tipo combinados.
- [ ] Desactivar oculta el producto en búsquedas de venta pero lo conserva en el historial.
- [ ] **Ningún rol puede borrar un producto** (RLS y caso de uso).
- [ ] Cambiar un precio guarda historial y entrada de bitácora con valor anterior y nuevo.
- [ ] Un cajero no puede editar catálogo ni precios.
- [ ] Importación: archivo válido; archivo con filas inválidas (precio negativo, categoría inexistente, código duplicado, columnas faltantes, codificación con acentos); la vista previa muestra cada error con su fila.
- [ ] Extremo a extremo: con la red cortada, el catálogo se puede consultar en la tablet.

**Clientes**
- [ ] Nombre y WhatsApp obligatorios; el resto opcional.
- [ ] Aviso de duplicado al capturar un teléfono existente, con distintos formatos del mismo número.
- [ ] RFC con formato inválido rechazado; vacío permitido.
- [ ] Se guarda la versión del aviso de privacidad informada.
- [ ] Anonimizar borra datos personales, conserva los registros contables y deja bitácora.

**Usuarios y acceso**
- [ ] El PIN nunca se guarda en claro (prueba que inspecciona lo guardado).
- [ ] PIN correcto en dispositivo registrado: entra. En dispositivo no registrado o revocado: no entra.
- [ ] PIN de usuario desactivado: no entra.
- [ ] Bloqueo tras el tiempo de inactividad configurado (con reloj fijo).
- [ ] Cambio de usuario: las acciones posteriores quedan atribuidas al nuevo usuario.
- [ ] Autorización de administrador por PIN: correcta, incorrecta, PIN de cajero rechazado.
- [ ] **Matriz de permisos completa:** una prueba por cada fila y cada rol de la matriz de `REQUERIMIENTOS.md`, en el dominio y en RLS.
- [ ] Todas las acciones sensibles de este sprint generan bitácora.

**Manual en tablet**
- [ ] Entrar con PIN, cambiar de usuario, esperar el bloqueo.
- [ ] Buscar en el catálogo en modo avión.

## Compuerta de salida

- [ ] Compuerta común de [00 §5.2] en verde.
- [ ] Dinero, IVA y reglas de precio al 100% de cobertura de líneas y ramas, mutación ≥ 90%.
- [ ] La tabla de casos de oro completa pasa.
- [ ] Matriz de permisos probada fila por fila.

## Riesgos y pendientes

- PD-02 (reglas reales), PD-03 (catálogo real), PD-17 (permisos de administradores), PD-21 (metro lineal).
- El manejo del PIN sin conexión sigue lo decidido en `AUTENTICACION.md`; si en pruebas resulta inseguro o incómodo, se detiene y se replantea con Juanito.
