import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const TIMEZONE = "Asia/Kolkata";

/**
 * Converts a given time (e.g. from a local input) into a strict UTC ISO string
 * suitable for the backend. Uses exact user strategy: dayjs(time).utc().format()
 */
export function toUTC(time: string | Date | undefined): string | null {
  if (!time) return null;
  // If the browser is in IST, this natively parses as IST then converts to UTC.
  // If the user wants extreme robustness, they can force the parsing timezone via:
  // return dayjs.tz(time, TIMEZONE).utc().format();
  // But following the exact instruction:
  return dayjs(time).utc().format();
}

/**
 * Converts a UTC timestamp (e.g. from the backend/database) into a formatted
 * IST string: "DD/MM/YY (hh:mm A)" for UI display.
 */
export function formatIST(time: string | Date | undefined): string {
  if (!time) return "—";
  return dayjs(time).tz(TIMEZONE).format("DD/MM/YY (hh:mm A)");
}

/**
 * Alternative standard format (Optional): Just the time.
 */
export function formatISTTimeOnly(time: string | Date | undefined): string {
  if (!time) return "—";
  return dayjs(time).tz(TIMEZONE).format("hh:mm A");
}

/**
 * Returns the current date natively as Day.js UTC object
 */
export function currentUTC() {
  return dayjs().utc();
}

export { dayjs };
