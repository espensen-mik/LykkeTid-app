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

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([]);
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
      .select("id, entry_date, start_time, end_time, project_id");

    if (error) return { error };
    setTimeEntries((data ?? []) as TimeEntryRow[]);
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

      const [projectsResult, subcategoriesResult, timeEntriesResult] = await Promise.all([
        fetchProjects(),
        fetchSubcategories(),
        fetchTimeEntries(),
      ]);

      if (!isActive) return;

      if (projectsResult.error || subcategoriesResult.error || timeEntriesResult.error) {
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

    for (const project of projects) {
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

    return projects
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
          <p className="mt-1 text-[13px] text-evergreen/70">
            Projekter og underpunkter
          </p>
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
        <section className="mt-6 rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
          <h2 className="text-[16px] font-semibold text-forest">Tidsforbrug pr. projekt</h2>
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
