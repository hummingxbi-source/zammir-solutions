/** Marca de orden de bytes que Excel pone al inicio de un CSV en UTF-8 (U+FEFF). */
const BOM = String.fromCharCode(0xfeff);

/** El separador de columnas: Excel en español de México guarda con coma, pero en otras configuraciones
 *  usa punto y coma. Se elige el que más aparece en la primera línea, fuera de comillas. */
function detectarSeparador(primeraLinea: string): ',' | ';' {
  let comas = 0;
  let puntosYComas = 0;
  let entreComillas = false;
  for (const caracter of primeraLinea) {
    if (caracter === '"') {
      entreComillas = !entreComillas;
    } else if (!entreComillas && caracter === ',') {
      comas += 1;
    } else if (!entreComillas && caracter === ';') {
      puntosYComas += 1;
    }
  }
  return puntosYComas > comas ? ';' : ',';
}

/** Lee un archivo CSV (UTF-8, con o sin marca BOM) y devuelve sus filas de celdas. Entiende comillas
 *  (`"a,b"`, `""` para una comilla) y saltos de línea dentro de comillas; ignora las filas vacías.
 *  Los acentos se conservan tal cual: el texto ya viene decodificado. */
export function parseCsv(contenido: string): string[][] {
  const texto = contenido.startsWith(BOM) ? contenido.slice(BOM.length) : contenido;
  const separador = detectarSeparador(texto.split(/\r?\n/, 1)[0] ?? '');

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;

  const cerrarCelda = (): void => {
    fila.push(celda);
    celda = '';
  };
  const cerrarFila = (): void => {
    cerrarCelda();
    if (fila.some((c) => c.trim() !== '')) {
      filas.push(fila);
    }
    fila = [];
  };

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto.charAt(i);
    if (entreComillas) {
      if (caracter === '"' && texto.charAt(i + 1) === '"') {
        celda += '"';
        i += 1;
      } else if (caracter === '"') {
        entreComillas = false;
      } else {
        celda += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === separador) {
      cerrarCelda();
    } else if (caracter === '\n') {
      cerrarFila();
    } else if (caracter !== '\r') {
      celda += caracter;
    }
  }
  cerrarFila();
  return filas;
}
