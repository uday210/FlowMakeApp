/**
 * Lightweight cron expression matcher.
 * Supports: * / , - ranges and step values for all 5 fields.
 * Format: minute hour day-of-month month day-of-week
 */
function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;

  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [rangeStr, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      const [rangeMin, rangeMax] = rangeStr === "*"
        ? [min, max]
        : rangeStr.split("-").map(Number);
      for (let i = rangeMin; i <= (rangeMax ?? max); i += step) {
        if (i === value) return true;
      }
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (value >= lo && value <= hi) return true;
    } else {
      if (parseInt(part, 10) === value) return true;
    }
  }
  return false;
}

export function cronMatches(cron: string, date: Date = new Date()): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    matchField(minute, date.getMinutes(), 0, 59) &&
    matchField(hour, date.getHours(), 0, 23) &&
    matchField(dom, date.getDate(), 1, 31) &&
    matchField(month, date.getMonth() + 1, 1, 12) &&
    matchField(dow, date.getDay(), 0, 6)
  );
}

/** Convert interval trigger config (every N minutes/hours/days) to a cron string */
export function intervalToCron(every: string, unit: string): string {
  const n = parseInt(every, 10) || 1;
  if (unit === "minutes") return `*/${n} * * * *`;
  if (unit === "hours")   return `0 */${n} * * *`;
  if (unit === "days")    return `0 0 */${n} * *`;
  return `*/${n} * * * *`;
}
