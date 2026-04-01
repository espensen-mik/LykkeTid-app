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
  LabelList,
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
  buildProjectLast12MonthsSeries,
  formatHours,
  getInitials,
  getProjectColor,
  getProjectColorSoft,
  type ProjectLast12MonthsRow,
} from "../../admin-utils";

const USER_HOURS_CHART_MAX = 6;
/** Hex opacity suffixes for stacked bar fills (same family as underpunkt chart). */
const PROJECT_BAR_FILL_ALPHAS = ["FF", "D9", "B8", "99", "80", "66"] as const;

/** Show every Nth month on the 12-måneders X-axis, plus always the last (current) month. */
const LAST_12_MONTH_TICK_STRIDE = 2;

type MonthHoursTooltipDatum = { tooltipTitle: string; hours: number };

type ProjectLast12MonthsBarDatum = ProjectLast12MonthsRow & {
  barFill: string;
  nowLabel: string;
};

type UserHoursBarDatum = {
  userId: string;
  userName: string;
  hours: number;
  avatarUrl: string | null;
  /** Stable X category (user id). */
  barKey: string;
  hoursTopLabel: string;
  fill: string;
};

function HoursBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MonthHoursTooltipDatum }>;
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

function Last12MonthAxisTick({
  x,
  y,
  index,
  data,
}: {
  x?: number | string;
  y?: number | string;
  index?: number;
  data: readonly ProjectLast12MonthsBarDatum[];
}) {
  const tx = typeof x === "number" ? x : Number(x);
  const ty = typeof y === "number" ? y : Number(y);
  const cx = Number.isFinite(tx) ? tx : 0;
  const cy = Number.isFinite(ty) ? ty : 0;
  const idx = index ?? 0;
  const last = data.length - 1;
  const showLabel =
    last >= 0 && (idx % LAST_12_MONTH_TICK_STRIDE === 0 || idx === last);
  const row = data[idx];
  if (!showLabel || !row) {
    return <g transform={`translate(${cx},${cy})`} />;
  }
  return (
    <g transform={`translate(${cx},${cy})`}>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="middle"
        fill="rgba(15,42,29,0.48)"
        fontSize={10}
      >
        {row.monthShort}
      </text>
    </g>
  );
}

function UserHoursBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: UserHoursBarDatum }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm shadow-[0_8px_24px_-12px_rgba(15,42,29,0.2)]">
      <span className="text-[#0F2A1D]/90">
        {p.userName} — {formatHours(p.hours)} t
      </span>
    </div>
  );
}

