import type { Profile, ReportRange, TimeEntryRow } from "./admin-types";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function parseTimeToMinutes(value: string): number {
  const [hhRaw, mmRaw] = value.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw ?? "0");
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

export function getEntryDurationHours(startTime: string, endTime: string): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const deltaMinutes = Math.max(0, endMinutes - startMinutes);
  return deltaMinutes / 60;
}

export function formatHours(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function formatCreatedAt(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function parseDayKeyToDate(dayKey: string): Date {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function getStartOfCurrentWeekMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getStartOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export function getStartMonthsAgo(monthsBack: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsBack, 1, 0, 0, 0, 0);
}

export function getEndOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export function countWeekdaysInclusive(start: Date, end: Date): number {
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const endAtNoon = new Date(end);
  endAtNoon.setHours(12, 0, 0, 0);
  let count = 0;
  while (cursor <= endAtNoon) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function formatMonthKey(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(year, month - 1, 1, 12, 0, 0, 0);
  return new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" }).format(
    date
  );
}

export function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type ProjectHoursChartPoint = {
  key: string;
  axisLabel: string;
  tooltipTitle: string;
  hours: number;
};

function monthKeysBetweenInclusive(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12, 0, 0, 0);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1, 12, 0, 0, 0);
  while (cursor <= endMonth) {
    out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function dayKeysBetweenInclusive(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const endAt = new Date(end);
  endAt.setHours(12, 0, 0, 0);
  while (cursor <= endAt) {
    out.push(toDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function sumHoursOnDay(entries: readonly TimeEntryRow[], dayKey: string): number {
  let total = 0;
  for (const e of entries) {
    if (e.entry_date !== dayKey) continue;
    total += getEntryDurationHours(e.start_time, e.end_time);
  }
  return total;
}

function sumHoursInMonth(entries: readonly TimeEntryRow[], monthKey: string): number {
  let total = 0;
  for (const e of entries) {
    if (e.entry_date.slice(0, 7) !== monthKey) continue;
    total += getEntryDurationHours(e.start_time, e.end_time);
  }
  return total;
}

function formatMonthAxisLabel(monthKey: string, includeYear: boolean): string {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  const date = new Date(y, m - 1, 1, 12, 0, 0, 0);
  return new Intl.DateTimeFormat("da-DK", {
    month: "short",
    ...(includeYear ? { year: "2-digit" } : {}),
  }).format(date);
}

/** Buckets project time entries for the project detail bar chart (week = per day, month = one month, 3/12 mo = per calendar month in range). */
export function buildProjectHoursChartSeries(
  rangeEntries: readonly TimeEntryRow[],
  summaryRange: ReportRange,
  periodStart: Date,
  periodEnd: Date
): ProjectHoursChartPoint[] {
  const start = new Date(periodStart);
  start.setHours(12, 0, 0, 0);
  const end = new Date(periodEnd);
  end.setHours(12, 0, 0, 0);

  if (summaryRange === "week") {
    const dayKeys = dayKeysBetweenInclusive(start, end);
    return dayKeys.map((dayKey) => {
      const parts = dayKey.split("-").map(Number);
      const y = parts[0];
      const mo = parts[1];
      const d = parts[2];
      const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
      const axisLabel = new Intl.DateTimeFormat("da-DK", {
        weekday: "short",
        day: "numeric",
      }).format(date);
      const tooltipTitle = new Intl.DateTimeFormat("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
      return {
        key: dayKey,
        axisLabel,
        tooltipTitle,
        hours: sumHoursOnDay(rangeEntries, dayKey),
      };
    });
  }

  if (summaryRange === "month") {
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    return [
      {
        key: monthKey,
        axisLabel: formatMonthAxisLabel(monthKey, false),
        tooltipTitle: formatMonthKey(monthKey),
        hours: sumHoursInMonth(rangeEntries, monthKey),
      },
    ];
  }

  const monthKeys = monthKeysBetweenInclusive(start, end);
  const includeYear =
    monthKeys.length > 1 &&
    monthKeys[0].slice(0, 4) !== monthKeys[monthKeys.length - 1].slice(0, 4);

  return monthKeys.map((mk) => ({
    key: mk,
    axisLabel: formatMonthAxisLabel(mk, includeYear),
    tooltipTitle: formatMonthKey(mk),
    hours: sumHoursInMonth(rangeEntries, mk),
  }));
}

export function getRecentWeekdays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (days.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return days.reverse();
}

export function getWeekdaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const endAtNoon = new Date(end);
  endAtNoon.setHours(12, 0, 0, 0);
  while (cursor <= endAtNoon) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function getRegistrationBarColor(value: number): string {
  if (value < 50) return "#D62839";
  if (value < 80) return "#f59e0b";
  return "#0F2A1D";
}

export const PROJECT_COLORS = [
  "#6050DC", // purple
  "#D52DB7", // magenta
  "#FF2E7E", // pink
  "#FF6B45", // coral
  "#FFAB05", // yellow
  "#22C55E", // green
  "#06B6D4", // cyan
] as const;

const PROJECT_COLOR_STORAGE_KEY = "lykketid.projectColorMap";
const projectColorMap: Record<string, string> = {};
let projectColorMapHydrated = false;

function hydrateProjectColorMap() {
  if (projectColorMapHydrated) return;
  projectColorMapHydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PROJECT_COLOR_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === "string" && typeof value === "string") {
        projectColorMap[key] = value;
      }
    }
  } catch {
    // Ignore invalid storage data.
  }
}

function persistProjectColorMap() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECT_COLOR_STORAGE_KEY, JSON.stringify(projectColorMap));
  } catch {
    // Ignore storage persistence errors.
  }
}

