"use client";

import { LoginScreen } from "@/app/components/login-screen";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Clock3,
  LayoutDashboard,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import { useAdminContext } from "./admin-provider";
import { getInitials } from "./admin-utils";

const BG = "#F8FAF9";
const PRIMARY = "#0F2A1D";
const MUTED = "rgba(15, 42, 29, 0.55)";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    session,
    authLoading,
    profile,
    profileLoading,
    projects,
    adminDataLoading,
    adminDataError,
  } = useAdminContext();

  if (authLoading || profileLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: BG }}
      >
        <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-sm font-medium text-[#0F2A1D]/75 shadow-sm">
          Indlæser...
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (profile?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: BG }}>
        <div className="w-full max-w-md rounded-2xl border border-black/[0.06] bg-white p-8 shadow-[0_8px_30px_-12px_rgba(15,42,29,0.12)]">
          <h1 className="text-xl font-semibold text-[#0F2A1D]">Ingen adgang</h1>
          <p className="mt-2 text-sm text-[#0F2A1D]/65">
            Din bruger har ikke admin-rettigheder.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F2A1D] transition hover:bg-[#F8FAF9]"
            >
              Tilbage til app
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const adminDisplayName = profile.full_name?.trim() || session.user.email || "Admin";
  const adminDisplayTitle = profile.title?.trim() || "Admin";
  const adminAvatarUrl = profile.avatar_url?.trim() || null;
  const adminInitials = getInitials(adminDisplayName);

  const navMain = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/admin" },
    { href: "/admin/users", label: "Brugere", icon: Users, match: (p: string) => p === "/admin/users" },
    {
      href: "/admin/settings/projects",
      label: "Projektopsætning",
      icon: Settings2,
      match: (p: string) => p === "/admin/settings/projects" || p === "/admin/projects",
    },
  ];

  const activeProjects = projects.filter((p) => p.is_active);

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background: BG }}>
      <aside
        className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r border-black/[0.06] bg-white shadow-[4px_0_24px_-12px_rgba(15,42,29,0.08)]"
        aria-label="Admin navigation"
      >
        <div className="flex h-16 items-center gap-2 border-b border-black/[0.06] px-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "color-mix(in srgb, #C0E6BA 35%, white)" }}
          >
            <Clock3 className="h-5 w-5" style={{ color: PRIMARY }} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight" style={{ color: PRIMARY }}>
              LykkeTid
            </div>
            <div className="text-[11px] font-medium" style={{ color: MUTED }}>
              Admin
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            Menu
          </p>
          <ul className="space-y-1">
            {navMain.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "border-l-[3px] border-[#0F2A1D] bg-[color-mix(in_srgb,#C0E6BA_22%,white)] pl-[9px] text-[#0F2A1D]"
                        : "border-l-[3px] border-transparent pl-3 text-[#0F2A1D]/75 hover:bg-black/[0.03]",
                    ].join(" ")}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0 opacity-90" strokeWidth={2} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            Projektdashboards
          </p>
          <ul className="space-y-0.5">
            {activeProjects.length === 0 ? (
              <li className="px-3 py-2 text-xs" style={{ color: MUTED }}>
                Ingen projekter
              </li>
            ) : (
              activeProjects.map((p) => {
                const href = `/admin/project/${encodeURIComponent(p.slug)}`;
                const active = pathname === href;
                return (
                  <li key={p.id}>
                    <Link
                      href={href}
                      className={[
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                        active
                          ? "border-l-[3px] border-[#0F2A1D] bg-[color-mix(in_srgb,#C0E6BA_22%,white)] pl-[9px] font-medium text-[#0F2A1D]"
                          : "border-l-[3px] border-transparent pl-3 text-[#0F2A1D]/70 hover:bg-black/[0.03]",
                      ].join(" ")}
                    >
                      <BarChart3 className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>

        </nav>

        <div className="border-t border-black/[0.06] p-4">
          <Image
            src="/lykkeliga_logo.svg"
            alt="LykkeLiga"
            width={140}
            height={26}
            className="h-5 w-auto opacity-50"
          />
        </div>
      </aside>

      <div className="flex h-full min-h-0 flex-1 flex-col pl-[240px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-black/[0.06] bg-white/90 px-6 backdrop-blur-md">
          <div className="relative max-w-md flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0F2A1D]/35"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Søg i admin..."
              className="w-full rounded-xl border border-black/[0.06] bg-[#F8FAF9] py-2.5 pl-10 pr-4 text-sm text-[#0F2A1D] placeholder:text-[#0F2A1D]/35 outline-none ring-[#0F2A1D]/15 focus:ring-2"
              readOnly
              aria-label="Søg (kommer snart)"
            />
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#F8FAF9] px-3 py-2 shadow-sm">
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white ring-2 ring-white" style={{ backgroundColor: adminAvatarUrl ? undefined : "#C0E6BA", color: PRIMARY }}>
              {adminAvatarUrl ? (
                <span
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${adminAvatarUrl}")` }}
                  aria-hidden
                />
              ) : (
                adminInitials || "A"
              )}
            </span>
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-sm font-semibold text-[#0F2A1D]">{adminDisplayName}</div>
              <div className="flex items-center gap-1 text-xs text-[#0F2A1D]/55">
                <Activity className="h-3.5 w-3.5" />
                {adminDisplayTitle}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {adminDataLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#0F2A1D]/15 border-t-[#0F2A1D]" />
            </div>
          ) : (
            <>
              {adminDataError ? (
                <div className="mb-6 rounded-xl border border-[#D62839]/25 bg-[#D62839]/08 px-4 py-3 text-sm font-medium text-[#0F2A1D]">
                  {adminDataError}
                </div>
              ) : null}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
