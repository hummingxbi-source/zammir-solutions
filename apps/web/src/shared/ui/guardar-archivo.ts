export interface ArchivoParaGuardar {
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

/** Entrega un archivo a la persona: lo baja con el nombre indicado. */
export function guardarArchivoEnElNavegador(archivo: ArchivoParaGuardar): void {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(archivo.bytes)], { type: archivo.mimeType }),
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.name;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
