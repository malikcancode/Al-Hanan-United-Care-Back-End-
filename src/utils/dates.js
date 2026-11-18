// Date helpers that respect the clinic's timezone.
// Appointment preferredDate is stored as UTC midnight of the chosen calendar day,
// so "today" means: today's calendar date in the clinic timezone, at UTC midnight.

export const DEFAULT_TIMEZONE = "Asia/Dubai";

export const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// "YYYY-MM-DD" for the given instant in the given timezone
export const dateKey = (date, timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

// UTC-midnight Date for a calendar day key
export const dayFromKey = (key) => new Date(`${key}T00:00:00.000Z`);

export const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

export const clinicToday = (timeZone) => dayFromKey(dateKey(new Date(), timeZone));

// Start of the clinic's current day as a real instant (for createdAt ranges)
export const clinicDayStartInstant = (timeZone, offsetDays = 0) => {
  const key = dateKey(addDays(new Date(), offsetDays), timeZone);
  // Find the UTC instant whose wall-clock time in `timeZone` is 00:00 on `key`.
  const guess = dayFromKey(key);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value])
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (wall - guess.getTime()));
};