function UserAvatarAxisTick({
  x,
  y,
  index,
  users,
  avatarSoftFill,
}: {
  x?: number;
  y?: number;
  index?: number;
  users: readonly UserHoursBarDatum[];
  avatarSoftFill: string;
}) {
  const user = typeof index === "number" ? users[index] : undefined;
  if (!user) return null;
  const cx = x ?? 0;
  const ty = y ?? 0;
  const clipId = `user-av-${index}-${user.userId.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <g transform={`translate(${cx},${ty})`}>
      {user.avatarUrl ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx={0} cy={16} r={14} />
            </clipPath>
          </defs>
          <image
            href={user.avatarUrl}
            x={-14}
            y={2}
            width={28}
            height={28}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <circle
            cx={0}
            cy={16}
            r={14}
            fill={avatarSoftFill}
            stroke="rgba(15,42,29,0.08)"
            strokeWidth={1}
          />
          <text
            x={0}
            y={20}
            textAnchor="middle"
            fontSize={9}
            fontWeight={600}
            fill="#0F2A1D"
          >
            {getInitials(user.userName)}
          </text>
        </>
      )}
    </g>
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
    timeEntries,
  } = useAdminContext();

  const row = useMemo(
    () => projectDashboardRows.find((r) => r.projectSlug === slug),
    [projectDashboardRows, slug]
  );

  const projectAllTimeEntries = useMemo(
    () => timeEntries.filter((e) => e.project_id === slug),
    [timeEntries, slug]
  );

  const last12MonthsChartData = useMemo((): ProjectLast12MonthsBarDatum[] => {
    const base = getProjectColor(slug, projectColorBySlug.get(slug));
    const rows = buildProjectLast12MonthsSeries(projectAllTimeEntries, new Date());
    return rows.map((r) => ({
      ...r,
      barFill: r.isCurrentMonth ? `${base}FF` : `${base}7A`,
      nowLabel: r.isCurrentMonth ? "nu" : "",
    }));
  }, [projectAllTimeEntries, slug, projectColorBySlug]);

  const userHoursBar = useMemo(() => {
    if (!row) {
      return { shown: [] as UserHoursBarDatum[], restCount: 0 };
    }
    const positive = row.byUser
      .filter((u) => u.hours > 0)
      .slice()
      .sort((a, b) => b.hours - a.hours || a.userName.localeCompare(b.userName, "da"));
    const base = getProjectColor(slug, projectColorBySlug.get(slug));
    const shown: UserHoursBarDatum[] = positive.slice(0, USER_HOURS_CHART_MAX).map((u, i) => ({
      userId: u.userId,
      userName: u.userName,
      hours: u.hours,
      avatarUrl: u.avatarUrl,
      barKey: u.userId,
      hoursTopLabel: `${formatHours(u.hours)} t`,
      fill: `${base}${PROJECT_BAR_FILL_ALPHAS[i % PROJECT_BAR_FILL_ALPHAS.length]}`,
    }));
    return { shown, restCount: Math.max(0, positive.length - shown.length) };
  }, [row, slug, projectColorBySlug]);

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
            <h2 className="text-lg font-medium text-[#0F2A1D]">Timer pr. bruger</h2>
          </div>
          <p className="mt-1 text-sm text-[#0F2A1D]/50">Fordeling af timer på medarbejdere</p>
          <div className="mt-4 h-[280px] w-full min-w-0">
            {userHoursBar.shown.length === 0 ? (
              <p className="text-sm text-[#0F2A1D]/55">Ingen registreringer endnu.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={userHoursBar.shown}
                  margin={{ top: 22, right: 8, left: 4, bottom: 2 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(15,42,29,0.08)"
                  />
                  <XAxis
                    dataKey="barKey"
                    type="category"
                    tickLine={false}
                    axisLine={{ stroke: "rgba(15,42,29,0.12)" }}
                    tick={(tickProps) => {
                      const tx = typeof tickProps.x === "number" ? tickProps.x : Number(tickProps.x);
                      const ty = typeof tickProps.y === "number" ? tickProps.y : Number(tickProps.y);
                      return (
                        <UserAvatarAxisTick
                          x={Number.isFinite(tx) ? tx : 0}
                          y={Number.isFinite(ty) ? ty : 0}
                          index={tickProps.index}
                          users={userHoursBar.shown}
                          avatarSoftFill={getProjectColorSoft(row.projectSlug)}
                        />
                      );
                    }}
                    interval={0}
                    height={40}
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
                    content={<UserHoursBarTooltip />}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={52}>
                    {userHoursBar.shown.map((entry) => (
                      <Cell key={entry.userId} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="hoursTopLabel"
                      position="top"
                      fill="rgba(15,42,29,0.42)"
                      fontSize={11}
                      offset={6}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {userHoursBar.restCount > 0 ? (
            <p className="mt-2 text-center text-xs text-[#0F2A1D]/45">
              +{userHoursBar.restCount} {userHoursBar.restCount === 1 ? "mere" : "flere"}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-2">
            <ChartColumn className="h-5 w-5 text-[#0F2A1D]/60" />
            <h2 className="text-lg font-medium text-[#0F2A1D]">Timer pr. måned</h2>
          </div>
          <p className="mt-1 text-sm text-[#0F2A1D]/50">Registrerede timer over tid</p>
          <div className="mt-4 h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={last12MonthsChartData}
                margin={{ top: 22, right: 8, left: 4, bottom: 22 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(15,42,29,0.08)"
                />
                <XAxis
                  dataKey="key"
                  type="category"
                  tickLine={false}
                  axisLine={{ stroke: "rgba(15,42,29,0.12)" }}
                  interval={0}
                  tick={(tickProps) => (
                    <Last12MonthAxisTick
                      x={tickProps.x}
                      y={tickProps.y}
                      index={tickProps.index}
                      data={last12MonthsChartData}
                    />
                  )}
                  height={34}
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
                <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={40}>
                  {last12MonthsChartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.barFill} />
                  ))}
                  <LabelList
                    dataKey="nowLabel"
                    position="top"
                    offset={4}
                    fill="rgba(15,42,29,0.42)"
                    fontSize={10}
                    fontWeight={600}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
