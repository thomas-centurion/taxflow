import { addDays, calendarDate, daysBetween, fileSize, personName, relativeDays, todayKey } from './format';

describe('date presentation helpers', () => {
  it('builds the local calendar key without timezone conversion', () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole calendar days, also across daylight saving changes', () => {
    expect(daysBetween('2026-10-08', '2026-10-15')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('describes due dates relative to today', () => {
    const today = '2026-10-08';
    expect(relativeDays('2026-10-08', today)).toBe('hoy');
    expect(relativeDays('2026-10-09', today)).toBe('mañana');
    expect(relativeDays('2026-10-07', today)).toBe('ayer');
    expect(relativeDays('2026-10-11', today)).toBe('en 3 días');
    expect(relativeDays('2026-10-03T10:00:00Z', today)).toBe('hace 5 días');
  });

  it('formats calendar days as dd/MM/yyyy without shifting them', () => {
    expect(calendarDate('2026-01-01')).toBe('01/01/2026');
    expect(calendarDate('2026-12-31T23:30:00.000Z')).toBe('31/12/2026');
  });
});

describe('other presentation helpers', () => {
  it('formats file sizes in KB or MB', () => {
    expect(fileSize(10)).toBe('1 KB');
    expect(fileSize(48_213)).toBe('47 KB');
    expect(fileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('names people with a fallback for missing users', () => {
    expect(personName({ firstName: 'Taylor', lastName: 'Manager' })).toBe('Taylor Manager');
    expect(personName(null)).toBe('Sin asignar');
    expect(personName(undefined, 'Usuario eliminado')).toBe('Usuario eliminado');
  });
});
