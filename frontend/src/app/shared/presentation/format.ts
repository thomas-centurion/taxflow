/** Presentation helpers. Dates are calendar days (YYYY-MM-DD) and are never shifted by timezone. */

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'Imagen PNG',
  'image/jpeg': 'Imagen JPEG',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
};

export function personName(person: { firstName: string; lastName: string } | null | undefined, fallback = 'Sin asignar'): string {
  return person ? `${person.firstName} ${person.lastName}` : fallback;
}

export function initials(person: { firstName: string; lastName: string }): string {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

export function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeLabel(mimeType: string): string { return MIME_LABELS[mimeType] ?? mimeType; }

/** Local calendar date as YYYY-MM-DD. */
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return todayKey(new Date(year, month - 1, day + days));
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** "en 3 días", "hoy", "hace 2 días" relative to today. */
export function relativeDays(dateKey: string, today = todayKey()): string {
  const days = daysBetween(today, dateKey.slice(0, 10));
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === -1) return 'ayer';
  return days > 0 ? `en ${days} días` : `hace ${-days} días`;
}

/** Formats a YYYY-MM-DD calendar day as dd/MM/yyyy without timezone conversion. */
export function calendarDate(dateKey: string): string {
  const [year, month, day] = dateKey.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
