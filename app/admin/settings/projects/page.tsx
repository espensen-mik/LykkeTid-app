"use client";

import {
  Check,
  Folder,
  FolderCog,
  ListTree,
  Pencil,
  Plus,
  Save,
  Settings2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAdminContext } from "../../admin-provider";
import { getProjectColor, slugify } from "../../admin-utils";

export default function AdminProjectSetupPage() {
  const {
    projects,
    subcategoriesByProjectId,
    projectName,
    setProjectName,
    projectSlug,
    setProjectSlug,
    projectSortOrder,
    setProjectSortOrder,
    projectColor,
    setProjectColor,
    projectIsActive,
    setProjectIsActive,
    handleCreateProject,
    creatingProject,
    createProjectError,
    openSubcategoryProjectId,
    openSubcategoryForm,
    closeSubcategoryForm,
    newSubcategoryName,
    setNewSubcategoryName,
    newSubcategorySortOrder,
    setNewSubcategorySortOrder,
    isSavingSubcategory,
    subcategoryError,
    handleCreateSubcategory,
    updateProject,
    updateSubcategory,
  } = useAdminContext();

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [editingProjectSlug, setEditingProjectSlug] = useState("");
  const [editingProjectColor, setEditingProjectColor] = useState("#6050DC");
  const [editingProjectSortOrder, setEditingProjectSortOrder] = useState("0");
  const [editingProjectIsActive, setEditingProjectIsActive] = useState(true);
  const [projectActionError, setProjectActionError] = useState("");

  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [editingSubcategorySortOrder, setEditingSubcategorySortOrder] = useState("0");
  const [editingSubcategoryIsActive, setEditingSubcategoryIsActive] = useState(true);
  const [subcategoryActionError, setSubcategoryActionError] = useState("");

  const beginEditProject = (project: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    sort_order: number | null;
    is_active: boolean;
  }) => {
    setProjectActionError("");
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
    setEditingProjectSlug(project.slug);
    setEditingProjectColor(project.color?.trim() || getProjectColor(project.slug));
    setEditingProjectSortOrder(String(project.sort_order ?? 0));
    setEditingProjectIsActive(project.is_active);
  };

  const saveProjectEdit = async () => {
    if (!editingProjectId) return;
    const ok = await updateProject({
      projectId: editingProjectId,
      name: editingProjectName,
      slug: editingProjectSlug,
      color: editingProjectColor,
      sortOrder: editingProjectSortOrder,
      isActive: editingProjectIsActive,
    });
    if (!ok) {
      setProjectActionError("Kunne ikke opdatere projekt");
      return;
    }
    setEditingProjectId(null);
  };

  const beginEditSubcategory = (subcategory: {
    id: string;
    name: string;
    sort_order: number | null;
    is_active: boolean;
  }) => {
    setSubcategoryActionError("");
    setEditingSubcategoryId(subcategory.id);
    setEditingSubcategoryName(subcategory.name);
    setEditingSubcategorySortOrder(String(subcategory.sort_order ?? 0));
    setEditingSubcategoryIsActive(subcategory.is_active);
  };

  const saveSubcategoryEdit = async () => {
    if (!editingSubcategoryId) return;
    const ok = await updateSubcategory({
      subcategoryId: editingSubcategoryId,
      name: editingSubcategoryName,
      sortOrder: editingSubcategorySortOrder,
      isActive: editingSubcategoryIsActive,
    });
    if (!ok) {
      setSubcategoryActionError("Kunne ikke opdatere underpunkt");
      return;
    }
    setEditingSubcategoryId(null);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8FAF9] ring-1 ring-black/[0.06]">
            <Settings2 className="h-5 w-5 text-[#0F2A1D]/75" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A1D]">
            Projektopsætning
          </h1>
        </div>
        <p className="mt-1 text-sm text-[#0F2A1D]/55">
          Administrér projekter, farver og underpunkter
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.08)] ring-1 ring-black/[0.04]">
        <h2 className="flex items-center gap-2 text-lg font-medium text-[#0F2A1D]">
          <Plus className="h-5 w-5" />
          Opret projekt
        </h2>
        <form onSubmit={handleCreateProject} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            type="text"
            value={projectName}
            onChange={(e) => {
              const next = e.target.value;
              setProjectName(next);
              setProjectSlug(slugify(next));
            }}
            placeholder="Navn"
            required
            className="w-full rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-3 py-2.5 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
          />
          <input
            type="text"
            value={projectSlug}
            onChange={(e) => setProjectSlug(slugify(e.target.value))}
            placeholder="Slug"
            required
            className="w-full rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-3 py-2.5 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
          />
          <input
            type="color"
            value={projectColor}
            onChange={(e) => setProjectColor(e.target.value)}
            className="h-[44px] w-full cursor-pointer rounded-xl border border-black/[0.08] bg-[#F8FAF9] p-1"
            aria-label="Projektfarve"
          />
          <input
            type="number"
            value={projectSortOrder}
            onChange={(e) => setProjectSortOrder(e.target.value)}
            placeholder="Sortering"
            className="w-full rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-3 py-2.5 text-sm text-[#0F2A1D] outline-none ring-[#0F2A1D]/15 focus:ring-2"
          />
          <label className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-3 py-2.5 text-sm text-[#0F2A1D]/80">
            <input
              type="checkbox"
              checked={projectIsActive}
              onChange={(e) => setProjectIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            Aktiv
          </label>
          <div className="flex gap-2 md:col-span-2 xl:col-span-5">
            <button
              type="submit"
              disabled={creatingProject}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F2A1D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {creatingProject ? "Gemmer..." : "Gem projekt"}
            </button>
            <button
              type="button"
              onClick={() => {
                setProjectName("");
                setProjectSlug("");
                setProjectSortOrder("0");
                setProjectColor("#6050DC");
                setProjectIsActive(true);
              }}
              className="rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F2A1D]/75 hover:bg-[#F8FAF9]"
            >
              Nulstil
            </button>
          </div>
        </form>
        {createProjectError ? (
          <p className="mt-3 text-sm font-medium text-[#D62839]">{createProjectError}</p>
        ) : null}
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-medium text-[#0F2A1D]">Alle projekter</h2>
        {projects.map((project) => {
          const subs = subcategoriesByProjectId.get(project.id) ?? [];
          const isEditingProject = editingProjectId === project.id;
          return (
            <article
              key={project.id}
              className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.08)] ring-1 ring-black/[0.04]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color || getProjectColor(project.slug) }}
                    />
                    <h3 className="truncate text-lg font-semibold text-[#0F2A1D]">{project.name}</h3>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        project.is_active
                          ? "bg-[#22C55E]/15 text-[#0F2A1D]"
                          : "bg-[#D62839]/12 text-[#0F2A1D]/70",
                      ].join(" ")}
                    >
                      {project.is_active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#0F2A1D]/55">
                    {project.slug} · sortering {project.sort_order ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => beginEditProject(project)}
                    className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-[#F8FAF9] px-3 py-1.5 text-sm font-semibold text-[#0F2A1D]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rediger
                  </button>
                  <button
                    type="button"
                    onClick={() => openSubcategoryForm(project.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-[#F8FAF9] px-3 py-1.5 text-sm font-semibold text-[#0F2A1D]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Underpunkt
                  </button>
                </div>
              </div>

              {isEditingProject ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-black/[0.06] bg-[#F8FAF9] p-4 md:grid-cols-2 xl:grid-cols-5">
                  <input
                    type="text"
                    value={editingProjectName}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEditingProjectName(next);
                      setEditingProjectSlug(slugify(next));
                    }}
                    className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]"
                  />
                  <input
                    type="text"
                    value={editingProjectSlug}
                    onChange={(e) => setEditingProjectSlug(slugify(e.target.value))}
                    className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]"
                  />
                  <input
                    type="color"
                    value={editingProjectColor}
                    onChange={(e) => setEditingProjectColor(e.target.value)}
                    className="h-[40px] rounded-lg border border-black/[0.08] bg-white p-1"
                  />
                  <input
                    type="number"
                    value={editingProjectSortOrder}
                    onChange={(e) => setEditingProjectSortOrder(e.target.value)}
                    className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]"
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]">
                    <input
                      type="checkbox"
                      checked={editingProjectIsActive}
                      onChange={(e) => setEditingProjectIsActive(e.target.checked)}
                    />
                    Aktiv
                  </label>
                  <div className="flex gap-2 md:col-span-2 xl:col-span-5">
                    <button
                      type="button"
                      onClick={() => void saveProjectEdit()}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0F2A1D] px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Gem
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProjectId(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-sm font-semibold text-[#0F2A1D]/75"
                    >
                      <X className="h-3.5 w-3.5" />
                      Annuller
                    </button>
                  </div>
                </div>
              ) : null}

              {projectActionError ? (
                <p className="mt-2 text-sm font-medium text-[#D62839]">{projectActionError}</p>
              ) : null}

              {openSubcategoryProjectId === project.id ? (
                <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#F8FAF9] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={newSubcategoryName}
                      onChange={(e) => setNewSubcategoryName(e.target.value)}
                      placeholder="Nyt underpunkt"
                      className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]"
                    />
                    <input
                      type="number"
                      value={newSubcategorySortOrder}
                      onChange={(e) => setNewSubcategorySortOrder(e.target.value)}
                      placeholder="Sortering"
                      className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateSubcategory(project.id)}
                      disabled={isSavingSubcategory || !newSubcategoryName.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0F2A1D] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tilfoej
                    </button>
                    <button
                      type="button"
                      onClick={closeSubcategoryForm}
                      className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-sm font-semibold text-[#0F2A1D]/75"
                    >
                      <X className="h-3.5 w-3.5" />
                      Luk
                    </button>
                  </div>
                  {subcategoryError ? (
                    <p className="mt-2 text-sm font-medium text-[#D62839]">{subcategoryError}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 border-t border-black/[0.06] pt-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#0F2A1D]/75">
                  <ListTree className="h-4 w-4" />
                  Underpunkter
                </div>
                {subs.length === 0 ? (
                  <p className="text-sm text-[#0F2A1D]/55">Ingen underpunkter endnu.</p>
                ) : (
                  <ul className="space-y-2">
                    {subs.map((sub) => {
                      const isEditingSub = editingSubcategoryId === sub.id;
                      return (
                        <li key={sub.id} className="rounded-xl px-3 py-2 ring-1 ring-black/[0.04]">
                          {isEditingSub ? (
                            <div className="grid gap-2 md:grid-cols-[1fr_140px_120px_auto]">
                              <input
                                type="text"
                                value={editingSubcategoryName}
                                onChange={(e) => setEditingSubcategoryName(e.target.value)}
                                className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]"
                              />
                              <input
                                type="number"
                                value={editingSubcategorySortOrder}
                                onChange={(e) => setEditingSubcategorySortOrder(e.target.value)}
                                className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#0F2A1D]"
                              />
                              <label className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={editingSubcategoryIsActive}
                                  onChange={(e) => setEditingSubcategoryIsActive(e.target.checked)}
                                />
                                Aktiv
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveSubcategoryEdit()}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#0F2A1D] px-3 py-1.5 text-sm font-semibold text-white"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Gem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSubcategoryId(null)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-sm font-semibold text-[#0F2A1D]/75"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4 text-[#0F2A1D]/45" />
                                <span className="font-medium text-[#0F2A1D]">{sub.name}</span>
                                <span className="text-xs text-[#0F2A1D]/50">
                                  sortering {sub.sort_order ?? 0}
                                </span>
                                <span
                                  className={[
                                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    sub.is_active
                                      ? "bg-[#22C55E]/15 text-[#0F2A1D]"
                                      : "bg-[#D62839]/12 text-[#0F2A1D]/70",
                                  ].join(" ")}
                                >
                                  {sub.is_active ? "Aktiv" : "Inaktiv"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => beginEditSubcategory(sub)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-sm font-semibold text-[#0F2A1D]/75"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Rediger
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateSubcategory({
                                      subcategoryId: sub.id,
                                      name: sub.name,
                                      sortOrder: String(sub.sort_order ?? 0),
                                      isActive: !sub.is_active,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-[#F8FAF9] px-3 py-1.5 text-sm font-semibold text-[#0F2A1D]/75"
                                >
                                  <FolderCog className="h-3.5 w-3.5" />
                                  {sub.is_active ? "Deaktiver" : "Aktiver"}
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {subcategoryActionError ? (
                  <p className="mt-2 text-sm font-medium text-[#D62839]">{subcategoryActionError}</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#0F2A1D]/60 hover:text-[#0F2A1D]"
        >
          ← Tilbage til dashboard
        </Link>
      </div>
    </div>
  );
}
