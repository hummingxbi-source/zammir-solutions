/** "Buenos días", "Buenas tardes" o "Buenas noches" según la hora en México [RN-17]. */
export function saludoDeLaHora(instante: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(instante),
  );
  if (hora < 12) {
    return 'Buenos días';
  }
  return hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}
