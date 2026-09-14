import {
  businessDateInPeru,
  startOfDayPeru,
  toPeruIso,
  utcDatabaseDateTime,
} from './timezone.util';

describe('timezone.util', () => {
  it('calcula el día de negocio de Perú aunque UTC ya cambió de día', () => {
    const instant = new Date('2026-09-14T03:30:00.000Z');
    expect(businessDateInPeru(instant)).toBe('2026-09-13');
    expect(toPeruIso(instant)).toBe('2026-09-13T22:30:00.000-05:00');
  });

  it('calcula correctamente el inicio de día de Perú como instante UTC', () => {
    expect(startOfDayPeru(new Date('2026-09-13T17:00:00Z')).toISOString())
      .toBe('2026-09-13T05:00:00.000Z');
  });

  it('genera un valor UTC explícito para columnas DATETIME técnicas', () => {
    expect(utcDatabaseDateTime(new Date('2026-09-13T17:12:13.456Z')))
      .toBe('2026-09-13 17:12:13.456');
  });
});
