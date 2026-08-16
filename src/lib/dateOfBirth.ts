export function ageFromDob(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/** Parses day/month/year text fields into a valid Date, or null if any part is missing/invalid. */
export function parseDob(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!d || !m || !y) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  if (y < 1900 || y > new Date().getFullYear()) return null;

  const date = new Date(y, m - 1, d);
  // Catches invalid combinations like 31 Feb, which JS Date would otherwise
  // silently roll over into March.
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function dobPartsFromIso(iso: string): { day: string; month: string; year: string } {
  const date = new Date(iso);
  return {
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    year: String(date.getFullYear()),
  };
}

export function dobToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
