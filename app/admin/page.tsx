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
};

type AdminTab = "time-usage" | "project-management";

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
        .select("id, full_name, title, avatar_url, role")
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
      .select("id, user_id, entry_date, start_time, end_time, project_id");

    if (error) return { error };
    setTimeEntries((data ?? []) as TimeEntryRow[]);
    return { error: null };
  }

  async function fetchProfilesForUsage() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, title, avatar_url, role")
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

  const timeUsageByProject = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const usageMap = new Map<
      string,
      { projectName: string; totalHours: number; currentMonthHours: number; sortOrder: number | null }
    >();

    const activeProjects = projects.filter((p) => p.is_active);

    for (const project of activeProjects) {
      usageMap.set(project.slug, {
        projectName: project.name,
        totalHours: 0,
        currentMonthHours: 0,
        sortOrder: project.sort_order,
      });
    }

    for (const entry of timeEntries) {
      const usage = usageMap.get(entry.project_id);
      if (!usage) continue;
      const hours = getEntryDurationHours(entry.start_time, entry.end_time);
      usage.totalHours += hours;

      const [yearRaw, monthRaw] = entry.entry_date.split("-");
      const y = Number(yearRaw);
      const m = Number(monthRaw);
      if (y === currentYear && m === currentMonth) {
        usage.currentMonthHours += hours;
      }
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
          totalHours: usage?.totalHours ?? 0,
          currentMonthHours: usage?.currentMonthHours ?? 0,
        };
      });
  }, [projects, timeEntries]);

  const projectNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.slug, project.name);
    }
    return map;
  }, [projects]);

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

    return profiles.map((p) => {
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
          totalHours: row.totalHours,
          currentMonthHours: row.currentMonthHours,
        }));

      return {
        id: p.id,
        fullName: p.full_name?.trim() || p.title || "Bruger",
        avatarUrl: p.avatar_url?.trim() || null,
        totalHours,
        currentMonthHours,
        projectsList,
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
          Administrer projekter
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
            <h2 className="text-[16px] font-semibold text-forest">Fordeling af tid pr. projekt</h2>
            {(() => {
              const palette = [
                "#4ca771",
                "#6b9071",
                "#375534",
                "#c0e6ba",
                "#5f7f66",
                "#84b18f",
                "#f4b860",
                "#7a9f83",
              ];
              const allRows = timeUsageByProject.filter((row) => row.totalHours > 0);
              const monthRows = timeUsageByProject.filter(
                (row) => row.currentMonthHours > 0
              );
              const allTotal = allRows.reduce((sum, row) => sum + row.totalHours, 0);
              const monthTotal = monthRows.reduce(
                (sum, row) => sum + row.currentMonthHours,
                0
              );
              const allSegments = buildPieSegments(
                allRows.map((row) => ({ projectName: row.projectName, totalHours: row.totalHours }))
              );
              const monthSegments = buildPieSegments(
                monthRows.map((row) => ({
                  projectName: row.projectName,
                  totalHours: row.currentMonthHours,
                }))
              );
              const allGradient =
                allSegments.length === 0
                  ? "conic-gradient(#d9e5d3 0deg 360deg)"
                  : `conic-gradient(${allSegments
                      .map((segment, i) => {
                        const color = palette[i % palette.length];
                        return `${color} ${segment.start}deg ${segment.end}deg`;
                      })
                      .join(", ")})`;
              const monthGradient =
                monthSegments.length === 0
                  ? "conic-gradient(#d9e5d3 0deg 360deg)"
                  : `conic-gradient(${monthSegments
                      .map((segment, i) => {
                        const color = palette[i % palette.length];
                        return `${color} ${segment.start}deg ${segment.end}deg`;
                      })
                      .join(", ")})`;

              return (
                <div className="mt-3 space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-line-soft/35 bg-white/65 p-3">
                      <div className="text-[12px] font-semibold text-evergreen/75">
                        Al tid
                      </div>
                      <div className="mt-2 flex items-center justify-center">
                        <div
                          className="h-40 w-40 rounded-full border border-line-soft/45 shadow-[inset_0_1px_3px_rgba(15,42,29,0.08)]"
                          style={{ background: allGradient }}
                          aria-label="Fordeling af samlet tid på projekter"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-line-soft/35 bg-white/65 p-3">
                      <div className="text-[12px] font-semibold text-evergreen/75">
                        Denne måned
                      </div>
                      <div className="mt-2 flex items-center justify-center">
                        <div
                          className="h-40 w-40 rounded-full border border-line-soft/45 shadow-[inset_0_1px_3px_rgba(15,42,29,0.08)]"
                          style={{ background: monthGradient }}
                          aria-label="Fordeling af månedens tid på projekter"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[16rem] flex-1 space-y-1.5">
                    {allRows.length === 0 ? (
                      <div className="text-[13px] text-evergreen/65">
                        Ingen tidsdata endnu.
                      </div>
                    ) : (
                      allRows.map((row, i) => {
                        const color = palette[i % palette.length];
                        const pctAll = allTotal > 0 ? (row.totalHours / allTotal) * 100 : 0;
                        const pctMonth =
                          monthTotal > 0 ? (row.currentMonthHours / monthTotal) * 100 : 0;
                        return (
                          <div
                            key={row.projectName}
                            className="flex items-center justify-between rounded-lg border border-line-soft/25 bg-white/60 px-2.5 py-1.5 text-[12px]"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: color }}
                                aria-hidden="true"
                              />
                              <span className="font-medium text-forest/90">
                                {row.projectName}
                              </span>
                            </div>
                            <span className="text-evergreen/70">
                              I alt {formatHours(row.totalHours)} t ({pctAll.toFixed(0)}%) · Måned{" "}
                              {formatHours(row.currentMonthHours)} t ({pctMonth.toFixed(0)}%)
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <h2 className="text-[16px] font-semibold text-forest">Brugere</h2>
            <div className="mt-3 space-y-3">
              {userUsage.map((user) => (
                <article
                  key={user.id}
                  className="rounded-xl border border-line-soft/45 bg-white/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-[12px] font-semibold text-white">
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
                          Timer i alt: {formatHours(user.totalHours)} · Denne måned:{" "}
                          {formatHours(user.currentMonthHours)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-line-soft/30 pt-2">
                    <div className="text-[11px] uppercase tracking-wide text-evergreen/55">
                      Projektfordeling
                    </div>
                    {user.projectsList.length === 0 ? (
                      <div className="mt-1 text-[12px] text-evergreen/60">
                        Ingen registreringer endnu
                      </div>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {user.projectsList.map((projectRow) => (
                          <li
                            key={`${user.id}-${projectRow.projectName}`}
                            className="flex items-center justify-between rounded-lg border border-line-soft/30 bg-white/60 px-2.5 py-1.5 text-[12px]"
                          >
                            <span className="font-medium text-forest/90">
                              {projectRow.projectName}
                            </span>
                            <span className="text-evergreen/65">
                              I alt: {formatHours(projectRow.totalHours)} · Denne måned:{" "}
                              {formatHours(projectRow.currentMonthHours)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <h2 className="text-[16px] font-semibold text-forest">Projekter</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-evergreen/60">
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Projekt
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Timer i alt
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 font-semibold">
                      Timer denne måned
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {timeUsageByProject.map((row) => (
                    <tr key={row.projectName} className="text-[13px] text-forest/90">
                      <td className="border-b border-line-soft/20 py-2 pr-3">
                        {row.projectName}
                      </td>
                      <td className="border-b border-line-soft/20 py-2 pr-3">
                        {formatHours(row.totalHours)}
                      </td>
                      <td className="border-b border-line-soft/20 py-2">
                        {formatHours(row.currentMonthHours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
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
