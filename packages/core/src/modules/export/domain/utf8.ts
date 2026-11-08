/** Un texto como bytes UTF-8. El núcleo no depende del navegador ni de Node, así que no usa `TextEncoder`.
 *  Un carácter suelto sin pareja (un "surrogate" roto) se escribe como U+FFFD, igual que hace `TextEncoder`. */
export function encodeUtf8(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const c = caracter.codePointAt(0) ?? 0xfffd;
    const cp = c >= 0xd800 && c <= 0xdfff ? 0xfffd : c;
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}
