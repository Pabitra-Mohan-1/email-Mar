// Timezone-stable date helpers pinned to India Standard Time (Asia/Kolkata).
//
// Campaign schedule times must read the same for everyone on the team,
// regardless of the viewer's browser timezone (which may be UTC on servers or
// hosted preview environments). We therefore always display and interpret
// schedule times in IST rather than the browser's local zone.

const TIME_ZONE = "Asia/Kolkata";
const TZ_LABEL = "IST";

// IST is a fixed +5:30 offset (no daylight saving), so we can convert reliably
// without a timezone library.
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Format a stored ISO/UTC timestamp for display in IST, e.g. "Jul 8, 2026 4:43 PM IST".
 */
export function formatScheduleIST(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${formatted} ${TZ_LABEL}`;
}

/**
 * Format a stored ISO/UTC timestamp as a compact IST time for log rows,
 * e.g. "Jul 8, 10:33:00 PM IST".
 */
export function formatLogTimeIST(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
  return `${formatted} ${TZ_LABEL}`;
}

/**
 * Convert a stored ISO/UTC timestamp into the "YYYY-MM-DDTHH:mm" value that a
 * <input type="datetime-local"> expects, expressed in IST — so the picker shows
 * the exact IST time the user scheduled, on any browser.
 */
export function isoToISTInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // Shift the UTC instant by the IST offset, then read the UTC parts (which now
  // represent IST wall-clock time).
  const ist = new Date(d.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

/**
 * Convert a datetime-local value the user typed (interpreted as IST wall-clock
 * time) into a UTC ISO string to store. Independent of the browser timezone.
 */
export function istInputToISO(local: string): string | null {
  // local is "YYYY-MM-DDTHH:mm" with no zone; parse the parts as IST.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, mo, da, h, mi] = match.map(Number) as unknown as number[];
  // Build the UTC instant for that IST wall-clock time: treat the parts as if
  // UTC, then subtract the IST offset to get the true UTC instant.
  const asUtc = Date.UTC(y, mo - 1, da, h, mi);
  const utc = new Date(asUtc - IST_OFFSET_MINUTES * 60 * 1000);
  return isNaN(utc.getTime()) ? null : utc.toISOString();
}
