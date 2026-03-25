import moment from 'moment-timezone';

// Siempre devuelve Date en hora Perú (pero guardado en UTC correctamente)
export const nowInPeru = (): Date => {
  return new Date();
};

// Inicio del día en Perú
export const startOfDayPeru = (): Date => {
  return moment().tz('America/Lima').startOf('day').toDate();
};

// Convertir a string en hora Perú (para frontend)
export const toPeruTime = (date?: Date | null): string | null => {
  if (!date) return null;
  return moment(date).tz('America/Lima').format('YYYY-MM-DD HH:mm:ss');
};