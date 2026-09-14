import moment from 'moment-timezone';

export const BUSINESS_TIME_ZONE = 'America/Lima';

/**
 * Un Date siempre representa un instante UTC. Esta función se conserva por
 * compatibilidad; las reglas de día comercial deben usar businessDateInPeru.
 */
export const nowInPeru = (): Date => {
  return new Date();
};

// Inicio del día en Perú
export const startOfDayPeru = (instant: Date = new Date()): Date => {
  return moment(instant).tz(BUSINESS_TIME_ZONE).startOf('day').toDate();
};

export const businessDateInPeru = (instant: Date = new Date()): string =>
  moment(instant).tz(BUSINESS_TIME_ZONE).format('YYYY-MM-DD');

export const utcDatabaseDateTime = (instant: Date = new Date()): string =>
  moment.utc(instant).format('YYYY-MM-DD HH:mm:ss.SSS');

export const toPeruIso = (instant: Date = new Date()): string =>
  moment(instant).tz(BUSINESS_TIME_ZONE).format('YYYY-MM-DDTHH:mm:ss.SSSZ');

// Convertir un instante a representación legible de Perú.
export const toPeruTime = (date?: Date | null): string | null => {
  if (!date) return null;
  return moment(date).tz(BUSINESS_TIME_ZONE).format('YYYY-MM-DD HH:mm:ss');
};
