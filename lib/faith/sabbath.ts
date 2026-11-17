/**
 * Sabbath times for Babcock (Seventh-day Adventist): from Friday sunset to Saturday sunset.
 *
 * Sunset is worked out on the device with the NOAA solar equations, so this needs no
 * network or API. Times are for Ilishan-Remo and shown in West Africa Time, whatever
 * time zone the phone is set to.
 */

/** Ilishan-Remo campus */
export const CAMPUS_COORDS = { lat: 6.8912, lng: 3.72295 };
export const CAMPUS_TIME_ZONE = "Africa/Lagos";
/** West Africa Time is UTC+1 all year (no daylight saving) */
const WAT_OFFSET_MINUTES = 60;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Sunset (the moment the sun's upper edge sets, with refraction) on a calendar date,
 * as a Date. `year`, `month` (1–12) and `day` are the local date at the place.
 */
export function sunsetOn(year: number, month: number, day: number, lat = CAMPUS_COORDS.lat, lng = CAMPUS_COORDS.lng): Date {
  const noonUtc = Date.UTC(year, month - 1, day, 12);
  const julianDay = noonUtc / 86_400_000 + 2_440_587.5;
  const t = (julianDay - 2_451_545) / 36_525;

  const meanLong = (280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35_999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    Math.sin(rad(meanAnomaly)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnomaly)) * 0.000289;
  const apparentLong = meanLong + center - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));
  const declination = deg(Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLong))));

  const y = Math.tan(rad(obliquity / 2)) ** 2;
  const equationOfTime =
    4 *
    deg(
      y * Math.sin(2 * rad(meanLong)) -
        2 * eccentricity * Math.sin(rad(meanAnomaly)) +
        4 * eccentricity * y * Math.sin(rad(meanAnomaly)) * Math.cos(2 * rad(meanLong)) -
        0.5 * y * y * Math.sin(4 * rad(meanLong)) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnomaly))
    );

  const hourAngle = deg(
    Math.acos(Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(declination))) - Math.tan(rad(lat)) * Math.tan(rad(declination)))
  );
  const sunsetMinutesUtc = 720 - 4 * (lng - hourAngle) - equationOfTime;
  return new Date(Date.UTC(year, month - 1, day) + sunsetMinutesUtc * 60_000);
}

/** The campus calendar date (and weekday, 0 = Sunday) of a moment */
function campusDate(at: Date) {
  const local = new Date(at.getTime() + WAT_OFFSET_MINUTES * 60_000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate(), weekday: local.getUTCDay() };
}

/** The campus date `days` after the given one */
function addDays({ year, month, day }: { year: number; month: number; day: number }, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const sunsetFor = (d: { year: number; month: number; day: number }) => sunsetOn(d.year, d.month, d.day);

export type SabbathStatus =
  | { state: "sabbath"; endsAt: Date }
  | { state: "upcoming"; startsAt: Date; endsAt: Date };

/** Whether it's Sabbath now, or when the next one starts */
export function sabbathStatus(now: Date = new Date()): SabbathStatus {
  const today = campusDate(now);

  // Friday after sunset, or Saturday before sunset: it's Sabbath
  if (today.weekday === 5 && now >= sunsetFor(today)) {
    return { state: "sabbath", endsAt: sunsetFor(addDays(today, 1)) };
  }
  if (today.weekday === 6 && now < sunsetFor(today)) {
    return { state: "sabbath", endsAt: sunsetFor(today) };
  }

  // Otherwise, the coming Friday (a week on if this Friday's or Saturday's Sabbath has passed)
  const daysToFriday = (5 - today.weekday + 7) % 7 || (now < sunsetFor(today) ? 0 : 7);
  const friday = addDays(today, daysToFriday);
  return { state: "upcoming", startsAt: sunsetFor(friday), endsAt: sunsetFor(addDays(friday, 1)) };
}

/** "6:41 PM" in campus time */
export function formatCampusTime(at: Date): string {
  return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: CAMPUS_TIME_ZONE }).format(at);
}

/** "Friday 14 Nov" in campus time */
export function formatCampusDay(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: CAMPUS_TIME_ZONE }).format(at);
}

/** "3 h 12 min", "1 day 4 h", "45 min" */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"}${hours ? ` ${hours} h` : ""}`;
  if (hours > 0) return `${hours} h${minutes ? ` ${minutes} min` : ""}`;
  return `${minutes} min`;
}