export function getProjectColor(projectId: string, preferredColor?: string | null): string {
  hydrateProjectColorMap();
  const key = projectId.trim().toLowerCase();
  const preferred = preferredColor?.trim() || "";
  if (preferred) {
    projectColorMap[key] = preferred;
    persistProjectColorMap();
    return preferred;
  }
  if (!key) return PROJECT_COLORS[0];

  if (!projectColorMap[key]) {
    const index = Object.keys(projectColorMap).length;
    projectColorMap[key] = PROJECT_COLORS[index % PROJECT_COLORS.length];
    persistProjectColorMap();
  }

  return projectColorMap[key];
}

export function getProjectColorSoft(projectId: string): string {
  return `${getProjectColor(projectId)}20`;
}

export function buildPieSegments(
  rows: { projectName: string; totalHours: number }[]
): Array<{ projectName: string; totalHours: number; start: number; end: number }> {
  const total = rows.reduce((sum, row) => sum + row.totalHours, 0);
  if (total <= 0) return [];
  let cursor = 0;
  return rows
    .filter((row) => row.totalHours > 0)
    .map((row) => {
      const start = cursor;
      const fraction = row.totalHours / total;
      cursor += fraction * 360;
      return { ...row, start, end: cursor };
    });
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function exportProjectCsvFromRows(params: {
  projectSlug: string;
  summaryRange: string;
  projectName: string;
  rangeEntries: TimeEntryRow[];
  profileNameById: Map<string, string>;
}) {
  const { projectSlug, summaryRange, projectName, rangeEntries, profileNameById } =
    params;
  const csvRows: string[][] = [
    [
      "date",
      "employee",
      "start_time",
      "end_time",
      "duration_hours",
      "project",
      "subcategory",
      "location",
    ],
  ];

  for (const entry of rangeEntries) {
    const employee = profileNameById.get(entry.user_id) ?? "Ukendt bruger";
    const duration = formatHours(getEntryDurationHours(entry.start_time, entry.end_time));
    csvRows.push([
      entry.entry_date,
      employee,
      entry.start_time,
      entry.end_time,
      duration,
      projectName,
      entry.subcategory ?? "",
      entry.location ?? "",
    ]);
  }

  const csvContent = csvRows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lykketid-${projectSlug}-${summaryRange}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type UserUsageRow = {
  id: string;
  fullName: string;
  title: string;
  role: string;
  createdAt: string | null;
  avatarUrl: string | null;
  totalHours: number;
  currentMonthHours: number;
  projectsList: Array<{
    projectName: string;
    projectSlug: string;
    totalHours: number;
    currentMonthHours: number;
  }>;
  recentWeekdayStatus: Array<{
    dayKey: string;
    weekday: string;
    hours: number;
    normalized: number;
    barColor: string;
  }>;
  topProjects: Array<{
    projectName: string;
    projectSlug: string;
    totalHours: number;
    currentMonthHours: number;
  }>;
};

export function buildUserUsage(
  profiles: Profile[],
  timeEntries: TimeEntryRow[],
  projectNameBySlug: Map<string, string>
): UserUsageRow[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const entriesByUser = new Map<string, TimeEntryRow[]>();
  for (const entry of timeEntries) {
    const list = entriesByUser.get(entry.user_id) ?? [];
    list.push(entry);
    entriesByUser.set(entry.user_id, list);
  }

  return profiles
    .slice()
    .sort((a, b) => {
      const roleA = a.role === "admin" ? 0 : 1;
      const roleB = b.role === "admin" ? 0 : 1;
      if (roleA !== roleB) return roleA - roleB;
      const nameA = (a.full_name ?? "").trim();
      const nameB = (b.full_name ?? "").trim();
      return nameA.localeCompare(nameB, "da");
    })
    .map((p) => {
      const userEntries = entriesByUser.get(p.id) ?? [];
      let totalHours = 0;
      let currentMonthHours = 0;
      const projectUsage = new Map<
        string,
        { projectSlug: string; totalHours: number; currentMonthHours: number }
      >();

      for (const entry of userEntries) {
        const hours = getEntryDurationHours(entry.start_time, entry.end_time);
        totalHours += hours;

        const projectRow = projectUsage.get(entry.project_id) ?? {
          projectSlug: entry.project_id,
          totalHours: 0,
          currentMonthHours: 0,
        };
        projectRow.totalHours += hours;

        const [yearRaw, monthRaw] = entry.entry_date.split("-");
        const y = Number(yearRaw);
        const m = Number(monthRaw);
        if (y === currentYear && m === currentMonth) {
          currentMonthHours += hours;
          projectRow.currentMonthHours += hours;
        }
        projectUsage.set(entry.project_id, projectRow);
      }

      const projectsList = Array.from(projectUsage.values())
        .sort((a, b) => a.projectSlug.localeCompare(b.projectSlug, "da"))
        .map((row) => ({
          projectName: projectNameBySlug.get(row.projectSlug) ?? row.projectSlug,
          projectSlug: row.projectSlug,
          totalHours: row.totalHours,
          currentMonthHours: row.currentMonthHours,
        }));

      const dayTotals = new Map<string, number>();
      for (const entry of userEntries) {
        const hours = getEntryDurationHours(entry.start_time, entry.end_time);
        dayTotals.set(entry.entry_date, (dayTotals.get(entry.entry_date) ?? 0) + hours);
      }
      const recentWeekdayStatus = getRecentWeekdays(5).map((d) => {
        const dayKey = toDayKey(d);
        const hours = dayTotals.get(dayKey) ?? 0;
        const weekday = new Intl.DateTimeFormat("da-DK", { weekday: "short" }).format(d);
        const normalized = Math.min(1, hours / 7.5);
        const barColor = hours <= 3 ? "bg-rose-500" : hours <= 5 ? "bg-amber-400" : "bg-accent";
        return {
          dayKey,
          weekday,
          hours,
          normalized,
          barColor,
        };
      });

      const topProjects = projectsList
        .slice()
        .sort((a, b) => b.currentMonthHours - a.currentMonthHours)
        .filter((row) => row.currentMonthHours > 0)
        .slice(0, 3);

      return {
        id: p.id,
        fullName: p.full_name?.trim() || p.title || "Bruger",
        title: p.title?.trim() || "-",
        role: p.role || "user",
        createdAt: p.created_at,
        avatarUrl: p.avatar_url?.trim() || null,
        totalHours,
        currentMonthHours,
        projectsList,
        recentWeekdayStatus,
        topProjects,
      };
    });
}
