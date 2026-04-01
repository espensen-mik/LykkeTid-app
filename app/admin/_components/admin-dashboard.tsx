"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock3, Folder, ListTree, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";
import { useAdminContext } from "../admin-provider";
import { AdminKpiCard } from "./admin-kpi";
import { formatHours, getEntryDurationHours, getProjectColor } from "../admin-utils";

export function AdminDashboard() {
  const {
    projects,
    summaryRange,
    setSummaryRange,
    periodMeta,
    summaryKpis,
    summaryFilteredEntries,
    registrationByDay,
    summaryPeriodLabel,
  } = useAdminContext();

  const pieRows = useMemo(() => {
    const usageMap = new Map<string, number>();
    for (const project of projects.filter((p) => p.is_active)) {
      usageMap.set(project.slug, 0);
    }
    for (const entry of summaryFilteredEntries) {
      const prev = usageMap.get(entry.project_id);
      if (prev === undefined) continue;
      usageMap.set(
        entry.project_id,
        prev + getEntryDurationHours(entry.start_time, entry.end_time)
      );
    }
    return projects
      .filter((p) => p.is_active)
      .map((project) => ({
        projectSlug: project.slug,
        projectName: project.name,
        periodHours: usageMap.get(project.slug) ?? 0,
      }))
      .filter((row) => row.periodHours > 0)
      .sort((a, b) => b.periodHours - a.periodHours);
  }, [projects, summaryFilteredEntries]);

  const pieTotal = pieRows.reduce((sum, row) => sum + row.periodHours, 0);

  const pieChartData = useMemo(
    () =>
      pieRows.map((row) => ({
        name: row.projectName,
        value: row.periodHours,
        slug: row.projectSlug,
      })),
    [pieRows]
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A1D]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#0F2A1D]/55">Overblik over tidsforbrug og registrering</p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.08)] ring-1 ring-black/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-[#0F2A1D]">Rapportperiode</h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["weekly", "Uge"],
                ["monthly", "Måned"],
                ["quarter", "3 mdr"],
                ["year", "12 mdr"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSummaryRange(value)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  summaryRange === value
                    ? "bg-[#0F2A1D] text-white shadow-sm"
                    : "bg-[#F8FAF9] text-[#0F2A1D]/80 ring-1 ring-black/[0.06] hover:bg-black/[0.04]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm text-[#0F2A1D]/50">{periodMeta.helper}</p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          label="Timer i perioden"
          value={formatHours(summaryKpis.totalHours)}
          helper={periodMeta.helper}
          icon={Clock3}
        />
        <AdminKpiCard
          label="Aktive medarbejdere"
          value={String(summaryKpis.activeEmployees)}
          helper="Unikke brugere med registreringer"
          icon={Users}
        />
        <AdminKpiCard
          label="Aktive projekter"
          value={String(summaryKpis.activeProjects)}
          helper="Unikke projekter med registreringer"
          icon={Folder}
        />
        <AdminKpiCard label="Registreringsgrad" value={`${Math.round(summaryKpis.registrationRatePct)}%`} helper={summaryKpis.registrationRateHelper} icon={TrendingUp}>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F8FAF9] ring-1 ring-black/[0.06]">
            <div
              className={[
                "h-full rounded-full",
                summaryKpis.registrationRatePct < 50
                  ? "bg-[#D62839]"
                  : summaryKpis.registrationRatePct < 80
                    ? "bg-amber-400"
                    : "bg-[#0F2A1D]",
              ].join(" ")}
              style={{
                width: `${Math.min(100, Math.max(0, summaryKpis.registrationRatePct))}%`,
              }}
            />
          </div>
        </AdminKpiCard>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2">
            <ListTree className="h-5 w-5 text-[#0F2A1D]/60" />
            <h2 className="text-lg font-medium text-[#0F2A1D]">Registreringsgrad pr. dag</h2>
          </div>
          <p className="mt-1 text-sm text-[#0F2A1D]/55">
            Registrerede timer pr. dag i forhold til forventet tid (7,5 t pr. medarbejder)
          </p>
          <div className="mt-4 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={registrationByDay} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ece9" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  tick={{ fontSize: 11, fill: "#5c6b62" }}
                  axisLine={{ stroke: "#e5eae7" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "#5c6b62" }}
                  axisLine={{ stroke: "#e5eae7" }}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "rgba(15, 42, 29, 0.06)" }}
                  formatter={(value) => {
                    const num = Number(value ?? 0);
                    return `${num.toFixed(0)}%`;
                  }}
                  labelFormatter={(_, payload) => {
                    const data = payload?.[0]?.payload as
                      | {
                          dayLabel: string;
                          percentage: number;
                          actual: number;
                          expected: number;
                        }
                      | undefined;
                    if (!data) return "";
                    return `${data.dayLabel}: ${data.percentage.toFixed(0)}% · ${formatHours(
                      data.actual
                    )} / ${formatHours(data.expected)} timer registreret`;
                  }}
                />
                <Bar dataKey="percentage" radius={[10, 10, 0, 0]}>
                  {registrationByDay.map((entry) => (
                    <Cell key={entry.dayKey} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#0F2A1D]/60" />
            <h2 className="text-lg font-medium text-[#0F2A1D]">Tid pr. projekt</h2>
          </div>
          <p className="mt-1 text-sm capitalize text-[#0F2A1D]/55">
            {summaryPeriodLabel.charAt(0).toUpperCase() + summaryPeriodLabel.slice(1)}
          </p>

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr]">
            <div className="flex flex-col items-center justify-center">
              <div className="relative h-[220px] w-full max-w-[220px]">
                {pieChartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#0F2A1D]/45">
                    Ingen data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={92}
                        paddingAngle={2}
                      >
                        {pieChartData.map((entry) => (
                          <Cell key={`cell-${entry.slug}`} fill={getProjectColor(entry.slug)} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatHours(Number(value ?? 0)) + " t"}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid rgba(15,42,29,0.08)",
                          boxShadow: "0 8px 24px -12px rgba(15,42,29,0.15)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {pieRows.length === 0 ? (
                <p className="text-sm text-[#0F2A1D]/55">Ingen tidsdata i perioden.</p>
              ) : (
                pieRows.map((row) => {
                  const color = getProjectColor(row.projectSlug);
                  const pct = pieTotal > 0 ? (row.periodHours / pieTotal) * 100 : 0;
                  return (
                    <div
                      key={row.projectSlug}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ring-1 ring-black/[0.04] transition hover:bg-[#F8FAF9]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate text-sm font-medium text-[#0F2A1D]">
                          {row.projectName}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm text-[#0F2A1D]/65">
                        {formatHours(row.periodHours)} t ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
