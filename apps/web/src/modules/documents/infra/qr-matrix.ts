import QRCode from 'qrcode';

/** Matriz de módulos de un código QR (true = oscuro) para dibujarlo en el PDF. Corrige errores al nivel
 *  M: aguanta una impresión un poco manchada. */
export function qrMatrix(texto: string): boolean[][] {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const lado = qr.modules.size;
  const filas: boolean[][] = [];
  for (let i = 0; i < lado; i += 1) {
    const fila: boolean[] = [];
    for (let j = 0; j < lado; j += 1) {
      fila.push(qr.modules.get(i, j) === 1);
    }
    filas.push(fila);
  }
  return filas;
}
