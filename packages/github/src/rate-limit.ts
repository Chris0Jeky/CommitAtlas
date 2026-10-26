import { isRecord } from "./validation.js";

export function retryAfterValue(headers: Headers, now: Date): string | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null) {
    const normalizedRetryAfter = retryAfter.trim();
    if (/^\d+$/.test(normalizedRetryAfter) || isHttpDate(normalizedRetryAfter, now)) {
      return normalizedRetryAfter;
    }
  }

  const reset = headers.get("x-ratelimit-reset");
  const normalizedReset = reset?.trim() ?? "";
  if (!/^\d+$/.test(normalizedReset)) return null;
  const resetEpoch = Number(normalizedReset);
  if (!Number.isSafeInteger(resetEpoch)) return null;
  const nowEpoch = Math.floor(now.getTime() / 1000);
  return String(Math.max(0, resetEpoch - nowEpoch));
}

export function rateLimitRetryAfterValue(headers: Headers, now: Date): string {
  return retryAfterValue(headers, now) ?? "60";
}

export function hasDirectRateLimitEvidence(headers: Headers, now: Date): boolean {
  const retryAfter = headers.get("retry-after")?.trim() ?? "";
  const validRetryAfter = /^\d+$/.test(retryAfter) || (retryAfter !== "" && isHttpDate(retryAfter, now));
  return validRetryAfter || headers.get("x-ratelimit-remaining")?.trim() === "0";
}

export function rateLimitMessage(body: string): boolean {
  let message = body;
  try {
    const payload = JSON.parse(body) as unknown;
    if (!isRecord(payload) || typeof payload.message !== "string") return false;
    message = payload.message;
  } catch {
    // GitHub normally sends JSON, but a bounded plain-text proxy response can
    // still carry the same explicit rate-limit evidence.
  }
  return /\b(?:rate[\s-]*limit(?:ed)?|secondary[\s-]+limit(?:ed)?|abuse detection)\b/i.test(message);
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const LONG_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function isHttpDate(value: string, now: Date): boolean {
  const imf = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(value);
  if (imf) return matchesUtcDate(imf[1]!, imf[4]!, imf[3]!, imf[2]!, imf[5]!, imf[6]!, imf[7]!);

  const rfc850 = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(value);
  if (rfc850) {
    let year = 2000 + Number(rfc850[4]);
    if (year > now.getUTCFullYear() + 50) year -= 100;
    const weekday = SHORT_WEEKDAYS[LONG_WEEKDAYS.indexOf(rfc850[1] as typeof LONG_WEEKDAYS[number])];
    return matchesUtcDate(weekday!, String(year), rfc850[3]!, rfc850[2]!, rfc850[5]!, rfc850[6]!, rfc850[7]!);
  }

  const asctime = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?:(\d{2})| (\d)) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/.exec(value);
  return Boolean(asctime && matchesUtcDate(
    asctime[1]!, asctime[8]!, asctime[2]!, asctime[3] ?? asctime[4]!, asctime[5]!, asctime[6]!, asctime[7]!,
  ));
}

function matchesUtcDate(
  weekday: string,
  yearText: string,
  monthText: string,
  dayText: string,
  hourText: string,
  minuteText: string,
  secondText: string,
): boolean {
  const year = Number(yearText);
  const month = MONTHS.indexOf(monthText as typeof MONTHS[number]);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 0 || hour > 23 || minute > 59 || second > 60) return false;

  const date = new Date(Date.UTC(year, month, day, hour, minute, Math.min(second, 59)));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === Math.min(second, 59)
    && SHORT_WEEKDAYS[date.getUTCDay()] === weekday;
}
