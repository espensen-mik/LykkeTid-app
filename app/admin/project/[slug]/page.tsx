"use client";

import {
  BarChart3,
  ChartColumn,
  Clock3,
  Download,
  ListTree,
  Percent,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminContext } from "../../admin-provider";
import { AdminKpiCard } from "../../_components/admin-kpi";
import { PeriodToggle } from "../../_components/period-toggle";
import {
  buildProjectHoursChartSeries,
  formatHours,
  getInitials,
  getProjectColor,
  getProjectColorSoft,
  type ProjectHoursChartPoint,
} from "../../admin-utils";

function HoursBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ProjectHoursChartPoint }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm shadow-[0_8px_24px_-12px_rgba(15,42,29,0.2)]">
      <span className="text-[#0F2A1D]/90">
        {p.tooltipTitle} — {formatHours(p.hours)} t
      </span>
    </div>
  );
}

export default function AdminProjectDetailPage() {
  const params = useParams();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam ?? "";

  const {
    projectDashboardRows,
    periodMeta,
    summaryPeriodLabel,
    exportProjectCsv,
    summaryRange,
    setSummaryRange,
    projectColorBySlug,
  } = useAdminContext();

  const row = useMemo(
    () => projectDashboardRows.find((r) => r.projectSlug === slug),
    [projectDashboardRows, slug]
  );

  const hoursChartData = useMemo(() => {
    if (!row) return [];
    return buildProjectHoursChartSeries(
      row.rangeEntries,
      summaryRange,
      periodMeta.start,
      periodMeta.end
    );
  }, [row, summaryRange, periodMeta.start, periodMeta.end]);

  const color = getProjectColor(slug, projectColorBySlug.get(slug));
  const subcategoryTotal = row?.bySubcategory.reduce((sum, sub) => sum + sub.hours, 0) ?? 0;
  const subcategoryChartData =
    row?.bySubcategory.map((sub, index) => ({
      name: sub.name,
      value: sub.hours,
      pct: subcategoryTotal > 0 ? (sub.hours / subcategoryTotal) * 100 : 0,
      color: `${color}${["FF", "D9", "B8", "99", "80", "66", "4D"][index % 7]}`,
    })) ?? [];

  if (!row) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
        <h1 className="text-lg font-semibold text-[#0F2A1D]">Projekt ikke fundet</h1>
        <p className="mt-2 text-sm text-[#0F2A1D]/55">
          Der findes ingen data for dette projekt i den aktuelle periode.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-flex rounded-xl bg-[#0F2A1D] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Tilbage til dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm font-medium text-[#0F2A1D]/50 hover:text-[#0F2A1D]"
          >
            ← Dashboard
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A1D]">{row.projectName}</h1>
          </div>
          <p className="mt-1 text-sm text-[#0F2A1D]/55">{periodMeta.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#0F2A1D]/45">
              Timer i alt
            </div>
            <div className="mt-1 text-3xl font-bold text-[#0F2A1D]">{formatHours(row.periodHours)} t</div>
          </div>
          <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#0F2A1D]/45">
              Aktive brugere
            </div>
            <div className="mt-1 text-3xl font-bold text-[#0F2A1D]">{row.userIds.length}</div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.08)] ring-1 ring-black/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-[#0F2A1D]">Rapportperiode</h2>
          <PeriodToggle value={summaryRange} onChange={setSummaryRange} />
        </div>
        <p className="mt-2 text-sm text-[#0F2A1D]/50">{periodMeta.label}</p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          label="Timer i perioden"
          value={formatHours(row.periodHours)}
          helper={periodMeta.label}
          icon={Clock3}
        />
        <AdminKpiCard
          label="Registreringer"
          value={String(row.rangeEntries.length)}
          icon={BarChart3}
        />
        <AdminKpiCard label="Medarbejdere" value={String(row.userIds.length)} icon={Users} />
        <AdminKpiCard
          label="Andel af perioden"
          value={`${row.sharePct.toFixed(0)}%`}
          icon={Percent}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#0F2A1D]/60" />
            <h2 className="text-lg font-medium text-[#0F2A1D]">Fordeling på brugere</h2>
          </div>
          <div className="mt-4 space-y-2">
            {row.byUser.length === 0 ? (
              <p className="text-sm text-[#0F2A1D]/55">Ingen registreringer endnu.</p>
            ) : (
              row.byUser.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 ring-1 ring-black/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-[#0F2A1D]"
                      style={{ backgroundColor: getProjectColorSoft(row.projectSlug) }}
                    >
                      {user.avatarUrl ? (
                        <span
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                        />
                      ) : (
                        getInitials(user.userName)
                      )}
                    </span>
                    <span className="font-medium text-[#0F2A1D]">{user.userName}</span>
                  </div>
                  <span className="text-sm text-[#0F2A1D]/60">{formatHours(user.hours)} t</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2">
            <ChartColumn className="h-5 w-5 text-[#0F2A1D]/60" />
            <h2 className="text-lg font-medium text-[#0F2A1D]">Timer pr. måned</h2>
          </div>
          <p className="mt-1 text-sm text-[#0F2A1D]/50">Registrerede timer over tid</p>
          <div className="mt-4 h-[280px] w-full min-w-0">
            {hoursChartData.length === 0 ? (
              <p className="text-sm text-[#0F2A1D]/55">Ingen data for den valgte periode.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursChartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(15,42,29,0.08)"
                  />
                  <XAxis
                    dataKey="axisLabel"
                    tick={{ fontSize: 11, fill: "rgba(15,42,29,0.55)" }}
                    axisLine={{ stroke: "rgba(15,42,29,0.12)" }}
                    tickLine={false}
                    interval={0}
                    angle={hoursChartData.length > 8 ? -35 : 0}
                    textAnchor={hoursChartData.length > 8 ? "end" : "middle"}
                    height={hoursChartData.length > 8 ? 52 : 28}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(15,42,29,0.55)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v) => formatHours(Number(v))}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(15,42,29,0.04)" }}
                    content={<HoursBarTooltip />}
                  />
                  <Bar
                    dataKey="hours"
                    fill={color}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={52}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {row.bySubcategory.length > 0 ? (
        <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2">
            <ListTree className="h-5 w-5 text-[#0F2A1D]/60" />
            <h2 className="text-lg font-medium text-[#0F2A1D]">Fordeling på underpunkter</h2>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="relative h-[220px] w-full max-w-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subcategoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={subcategoryChartData.length > 1 ? 2 : 0}
                  >
                    {subcategoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value, _name, item) => {
                      const num = Number(value ?? 0);
                      const pct = Number(item?.payload?.pct ?? 0);
                      return `${formatHours(num)} t (${pct.toFixed(1)}%)`;
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(15,42,29,0.08)",
                      boxShadow: "0 8px 24px -12px rgba(15,42,29,0.15)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {subcategoryChartData.length === 1 ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="max-w-[120px] truncate text-xs font-semibold text-[#0F2A1D]/75">
                      {subcategoryChartData[0]?.name}
                    </div>
                    <div className="text-sm font-bold text-[#0F2A1D]">100%</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {subcategoryChartData.map((sub) => (
                <div key={`${row.projectSlug}-${sub.name}`} className="rounded-xl px-3 py-2.5 ring-1 ring-black/[0.04]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sub.color }}
                      />
                      <span className="truncate text-[#0F2A1D]">{sub.name}</span>
                    </div>
                    <span className="shrink-0 text-sm text-[#0F2A1D]/60">
                      {formatHours(sub.value)} t ({sub.pct.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.08)] ring-1 ring-black/[0.04]">
        <p className="text-sm text-[#0F2A1D]/55">
          <span className="font-medium capitalize text-[#0F2A1D]">
            {summaryPeriodLabel}
          </span>
          : {formatHours(row.periodHours)} t
        </p>
        <button
          type="button"
          onClick={() => exportProjectCsv(row.projectSlug)}
          className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-[#F8FAF9] px-4 py-2.5 text-sm font-semibold text-[#0F2A1D] transition hover:bg-black/[0.04]"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </button>
      </div>
    </div>
  );
}
