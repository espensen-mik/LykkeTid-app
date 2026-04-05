"use client";

import { useMemo } from "react";
import type { TimeEntryRow } from "../../admin-types";
import type { StudentHoursRow } from "../../timeansatte-utils";
import { buildDailyHoursForStudent, formatHoursCell } from "../../timeansatte-utils";
import { TimeansatteEmployeeCell } from "./timeansatte-employee-cell";

type Row = StudentHoursRow & { recentProjectName: string | null };

type Props = {
  rows: readonly Row[];
  studentEntries: readonly TimeEntryRow[];
};

export function TimeansatteDailySection({ rows, studentEntries }: Props) {
  const dailyByUserId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildDailyHoursForStudent>>();
    for (const r of rows) {
      map.set(r.userId, buildDailyHoursForStudent(studentEntries, r.userId));
    }
    return map;
  }, [rows, studentEntries]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
      <h2 className="text-lg font-medium text-[#0F2A1D]">Registreringer pr. dag</h2>
      <p className="mt-1 text-sm text-[#0F2A1D]/50">
        Hver dag med tidsregistrering — samlede timer pr. kalenderdag (nyeste først)
      </p>

      <div className="mt-6 space-y-6">
        {rows.map((row) => {
          const days = dailyByUserId.get(row.userId) ?? [];
          return (
            <article
              key={row.userId}
              className="overflow-hidden rounded-xl ring-1 ring-black/[0.06]"
            >
              <div className="border-b border-black/[0.06] bg-[#F8FAF9]/60 px-4 py-3">
                <TimeansatteEmployeeCell
                  displayName={row.displayName}
                  title={row.title}
                  recentProjectName={row.recentProjectName}
                  avatarUrl={row.avatarUrl}
                />
              </div>
              {days.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#0F2A1D]/55">Ingen registreringer endnu.</p>
              ) : (
                <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-[1] bg-white shadow-[0_1px_0_rgba(15,42,29,0.06)]">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#0F2A1D]/50"
                        >
                          Dato
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#0F2A1D]/50"
                        >
                          Timer
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((d, i) => (
                        <tr
                          key={d.dayKey}
                          className={i % 2 === 1 ? "bg-[#F8FAF9]/50" : "bg-white"}
                        >
                          <td className="border-b border-black/[0.04] px-4 py-2.5 capitalize text-[#0F2A1D]/90">
                            {d.label}
                          </td>
                          <td className="border-b border-black/[0.04] px-4 py-2.5 text-right tabular-nums font-medium text-[#0F2A1D]">
                            {formatHoursCell(d.hours)} t
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
