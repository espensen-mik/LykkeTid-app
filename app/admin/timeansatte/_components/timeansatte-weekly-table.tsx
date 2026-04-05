import type { StudentHoursRow, WeekBucket } from "../../timeansatte-utils";
import { formatHoursCell } from "../../timeansatte-utils";
import { TimeansatteEmployeeCell } from "./timeansatte-employee-cell";

type Props = {
  weeks: readonly WeekBucket[];
  rows: readonly (StudentHoursRow & { recentProjectName: string | null })[];
};

export function TimeansatteWeeklyTable({ weeks, rows }: Props) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
      <h2 className="text-lg font-medium text-[#0F2A1D]">Timer pr. uge</h2>
      <p className="mt-1 text-sm text-[#0F2A1D]/50">Seneste 8 uger (inkl. uger uden registreringer)</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-[#0F2A1D]/55">Ingen timeansatte at vise.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl ring-1 ring-black/[0.06]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#F8FAF9]/90">
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-[#F8FAF9]/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0F2A1D]/50 shadow-[4px_0_12px_-6px_rgba(15,42,29,0.12)]"
                >
                  Medarbejder
                </th>
                {weeks.map((w) => (
                  <th
                    key={w.key}
                    scope="col"
                    className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-[#0F2A1D]/55"
                  >
                    {w.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={row.userId}
                  className={ri % 2 === 1 ? "bg-[#F8FAF9]/40" : "bg-white"}
                >
                  <td className="sticky left-0 z-10 border-b border-black/[0.04] bg-inherit px-4 py-2 shadow-[4px_0_12px_-6px_rgba(15,42,29,0.08)]">
                    <TimeansatteEmployeeCell
                      displayName={row.displayName}
                      title={row.title}
                      recentProjectName={row.recentProjectName}
                      avatarUrl={row.avatarUrl}
                    />
                  </td>
                  {row.weekHours.map((h, hi) => (
                    <td
                      key={weeks[hi]?.key ?? hi}
                      className="border-b border-black/[0.04] px-3 py-2 text-center tabular-nums text-[#0F2A1D]/85"
                    >
                      <span
                        className={
                          h <= 0
                            ? "inline-block min-w-[2rem] rounded-md bg-black/[0.04] px-2 py-1 text-[#0F2A1D]/40"
                            : "font-medium text-[#0F2A1D]"
                        }
                      >
                        {formatHoursCell(h)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
