"use client";

import { LoginScreen } from "@/app/components/login-screen";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Clock3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type Profile = {
  id: string;
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number | null;
};

type SubcategoryRow = {
  id: string;
  project_id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
};

type TimeEntryRow = {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  project_id: string;
  subcategory: string | null;
  location: string | null;
};

type AdminTab = "time-usage" | "project-management" | "users";
type ReportRange = "weekly" | "monthly" | "all";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseTimeToMinutes(value: string): number {
  const [hhRaw, mmRaw] = value.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw ?? "0");
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

function getEntryDurationHours(startTime: string, endTime: string): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const deltaMinutes = Math.max(0, endMinutes - startMinutes);
  return deltaMinutes / 60;
}

function formatHours(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function formatCreatedAt(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function parseDayKeyToDate(dayKey: string): Date {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getStartOfCurrentWeekMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getStartOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function formatMonthKey(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(year, month - 1, 1, 12, 0, 0, 0);
  return new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" }).format(
    date
  );
}

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecentWeekdays(count: number): Date[] {
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

function getProjectColor(projectSlug: string): string {
  const slug = projectSlug.toLowerCase();
  if (slug === "drift") return "#4ca771";
  if (slug === "lykkecup") return "#f59e0b";
  if (slug === "klassebold") return "#7c3aed";
  if (slug === "haandboldtjek") return "#e11d48";
  if (slug === "andet") return "#64748b";
  return "#6b9071";
}

function buildPieSegments(
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const [adminDataError, setAdminDataError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [projectSortOrder, setProjectSortOrder] = useState("0");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("time-usage");
  const [reportRange, setReportRange] = useState<ReportRange>("monthly");
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isActive) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchProfile = async () => {
      if (!session?.user?.id) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, title, avatar_url, role, created_at")
        .eq("id", session.user.id)
        .single();

      if (!isActive) return;

      if (error) {
        setProfile(null);
      } else {
        setProfile((data as Profile | null) ?? null);
      }
      setProfileLoading(false);
    };

    fetchProfile();

    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

  async function fetchProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, slug, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { error };
    setProjects((data ?? []) as ProjectRow[]);
    return { error: null };
  }

  async function fetchSubcategories() {
    const { data, error } = await supabase
      .from("project_subcategories")
      .select("id, project_id, name, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { error };
    setSubcategories((data ?? []) as SubcategoryRow[]);
    return { error: null };
  }

  async function fetchTimeEntries() {
    const { data, error } = await supabase
      .from("time_entries")
      .select(
        "id, user_id, entry_date, start_time, end_time, project_id, subcategory, location"
      );

    if (error) return { error };
    setTimeEntries((data ?? []) as TimeEntryRow[]);
    return { error: null };
  }

  async function fetchProfilesForUsage() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, title, avatar_url, role, created_at")
      .order("full_name", { ascending: true });

    if (error) return { error };
    setProfiles((data ?? []) as Profile[]);
    return { error: null };
  }

  useEffect(() => {
    let isActive = true;

    const fetchAdminData = async () => {
      if (profile?.role !== "admin") {
        setProjects([]);
        setSubcategories([]);
        setAdminDataLoading(false);
        setAdminDataError("");
        return;
      }

      setAdminDataLoading(true);
      setAdminDataError("");

      const [projectsResult, subcategoriesResult, timeEntriesResult, profilesResult] =
        await Promise.all([
        fetchProjects(),
        fetchSubcategories(),
        fetchTimeEntries(),
        fetchProfilesForUsage(),
      ]);

      if (!isActive) return;

      if (
        projectsResult.error ||
        subcategoriesResult.error ||
        timeEntriesResult.error ||
        profilesResult.error
      ) {
        setAdminDataError("Kunne ikke hente admin-data");
      } else {
        setAdminDataError("");
      }
      setAdminDataLoading(false);
    };

    void fetchAdminData();

    return () => {
      isActive = false;
    };
  }, [profile?.role]);

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectSlug.trim()) return;

    setCreatingProject(true);
    setCreateProjectError("");

    const sortOrderValue = Number(projectSortOrder);
    const { error } = await supabase.from("projects").insert({
      name: projectName.trim(),
      slug: projectSlug.trim(),
      sort_order: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
      is_active: true,
    });

    if (error) {
      setCreateProjectError("Kunne ikke oprette projekt");
      setCreatingProject(false);
      return;
    }

    setProjectName("");
    setProjectSlug("");
    setProjectSortOrder("0");
    await fetchProjects();
    setCreatingProject(false);
  };

  const subcategoriesByProjectId = useMemo(() => {
    const map = new Map<string, SubcategoryRow[]>();
    for (const sub of subcategories) {
      const list = map.get(sub.project_id) ?? [];
      list.push(sub);
      map.set(sub.project_id, list);
    }
    return map;
  }, [subcategories]);

  const filteredTimeEntries = useMemo(() => {
    if (reportRange === "all") return timeEntries;
    const start =
      reportRange === "weekly" ? getStartOfCurrentWeekMonday() : getStartOfCurrentMonth();
    return timeEntries.filter((entry) => parseDayKeyToDate(entry.entry_date) >= start);
  }, [reportRange, timeEntries]);

  const timeUsageByProject = useMemo(() => {
    const usageMap = new Map<string, { projectName: string; totalHours: number }>();
    const activeProjects = projects.filter((p) => p.is_active);

    for (const project of activeProjects) {
      usageMap.set(project.slug, { projectName: project.name, totalHours: 0 });
    }

    for (const entry of filteredTimeEntries) {
      const usage = usageMap.get(entry.project_id);
      if (!usage) continue;
      usage.totalHours += getEntryDurationHours(entry.start_time, entry.end_time);
    }

    return activeProjects
      .slice()
      .sort((a, b) => {
        const aSort = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bSort = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) return aSort - bSort;
        return a.name.localeCompare(b.name, "da");
      })
      .map((project) => {
        const usage = usageMap.get(project.slug);
        return {
          projectName: project.name,
          projectSlug: project.slug,
          totalHours: usage?.totalHours ?? 0,
        };
      });
  }, [filteredTimeEntries, projects]);

  const projectNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.slug, project.name);
    }
    return map;
  }, [projects]);

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(p.id, p.full_name?.trim() || p.title?.trim() || "Bruger");
    }
    return map;
  }, [profiles]);
  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of profiles) {
      map.set(p.id, p.avatar_url?.trim() || null);
    }
    return map;
  }, [profiles]);

  const projectDashboardRows = useMemo(() => {
    const totalRangeHours = timeUsageByProject.reduce((sum, row) => sum + row.totalHours, 0);
    const activeProjects = projects.filter((p) => p.is_active);

    return activeProjects
      .map((project) => {
        const rangeEntries = filteredTimeEntries.filter((e) => e.project_id === project.slug);
        const allEntries = timeEntries.filter((e) => e.project_id === project.slug);
        const periodHours = rangeEntries.reduce(
          (sum, entry) => sum + getEntryDurationHours(entry.start_time, entry.end_time),
          0
        );
        const totalHoursOverall = allEntries.reduce(
          (sum, entry) => sum + getEntryDurationHours(entry.start_time, entry.end_time),
          0
        );

        const usersSet = new Set<string>();
        for (const entry of rangeEntries) usersSet.add(entry.user_id);
        const userIds = Array.from(usersSet);

        const byUserMap = new Map<string, number>();
        for (const entry of rangeEntries) {
          const hours = getEntryDurationHours(entry.start_time, entry.end_time);
          byUserMap.set(entry.user_id, (byUserMap.get(entry.user_id) ?? 0) + hours);
        }
        const byUser = Array.from(byUserMap.entries())
          .map(([userId, hours]) => ({
            userId,
            userName: profileNameById.get(userId) ?? "Ukendt bruger",
            avatarUrl: avatarByUserId.get(userId) ?? null,
            hours,
          }))
          .sort((a, b) => b.hours - a.hours);

        const byMonthMap = new Map<string, number>();
        for (const entry of allEntries) {
          const monthKey = entry.entry_date.slice(0, 7);
          const hours = getEntryDurationHours(entry.start_time, entry.end_time);
          byMonthMap.set(monthKey, (byMonthMap.get(monthKey) ?? 0) + hours);
        }
        const byMonth = Array.from(byMonthMap.entries())
          .map(([monthKey, hours]) => ({ monthKey, label: formatMonthKey(monthKey), hours }))
          .sort((a, b) => b.monthKey.localeCompare(a.monthKey, "da"));

        const subcategoryMap = new Map<string, number>();
        for (const entry of rangeEntries) {
          const key = entry.subcategory?.trim() || "Uden underpunkt";
          const hours = getEntryDurationHours(entry.start_time, entry.end_time);
          subcategoryMap.set(key, (subcategoryMap.get(key) ?? 0) + hours);
        }
        const bySubcategory = Array.from(subcategoryMap.entries())
          .map(([name, hours]) => ({ name, hours }))
          .sort((a, b) => b.hours - a.hours);

        return {
          projectSlug: project.slug,
          projectName: project.name,
          periodHours,
          totalHoursOverall,
          sharePct: totalRangeHours > 0 ? (periodHours / totalRangeHours) * 100 : 0,
          userIds,
          byUser,
          byMonth,
          bySubcategory,
          rangeEntries,
        };
      })
      .sort((a, b) => b.periodHours - a.periodHours);
  }, [avatarByUserId, filteredTimeEntries, profileNameById, projects, timeEntries, timeUsageByProject]);

  const reportPeriodLabel =
    reportRange === "weekly" ? "denne uge" : reportRange === "monthly" ? "denne måned" : "al tid";

  const exportProjectCsv = (projectSlug: string) => {
    const target = projectDashboardRows.find((row) => row.projectSlug === projectSlug);
    if (!target) return;

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

    for (const entry of target.rangeEntries) {
      const employee = profileNameById.get(entry.user_id) ?? "Ukendt bruger";
      const duration = formatHours(getEntryDurationHours(entry.start_time, entry.end_time));
      csvRows.push([
        entry.entry_date,
        employee,
        entry.start_time,
        entry.end_time,
        duration,
        target.projectName,
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
    a.download = `lykketid-${projectSlug}-${reportRange}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const userUsage = useMemo(() => {
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
  }, [profiles, projectNameBySlug, timeEntries]);

  if (authLoading || profileLoading) {
    return (
      <main className="mx-auto flex h-full min-h-0 w-full overflow-y-auto px-4">
        <div className="rounded-xl border border-line-soft/45 bg-white/75 px-4 py-2 text-[13px] font-medium text-evergreen/75">
          Indlæser...
        </div>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (profile?.role !== "admin") {
    return (
      <main className="mx-auto flex h-full min-h-0 w-full max-w-xl overflow-y-auto px-4">
        <div className="w-full rounded-2xl border border-line-soft/60 bg-white/80 p-6 shadow-[0_16px_45px_-32px_rgba(15,42,29,0.38)]">
          <h1 className="text-[20px] font-bold text-forest">Ingen adgang</h1>
          <p className="mt-1 text-[13px] text-evergreen/70">
            Din bruger har ikke admin-rettigheder.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex rounded-xl border border-line-soft/70 bg-white px-3 py-2 text-[13px] font-semibold text-forest hover:bg-pastel/20"
            >
              Tilbage til app
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto h-full min-h-0 w-full max-w-6xl overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold tracking-tight text-forest">
            <Clock3 className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
            <span>LykkeTid Admin</span>
          </h1>
        </div>
        <div className="rounded-xl border border-line-soft/60 bg-white/75 px-3 py-2 text-right">
          <div className="text-[13px] font-semibold text-forest">
            {profile.full_name || session.user.email}
          </div>
          <div className="text-[12px] text-evergreen/65">
            {profile.title || "Admin"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("time-usage")}
          className={[
            "rounded-xl border px-3 py-2 text-[13px] font-semibold transition",
            activeTab === "time-usage"
              ? "border-accent/50 bg-accent/10 text-forest"
              : "border-line-soft/60 bg-white/70 text-evergreen/75 hover:bg-pastel/20",
          ].join(" ")}
        >
          Tidsforbrug
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("project-management")}
          className={[
            "rounded-xl border px-3 py-2 text-[13px] font-semibold transition",
            activeTab === "project-management"
              ? "border-accent/50 bg-accent/10 text-forest"
              : "border-line-soft/60 bg-white/70 text-evergreen/75 hover:bg-pastel/20",
          ].join(" ")}
        >
          Projekter
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={[
            "rounded-xl border px-3 py-2 text-[13px] font-semibold transition",
            activeTab === "users"
              ? "border-accent/50 bg-accent/10 text-forest"
              : "border-line-soft/60 bg-white/70 text-evergreen/75 hover:bg-pastel/20",
          ].join(" ")}
        >
          Brugere
        </button>
      </div>

      {adminDataError ? (
        <div className="mt-4 rounded-xl border border-rose-200/70 bg-rose-50/80 px-3 py-2 text-[12px] font-medium text-rose-700">
          {adminDataError}
        </div>
      ) : null}

      {adminDataLoading ? (
        <div className="mt-6 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-evergreen/20 border-t-accent" />
        </div>
      ) : activeTab === "time-usage" ? (
        <div className="mt-6 space-y-4">
          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-forest">Rapportperiode</h2>
              <div className="flex items-center gap-2">
                {([
                  ["weekly", "Uge"],
                  ["monthly", "Måned"],
                  ["all", "Alt"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReportRange(value)}
                    className={[
                      "rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition",
                      reportRange === value
                        ? "border-accent/50 bg-accent/10 text-forest"
                        : "border-line-soft/60 bg-white/70 text-evergreen/75 hover:bg-pastel/20",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <h2 className="text-[16px] font-semibold text-forest">Fordeling af tid pr. projekt</h2>
            {(() => {
              const rows = projectDashboardRows.filter((row) => row.periodHours > 0);
              const total = rows.reduce((sum, row) => sum + row.periodHours, 0);
              const segments = buildPieSegments(
                rows.map((row) => ({ projectName: row.projectName, totalHours: row.periodHours }))
              );
              const gradient =
                segments.length === 0
                  ? "conic-gradient(#d9e5d3 0deg 360deg)"
                  : `conic-gradient(${segments
                      .map((segment, i) => {
                        const color = getProjectColor(rows[i]?.projectSlug ?? "");
                        return `${color} ${segment.start}deg ${segment.end}deg`;
                      })
                      .join(", ")})`;

              return (
                <div className="mt-3 grid gap-4 lg:grid-cols-[18rem_1fr]">
                  <div className="rounded-xl border border-line-soft/35 bg-white/65 p-3">
                    <div className="text-[12px] font-semibold text-evergreen/75">
                      {reportRange === "weekly" ? "Denne uge" : reportRange === "monthly" ? "Denne måned" : "Al tid"}
                    </div>
                    <div className="mt-2 flex items-center justify-center">
                      <div
                        className="h-40 w-40 rounded-full border border-line-soft/45 shadow-[inset_0_1px_3px_rgba(15,42,29,0.08)]"
                        style={{ background: gradient }}
                        aria-label="Fordeling af tid på projekter"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {rows.length === 0 ? (
                      <div className="text-[13px] text-evergreen/65">Ingen tidsdata i perioden.</div>
                    ) : (
                      rows.map((row, index) => {
                        const color = getProjectColor(row.projectSlug);
                        const pct = total > 0 ? (row.periodHours / total) * 100 : 0;
                        const isSelected = selectedProjectSlug === row.projectSlug;
                        return (
                          <button
                            key={row.projectSlug}
                            type="button"
                            onClick={() => setSelectedProjectSlug(row.projectSlug)}
                            className={[
                              "flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition",
                              isSelected
                                ? "border-accent/45 bg-accent/10"
                                : "border-line-soft/25 bg-white/60 hover:bg-pastel/20",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: color }}
                                aria-hidden="true"
                              />
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-forest/8 text-[10px] font-semibold text-forest/75">
                                {index + 1}
                              </span>
                              <span className="font-medium text-forest/90">{row.projectName}</span>
                            </div>
                            <span className="text-evergreen/70">
                              {formatHours(row.periodHours)} t ({pct.toFixed(0)}%)
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <h2 className="text-[16px] font-semibold text-forest">Projektoversigt</h2>
            <div className="mt-3 space-y-2">
              {projectDashboardRows.map((row) => {
                const isOpen = selectedProjectSlug === row.projectSlug;
                const shareWidth = `${Math.max(3, row.sharePct)}%`;
                const color = getProjectColor(row.projectSlug);
                const avatarUsers = row.userIds.slice(0, 5);
                return (
                  <article
                    key={row.projectSlug}
                    className="rounded-xl border border-line-soft/40 bg-white/70"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedProjectSlug((current) =>
                          current === row.projectSlug ? null : row.projectSlug
                        )
                      }
                      className="w-full px-3 py-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-[14px] font-semibold text-forest">
                              {row.projectName}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-mint/55">
                            <div
                              className="h-full rounded-full"
                              style={{ width: shareWidth, backgroundColor: color }}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[13px] font-semibold text-evergreen">
                            {formatHours(row.periodHours)} t
                          </div>
                          <div className="text-[11px] text-evergreen/65">
                            {row.userIds.length} medarbejdere
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center">
                          {avatarUsers.map((userId, index) => {
                            const name = profileNameById.get(userId) ?? "Ukendt bruger";
                            const avatarUrl = avatarByUserId.get(userId) ?? null;
                            return (
                              <span
                                key={userId}
                                className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white text-[9px] font-semibold text-white"
                                style={{
                                  marginLeft: index === 0 ? 0 : -6,
                                  backgroundColor: avatarUrl ? undefined : "#4ca771",
                                }}
                                title={name}
                              >
                                {avatarUrl ? (
                                  <span
                                    className="h-full w-full bg-cover bg-center"
                                    style={{ backgroundImage: `url("${avatarUrl}")` }}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  getInitials(name)
                                )}
                              </span>
                            );
                          })}
                        </div>
                        <span className="text-[11px] font-medium text-evergreen/70">
                          {row.sharePct.toFixed(0)}% af {reportPeriodLabel}
                        </span>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-line-soft/35 px-3 pb-3 pt-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <section className="rounded-lg border border-line-soft/30 bg-white/75 p-3">
                            <div className="text-[12px] font-semibold text-forest">
                              Fordeling på brugere
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {row.byUser.length === 0 ? (
                                <div className="text-[12px] text-evergreen/65">
                                  Ingen registreringer i {reportPeriodLabel}.
                                </div>
                              ) : (
                                row.byUser.map((user) => (
                                  <div
                                    key={user.userId}
                                    className="flex items-center justify-between rounded-lg border border-line-soft/25 bg-white/65 px-2.5 py-1.5 text-[12px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-accent text-[10px] font-semibold text-white">
                                        {user.avatarUrl ? (
                                          <span
                                            className="h-full w-full bg-cover bg-center"
                                            style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          getInitials(user.userName)
                                        )}
                                      </span>
                                      <span className="font-medium text-forest/90">
                                        {user.userName}
                                      </span>
                                    </div>
                                    <span className="text-evergreen/70">
                                      {formatHours(user.hours)} t
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </section>

                          <section className="rounded-lg border border-line-soft/30 bg-white/75 p-3">
                            <div className="text-[12px] font-semibold text-forest">
                              Udvikling pr. måned
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {row.byMonth.length === 0 ? (
                                <div className="text-[12px] text-evergreen/65">
                                  Ingen historik endnu.
                                </div>
                              ) : (
                                row.byMonth.slice(0, 8).map((month) => {
                                  const maxMonth = row.byMonth[0]?.hours ?? 0;
                                  const widthPct =
                                    maxMonth > 0 ? (month.hours / maxMonth) * 100 : 0;
                                  return (
                                    <div key={month.monthKey}>
                                      <div className="mb-1 flex items-center justify-between text-[11px]">
                                        <span className="capitalize text-forest/85">
                                          {month.label}
                                        </span>
                                        <span className="font-medium text-evergreen/70">
                                          {formatHours(month.hours)} t
                                        </span>
                                      </div>
                                      <div className="h-1.5 overflow-hidden rounded-full bg-mint/55">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${Math.max(3, widthPct)}%`,
                                            backgroundColor: color,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </section>
                        </div>

                        {row.bySubcategory.length > 0 ? (
                          <section className="mt-3 rounded-lg border border-line-soft/30 bg-white/75 p-3">
                            <div className="text-[12px] font-semibold text-forest">
                              Fordeling på underpunkter
                            </div>
                            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                              {row.bySubcategory.map((sub) => (
                                <div
                                  key={`${row.projectSlug}-${sub.name}`}
                                  className="flex items-center justify-between rounded-lg border border-line-soft/20 bg-white/65 px-2.5 py-1.5 text-[12px]"
                                >
                                  <span className="text-forest/90">{sub.name}</span>
                                  <span className="text-evergreen/70">
                                    {formatHours(sub.hours)} t
                                  </span>
                                </div>
                              ))}
                            </div>
                          </section>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[12px] text-evergreen/70">
                            {reportPeriodLabel}: {formatHours(row.periodHours)} t · samlet:{" "}
                            {formatHours(row.totalHoursOverall)} t
                          </div>
                          <button
                            type="button"
                            onClick={() => exportProjectCsv(row.projectSlug)}
                            className="rounded-lg border border-line-soft/60 bg-white px-3 py-1.5 text-[12px] font-semibold text-forest transition hover:bg-pastel/20"
                          >
                            Download CSV
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : activeTab === "users" ? (
        <section className="mt-6 rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
          <h2 className="text-[16px] font-semibold text-forest">Brugere</h2>
          <div className="mt-3 space-y-3">
            {userUsage.map((user) => (
              <article
                key={user.id}
                className="rounded-xl border border-line-soft/45 bg-white/70 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-[12px] font-semibold text-white">
                      {user.avatarUrl ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                          aria-hidden="true"
                        />
                      ) : (
                        <span>{getInitials(user.fullName) || "?"}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-forest">
                        {user.fullName}
                      </div>
                      <div className="text-[12px] text-evergreen/65">
                        {user.title} · {user.role}
                      </div>
                      <div className="text-[11px] text-evergreen/55">
                        Oprettet: {formatCreatedAt(user.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-line-soft/35 bg-white/65 px-3 py-2 text-[12px] text-evergreen/70">
                    <div>Timer i alt: {formatHours(user.totalHours)}</div>
                    <div>Denne måned: {formatHours(user.currentMonthHours)}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <section className="rounded-lg border border-line-soft/30 bg-white/65 p-3">
                    <div className="text-[13px] font-semibold text-forest">Din status</div>
                    <div className="mt-0.5 text-[11px] text-evergreen/60">
                      Så god har du været til at timeregistrere den seneste uge
                    </div>
                    <div className="mt-2 space-y-2">
                      {user.recentWeekdayStatus.map((item) => (
                        <div key={item.dayKey}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="font-medium capitalize text-forest/80">
                              {item.weekday.replace(".", "")}
                            </span>
                            <span className="font-semibold text-evergreen">
                              {formatHours(item.hours)} t
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-mint/55">
                            <div
                              className={`h-full rounded-full ${item.barColor}`}
                              style={{ width: `${Math.max(3, item.normalized * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-line-soft/30 bg-white/65 p-3">
                    <div className="text-[13px] font-semibold text-forest">
                      Top 3 projekter (denne måned)
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {user.topProjects.length === 0 ? (
                        <div className="text-[12px] text-evergreen/60">
                          Ingen timer registreret denne måned.
                        </div>
                      ) : (
                        user.topProjects.map((project) => (
                          <div
                            key={`${user.id}-${project.projectSlug}`}
                            className="flex items-center justify-between rounded-lg border border-line-soft/20 bg-white/70 px-2.5 py-1.5 text-[12px]"
                          >
                            <span className="font-medium text-forest/90">{project.projectName}</span>
                            <span className="text-evergreen/70">
                              {formatHours(project.currentMonthHours)} t
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-6">
          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <h2 className="text-[16px] font-semibold text-forest">Opret projekt</h2>
            <form onSubmit={handleCreateProject} className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={projectName}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setProjectName(nextName);
                  setProjectSlug(slugify(nextName));
                }}
                placeholder="Navn"
                className="w-full rounded-lg border border-line-soft/70 bg-white px-3 py-2 text-[13px] text-forest outline-none focus:ring-2 focus:ring-accent/30"
                required
              />
              <input
                type="text"
                value={projectSlug}
                onChange={(e) => setProjectSlug(slugify(e.target.value))}
                placeholder="Slug"
                className="w-full rounded-lg border border-line-soft/70 bg-white px-3 py-2 text-[13px] text-forest outline-none focus:ring-2 focus:ring-accent/30"
                required
              />
              <input
                type="number"
                value={projectSortOrder}
                onChange={(e) => setProjectSortOrder(e.target.value)}
                placeholder="Sortering"
                className="w-full rounded-lg border border-line-soft/70 bg-white px-3 py-2 text-[13px] text-forest outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={creatingProject}
                className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:w-fit"
              >
                {creatingProject ? "Gemmer..." : "Opret projekt"}
              </button>
            </form>
            {createProjectError ? (
              <div className="mt-2 text-[12px] font-medium text-rose-700">
                {createProjectError}
              </div>
            ) : null}
          </section>

          <div className="mt-4 space-y-4">
          {projects.map((project) => {
            const projectSubs = subcategoriesByProjectId.get(project.id) ?? [];
            return (
              <section
                key={project.id}
                className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-semibold text-forest">
                      {project.name}
                    </h2>
                    <div className="mt-1 text-[12px] text-evergreen/70">
                      <span>{project.slug}</span>
                      <span className="mx-2 text-evergreen/35">·</span>
                      <span>{project.is_active ? "Aktiv" : "Inaktiv"}</span>
                      <span className="mx-2 text-evergreen/35">·</span>
                      <span>Sortering: {project.sort_order ?? "-"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-line-soft/70 bg-white px-3 py-2 text-[12px] font-semibold text-forest hover:bg-pastel/20"
                  >
                    Tilføj underpunkt
                  </button>
                </div>

                <div className="mt-4 border-t border-line-soft/35 pt-3">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-evergreen/60">
                    Underpunkter
                  </div>
                  {projectSubs.length === 0 ? (
                    <div className="mt-2 text-[13px] text-evergreen/65">
                      Ingen underpunkter endnu
                    </div>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {projectSubs.map((sub) => (
                        <li
                          key={sub.id}
                          className="flex items-center justify-between rounded-lg border border-line-soft/30 bg-white/70 px-3 py-2 text-[13px]"
                        >
                          <span className="font-medium text-forest/90">{sub.name}</span>
                          <span className="text-[12px] text-evergreen/60">
                            Sortering: {sub.sort_order ?? "-"} ·{" "}
                            {sub.is_active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
          </div>
        </div>
      )}

      <div className="mt-10 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Image
          src="/lykkeliga_logo.svg"
          alt="LykkeLiga"
          width={180}
          height={34}
          className="h-[28px] w-auto opacity-60"
          priority={false}
        />
      </div>
    </main>
  );
}
