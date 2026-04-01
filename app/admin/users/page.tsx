"use client";

import { useAdminContext } from "../admin-provider";
import { formatCreatedAt, formatHours, getInitials } from "../admin-utils";

export default function AdminUsersPage() {
  const { userUsage } = useAdminContext();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A1D]">Brugere</h1>
        <p className="mt-1 text-sm text-[#0F2A1D]/55">Tidsforbrug og aktivitet pr. medarbejder</p>
      </div>

      <div className="space-y-4">
        {userUsage.map((user) => (
          <article
            key={user.id}
            className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#C0E6BA] text-sm font-semibold text-[#0F2A1D] ring-2 ring-white shadow-sm">
                  {user.avatarUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                      aria-hidden
                    />
                  ) : (
                    <span>{getInitials(user.fullName) || "?"}</span>
                  )}
                </div>
                <div>
                  <div className="text-base font-semibold text-[#0F2A1D]">{user.fullName}</div>
                  <div className="text-sm text-[#0F2A1D]/55">
                    {user.title} · {user.role}
                  </div>
                  <div className="text-xs text-[#0F2A1D]/40">
                    Oprettet: {formatCreatedAt(user.createdAt)}
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-[#F8FAF9] px-4 py-3 text-sm text-[#0F2A1D]/70 ring-1 ring-black/[0.04]">
                <div>
                  <span className="text-[#0F2A1D]/50">Timer i alt:</span>{" "}
                  <span className="font-semibold text-[#0F2A1D]">{formatHours(user.totalHours)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-[#0F2A1D]/50">Denne måned:</span>{" "}
                  <span className="font-semibold text-[#0F2A1D]">
                    {formatHours(user.currentMonthHours)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl bg-[#F8FAF9] p-4 ring-1 ring-black/[0.04]">
                <div className="text-sm font-semibold text-[#0F2A1D]">Seneste uge</div>
                <div className="mt-0.5 text-xs text-[#0F2A1D]/50">
                  Timeregistrering pr. hverdag
                </div>
                <div className="mt-4 space-y-3">
                  {user.recentWeekdayStatus.map((item) => (
                    <div key={item.dayKey}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium capitalize text-[#0F2A1D]/80">
                          {item.weekday.replace(".", "")}
                        </span>
                        <span className="font-semibold text-[#0F2A1D]">{formatHours(item.hours)} t</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-black/[0.05]">
                        <div
                          className={`h-full rounded-full ${item.barColor}`}
                          style={{ width: `${Math.max(3, item.normalized * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl bg-[#F8FAF9] p-4 ring-1 ring-black/[0.04]">
                <div className="text-sm font-semibold text-[#0F2A1D]">Top 3 projekter (denne måned)</div>
                <div className="mt-4 space-y-2">
                  {user.topProjects.length === 0 ? (
                    <div className="text-sm text-[#0F2A1D]/55">Ingen timer registreret denne måned.</div>
                  ) : (
                    user.topProjects.map((project) => (
                      <div
                        key={`${user.id}-${project.projectSlug}`}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-black/[0.04]"
                      >
                        <span className="font-medium text-[#0F2A1D]">{project.projectName}</span>
                        <span className="text-[#0F2A1D]/60">{formatHours(project.currentMonthHours)} t</span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
