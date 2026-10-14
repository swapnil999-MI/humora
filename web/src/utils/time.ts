// The server stores and sends every time in UTC (ISO strings ending in "Z", or epoch
// milliseconds). Times are only converted for display, into this device's time zone,
// as a 12-hour clock ("9:05 AM"), whatever the browser's language would pick.

const clock = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

/** This device's IANA time zone, e.g. "Asia/Kolkata". */
export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Every IANA time zone the browser knows (a short list on very old browsers). */
export function allTimeZones(): string[] {
  const list: string[] | undefined = (Intl as any).supportedValuesOf?.('timeZone');
  const zones = list?.length ? [...list] : ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York'];
  if (!zones.includes('UTC')) zones.push('UTC');
  return zones;
}

/** "UTC+05:30" for a zone, as of now. */
export function zoneOffsetLabel(zone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    return part === 'GMT' ? 'UTC+00:00' : (part ?? '').replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

/** A UTC instant (ISO string, epoch ms or Date) as a device-local 12-hour time, e.g. "9:05 AM". */
export function formatClock(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : clock.format(d);
}
