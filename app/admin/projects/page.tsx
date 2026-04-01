"use client";

import Link from "next/link";
import { useAdminContext } from "../admin-provider";
import { slugify } from "../admin-utils";

export default function AdminProjectsPage() {
  const {
    projects,
    projectName,
    setProjectName,
    projectSlug,
    setProjectSlug,
    projectSortOrder,
    setProjectSortOrder,
    handleCreateProject,
    creatingProject,
    createProjectError,
    subcategoriesByProjectId,
    openSubcategoryProjectId,
    newSubcategoryName,
    setNewSubcategoryName,
    newSubcategorySortOrder,
    setNewSubcategorySortOrder,
    subcategoryError,
    isSavingSubcategory,
    openSubcategoryForm,
    closeSubcategoryForm,
    handleCreateSubcategory,
  } = useAdminContext();

  return (
    <div className="mx-auto max-w-[1400px] space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A1D]">Projektopsaetning</h1>
        <p className="mt-1 text-sm text-[#0F2A1D]/55">Opret projekter og administrer underpunkter</p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.08)] ring-1 ring-black/[0.04]">
        <h2 className="text-lg font-medium text-[#0F2A1D]">Opret projekt</h2>
        <form onSubmit={handleCreateProject} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => {
              const nextName = e.target.value;
              setProjectName(nextName);
              setProjectSlug(slugify(nextName));
            }}
            placeholder="Navn"
            className="w-full rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-4 py-2.5 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
            required
          />
          <input
            type="text"
            value={projectSlug}
            onChange={(e) => setProjectSlug(slugify(e.target.value))}
            placeholder="Slug"
            className="w-full rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-4 py-2.5 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
            required
          />
          <input
            type="number"
            value={projectSortOrder}
            onChange={(e) => setProjectSortOrder(e.target.value)}
            placeholder="Sortering"
            className="w-full rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-4 py-2.5 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
          />
          <button
            type="submit"
            disabled={creatingProject}
            className="rounded-xl bg-[#0F2A1D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 sm:col-span-3 sm:w-fit"
          >
            {creatingProject ? "Gemmer..." : "Opret projekt"}
          </button>
        </form>
        {createProjectError ? (
          <div className="mt-3 text-sm font-medium text-[#D62839]">{createProjectError}</div>
        ) : null}
      </section>

      <div className="space-y-6">
        {projects.map((project) => {
          const projectSubs = subcategoriesByProjectId.get(project.id) ?? [];
          return (
            <section
              key={project.id}
              className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.08)] ring-1 ring-black/[0.04]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/admin/project/${encodeURIComponent(project.slug)}`}
                    className="text-lg font-semibold text-[#0F2A1D] hover:underline"
                  >
                    {project.name}
                  </Link>
                  <div className="mt-1 text-sm text-[#0F2A1D]/55">
                    <span>{project.slug}</span>
                    <span className="mx-2 text-[#0F2A1D]/25">·</span>
                    <span>{project.is_active ? "Aktiv" : "Inaktiv"}</span>
                    <span className="mx-2 text-[#0F2A1D]/25">·</span>
                    <span>Sortering: {project.sort_order ?? "-"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openSubcategoryForm(project.id)}
                  className="rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-4 py-2 text-sm font-semibold text-[#0F2A1D] transition hover:bg-black/[0.04]"
                >
                  Tilføj underpunkt
                </button>
              </div>

              {openSubcategoryProjectId === project.id ? (
                <div className="mt-5 rounded-xl border border-black/[0.06] bg-[#F8FAF9] p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[#0F2A1D]/70">Navn</span>
                      <input
                        type="text"
                        value={newSubcategoryName}
                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                        placeholder="Nyt underpunkt"
                        className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[#0F2A1D]/70">
                        Sortering
                      </span>
                      <input
                        type="number"
                        value={newSubcategorySortOrder}
                        onChange={(e) => setNewSubcategorySortOrder(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
                      />
                    </label>
                  </div>
                  {subcategoryError ? (
                    <div className="mt-2 text-sm font-medium text-[#D62839]">{subcategoryError}</div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateSubcategory(project.id)}
                      disabled={isSavingSubcategory || !newSubcategoryName.trim()}
                      className="rounded-xl bg-[#0F2A1D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSavingSubcategory ? "Gemmer..." : "Gem"}
                    </button>
                    <button
                      type="button"
                      onClick={closeSubcategoryForm}
                      disabled={isSavingSubcategory}
                      className="rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-[#0F2A1D]/75 hover:bg-[#F8FAF9] disabled:opacity-60"
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 border-t border-black/[0.06] pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#0F2A1D]/45">
                  Underpunkter
                </div>
                {projectSubs.length === 0 ? (
                  <div className="mt-2 text-sm text-[#0F2A1D]/55">Ingen underpunkter endnu</div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {projectSubs.map((sub) => (
                      <li
                        key={sub.id}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 ring-1 ring-black/[0.04]"
                      >
                        <span className="font-medium text-[#0F2A1D]">{sub.name}</span>
                        <span className="text-xs text-[#0F2A1D]/50">
                          Sortering: {sub.sort_order ?? "-"} · {sub.is_active ? "Aktiv" : "Inaktiv"}
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
  );
}
