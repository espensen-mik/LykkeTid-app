"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useAdminContext } from "../admin-provider";
import { formatHours, getInitials, getProjectColor, slugify } from "../admin-utils";

export default function AdminProjectsPage() {
  const {
    projects,
    projectDashboardRows,
    profileNameById,
    avatarByUserId,
    periodMeta,
    summaryPeriodLabel,
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
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A1D]">Projekter</h1>
        <p className="mt-1 text-sm text-[#0F2A1D]/55">
          Oversigt over timer og fordeling · {summaryPeriodLabel}
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
        <div className="border-b border-black/[0.06] px-6 py-4">
          <h2 className="text-lg font-medium text-[#0F2A1D]">Alle projekter</h2>
          <p className="text-sm text-[#0F2A1D]/50">{periodMeta.helper}</p>
        </div>
        <ul className="divide-y divide-black/[0.06]">
          {projectDashboardRows.length === 0 ? (
            <li className="px-6 py-10 text-center text-sm text-[#0F2A1D]/55">Ingen projekter endnu.</li>
          ) : (
            projectDashboardRows.map((row) => {
              const shareWidth = `${Math.max(4, row.sharePct)}%`;
              const color = getProjectColor(row.projectSlug);
              const avatarUsers = row.userIds.slice(0, 5);
              return (
                <li key={row.projectSlug}>
                  <Link
                    href={`/admin/project/${encodeURIComponent(row.projectSlug)}`}
                    className="flex flex-col gap-4 px-6 py-5 transition hover:bg-[#F8FAF9] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate text-base font-semibold text-[#0F2A1D]">
                          {row.projectName}
                        </span>
                      </div>
                      <div className="mt-3 max-w-xl">
                        <div className="mb-1 flex justify-between text-xs font-medium text-[#0F2A1D]/55">
                          <span>Andel af periode</span>
                          <span>{row.sharePct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#F8FAF9] ring-1 ring-black/[0.05]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: shareWidth, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold tabular-nums text-[#0F2A1D]">
                          {formatHours(row.periodHours)}{" "}
                          <span className="text-base font-semibold text-[#0F2A1D]/45">t</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-[#0F2A1D]/50">
                          <Users className="h-3.5 w-3.5" />
                          {row.userIds.length} medarbejdere
                        </div>
                      </div>
                      <div className="flex -space-x-2">
                        {avatarUsers.map((userId, index) => {
                          const name = profileNameById.get(userId) ?? "Ukendt bruger";
                          const avatarUrl = avatarByUserId.get(userId) ?? null;
                          return (
                            <span
                              key={userId}
                              className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-sm"
                              style={{
                                zIndex: avatarUsers.length - index,
                                backgroundColor: avatarUrl ? undefined : "#C0E6BA",
                                color: "#0F2A1D",
                              }}
                              title={name}
                            >
                              {avatarUrl ? (
                                <span
                                  className="h-full w-full bg-cover bg-center"
                                  style={{ backgroundImage: `url("${avatarUrl}")` }}
                                />
                              ) : (
                                getInitials(name)
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </section>

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
