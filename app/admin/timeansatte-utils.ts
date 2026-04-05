import type { Profile, TimeEntryRow } from "./admin-types";
import {
  formatHours,
  getEntryDurationHours,
  parseDayKeyToDate,
} from "./admin-utils";

/** Normalized value for `profiles.employment_type` (matched case-insensitively). */
export const STUDENT_EMPLOYMENT_TYPE_NORMALIZED = "student";

const DA_MONTH_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;

export type WeekBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

export type MonthBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

export function filterStudentProfiles(profiles: readonly Profile[]): Profile[] {
  return profiles.filter((p) => {
    const raw = p.employment_type?.trim() ?? "";
    return raw.toLowerCase() === STUDENT_EMPLOYMENT_TYPE_NORMALIZED;
  });
}

/** ISO 8601 week calendar year and week number (local date). */
export function getISOWeekData(d: Date): { weekYear: number; week: number } {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const weekYear = date.getFullYear();
  const week1 = new Date(weekYear, 0, 4);
  const week =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { weekYear, week };
}

/** Monday 00:00:00 local time for the week that contains `anchor`. */
export function getMondayOfWeekContainingLocal(anchor: Date): Date {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

/** Oldest → newest: `n` Monday-based weeks ending in the week that contains `anchor`. */
export function getLatestNWeekBuckets(anchor: Date, n: number): WeekBucket[] {
  const currentMonday = getMondayOfWeekContainingLocal(anchor);
  const out: WeekBucket[] = [];
  for (let back = n - 1; back >= 0; back--) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - back * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const { weekYear, week } = getISOWeekData(start);
    out.push({
      key: `${weekYear}-W${String(week).padStart(2, "0")}`,
      label: `Uge ${week}`,
      start,
      end,
    });
  }
  return out;
}

/** Oldest → newest: `n` calendar months ending in the month that contains `anchor`. */
export function getLatestNMonthBuckets(anchor: Date, n: number): MonthBucket[] {
  const ref = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12, 0, 0, 0);
  const out: MonthBucket[] = [];
  for (let back = n - 1; back >= 0; back--) {
    const monthStart = new Date(ref.getFullYear(), ref.getMonth() - back, 1, 0, 0, 0, 0);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      label: DA_MONTH_SHORT[monthStart.getMonth()],
      start: monthStart,
      end: monthEnd,
    });
  }
  return out;
}

function entryDateInRange(entryDateKey: string, start: Date, end: Date): boolean {
  const d = parseDayKeyToDate(entryDateKey);
  return d >= start && d <= end;
}

export function sumHoursForUserInRange(
  entries: readonly TimeEntryRow[],
  userId: string,
  start: Date,
  end: Date
): number {
  let total = 0;
  for (const e of entries) {
    if (e.user_id !== userId) continue;
    if (!entryDateInRange(e.entry_date, start, end)) continue;
    total += getEntryDurationHours(e.start_time, e.end_time);
  }
  return total;
}

export function sumHoursForUserInMonthKey(
  entries: readonly TimeEntryRow[],
  userId: string,
  monthKey: string
): number {
  let total = 0;
  for (const e of entries) {
    if (e.user_id !== userId) continue;
    if (e.entry_date.slice(0, 7) !== monthKey) continue;
    total += getEntryDurationHours(e.start_time, e.end_time);
  }
  return total;
}

export type StudentHoursRow = {
  userId: string;
  displayName: string;
  title: string | null;
  avatarUrl: string | null;
  /** Hours per week column (same order as `weeks`). */
  weekHours: number[];
  /** Hours per month column (same order as `months`). */
  monthHours: number[];
};

export function buildStudentHoursRows(
  students: readonly Profile[],
  weeks: readonly WeekBucket[],
  months: readonly MonthBucket[],
  entries: readonly TimeEntryRow[]
): StudentHoursRow[] {
  const sorted = [...students].sort((a, b) => {
    const na = (a.full_name?.trim() || a.title?.trim() || "Uden navn").localeCompare(
      b.full_name?.trim() || b.title?.trim() || "Uden navn",
      "da"
    );
    return na;
  });

  return sorted.map((p) => {
    const weekHours = weeks.map((w) => sumHoursForUserInRange(entries, p.id, w.start, w.end));
    const monthHours = months.map((m) => sumHoursForUserInMonthKey(entries, p.id, m.key));
    return {
      userId: p.id,
      displayName: p.full_name?.trim() || p.title?.trim() || "Uden navn",
      title: p.title?.trim() || null,
      avatarUrl: p.avatar_url?.trim() || null,
      weekHours,
      monthHours,
    };
  });
}

export function sumTotalHoursInRangeForUsers(
  entries: readonly TimeEntryRow[],
  userIds: ReadonlySet<string>,
  start: Date,
  end: Date
): number {
  let total = 0;
  for (const e of entries) {
    if (!userIds.has(e.user_id)) continue;
    if (!entryDateInRange(e.entry_date, start, end)) continue;
    total += getEntryDurationHours(e.start_time, e.end_time);
  }
  return total;
}

/** Table cell display: whole number if integer, else one decimal; zero shows as "0". */
export function formatHoursCell(hours: number): string {
  return formatHours(hours);
}

/** Latest `entry_date` for user; resolves project display name from slug map. */
export function mostRecentProjectNameForUser(
  entries: readonly TimeEntryRow[],
  userId: string,
  projectNameBySlug: ReadonlyMap<string, string>
): string | null {
  let bestDay = "";
  let bestSlug: string | null = null;
  for (const e of entries) {
    if (e.user_id !== userId) continue;
    if (e.entry_date >= bestDay) {
      bestDay = e.entry_date;
      bestSlug = e.project_id;
    }
  }
  if (!bestSlug) return null;
  const name = projectNameBySlug.get(bestSlug)?.trim();
  return name || bestSlug;
}

export type StudentDayHoursRow = {
  dayKey: string;
  hours: number;
  /** Danish long date for display. */
  label: string;
};

export function formatDayKeyDanish(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dayKey;
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * All calendar days with at least one entry for `userId`, totals summed per day.
 * Newest day first (`YYYY-MM-DD` sort).
 */
export function buildDailyHoursForStudent(
  entries: readonly TimeEntryRow[],
  userId: string
): StudentDayHoursRow[] {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    if (e.user_id !== userId) continue;
    const h = getEntryDurationHours(e.start_time, e.end_time);
    byDay.set(e.entry_date, (byDay.get(e.entry_date) ?? 0) + h);
  }
  return Array.from(byDay.entries())
    .map(([dayKey, hours]) => ({
      dayKey,
      hours,
      label: formatDayKeyDanish(dayKey),
    }))
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey, "en"));
}
