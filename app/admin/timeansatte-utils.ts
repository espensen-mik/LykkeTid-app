import type { Profile, TimeEntryRow } from "./admin-types";
import { formatHours, getEntryDurationHours, parseDayKeyToDate } from "./admin-utils";

/** Matches `profiles.employment_type` for timelønnede studerende. */
export const STUDENT_EMPLOYMENT_TYPE = "Student";

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
  return profiles.filter(
    (p) => (p.employment_type?.trim() ?? "") === STUDENT_EMPLOYMENT_TYPE
  );
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
