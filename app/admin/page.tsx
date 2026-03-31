"use client";

import { LoginScreen } from "@/app/components/login-screen";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const [adminDataError, setAdminDataError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [projectSortOrder, setProjectSortOrder] = useState("0");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");

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

      const [projectsResult, subcategoriesResult] = await Promise.all([
        fetchProjects(),
        fetchSubcategories(),
      ]);

      if (!isActive) return;

      if (projectsResult.error || subcategoriesResult.error) {
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

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  if (authLoading || profileLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full items-center justify-center px-4">
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
      <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center justify-center px-4">
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
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-forest">Admin</h1>
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

      {adminDataError ? (
        <div className="mt-4 rounded-xl border border-rose-200/70 bg-rose-50/80 px-3 py-2 text-[12px] font-medium text-rose-700">
          {adminDataError}
        </div>
      ) : null}

      {adminDataLoading ? (
        <div className="mt-6 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-evergreen/20 border-t-accent" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <h2 className="text-[16px] font-semibold text-forest">Projekter</h2>
            <form onSubmit={handleCreateProject} className="mt-3 space-y-2">
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
                className="w-full rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {creatingProject ? "Gemmer..." : "Opret projekt"}
              </button>
              {createProjectError ? (
                <div className="text-[12px] font-medium text-rose-700">
                  {createProjectError}
                </div>
              ) : null}
            </form>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-evergreen/60">
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Navn
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Slug
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Aktiv
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 font-semibold">
                      Sortering
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="text-[13px] text-forest/90">
                      <td className="border-b border-line-soft/20 py-2 pr-3">
                        {project.name}
                      </td>
                      <td className="border-b border-line-soft/20 py-2 pr-3 text-evergreen/70">
                        {project.slug}
                      </td>
                      <td className="border-b border-line-soft/20 py-2 pr-3">
                        {project.is_active ? "Ja" : "Nej"}
                      </td>
                      <td className="border-b border-line-soft/20 py-2">
                        {project.sort_order ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-line-soft/60 bg-white/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,42,29,0.3)]">
            <h2 className="text-[16px] font-semibold text-forest">Underpunkter</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-evergreen/60">
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Navn
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Projekt
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 pr-3 font-semibold">
                      Aktiv
                    </th>
                    <th className="border-b border-line-soft/35 pb-2 font-semibold">
                      Sortering
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subcategories.map((sub) => (
                    <tr key={sub.id} className="text-[13px] text-forest/90">
                      <td className="border-b border-line-soft/20 py-2 pr-3">
                        {sub.name}
                      </td>
                      <td className="border-b border-line-soft/20 py-2 pr-3 text-evergreen/70">
                        {projectNameById.get(sub.project_id) ?? "Ukendt projekt"}
                      </td>
                      <td className="border-b border-line-soft/20 py-2 pr-3">
                        {sub.is_active ? "Ja" : "Nej"}
                      </td>
                      <td className="border-b border-line-soft/20 py-2">
                        {sub.sort_order ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
