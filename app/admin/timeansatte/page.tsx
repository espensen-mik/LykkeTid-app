"use client";

import { useMemo } from "react";
import { useAdminContext } from "../admin-provider";
import {
  getEndOfToday,
  getStartOfCurrentMonth,
  getStartOfCurrentWeekMonday,
} from "../admin-utils";
import {
  buildStudentHoursRows,
  filterStudentProfiles,
  getLatestNMonthBuckets,
  getLatestNWeekBuckets,
  mostRecentProjectNameForUser,
  sumTotalHoursInRangeForUsers,
} from "../timeansatte-utils";
import { TimeansatteDailySection } from "./_components/timeansatte-daily-section";
import { TimeansatteMonthlyTable } from "./_components/timeansatte-monthly-table";
import { TimeansatteSummaryCards } from "./_components/timeansatte-summary-cards";
import { TimeansatteWeeklyTable } from "./_components/timeansatte-weekly-table";

const WEEK_COLUMNS = 8;
const MONTH_COLUMNS = 6;

export default function TimeansattePage() {
  const { profiles, timeEntries, projectNameBySlug } = useAdminContext();

  const students = useMemo(() => filterStudentProfiles(profiles), [profiles]);

  const studentIds = useMemo(() => new Set(students.map((s) => s.id)), [students]);

  const studentEntries = useMemo(
    () => timeEntries.filter((e) => studentIds.has(e.user_id)),
    [timeEntries, studentIds]
  );

  const weeks = useMemo(
    () => getLatestNWeekBuckets(new Date(), WEEK_COLUMNS),
    [profiles, timeEntries]
  );

  const months = useMemo(
    () => getLatestNMonthBuckets(new Date(), MONTH_COLUMNS),
    [profiles, timeEntries]
  );

  const baseRows = useMemo(
    () => buildStudentHoursRows(students, weeks, months, studentEntries),
    [students, weeks, months, studentEntries]
  );

  const rows = useMemo(
    () =>
      baseRows.map((r) => ({
        ...r,
        recentProjectName: mostRecentProjectNameForUser(
          studentEntries,
          r.userId,
          projectNameBySlug
        ),
      })),
    [baseRows, studentEntries, projectNameBySlug]
  );

  const hoursThisMonth = useMemo(
    () =>
      sumTotalHoursInRangeForUsers(
        studentEntries,
        studentIds,
        getStartOfCurrentMonth(),
        getEndOfToday()
      ),
    [studentEntries, studentIds]
  );

  const hoursThisWeek = useMemo(
    () =>
      sumTotalHoursInRangeForUsers(
        studentEntries,
        studentIds,
        getStartOfCurrentWeekMonday(),
        getEndOfToday()
      ),
    [studentEntries, studentIds]
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F2A1D]">Timeansatte</h1>
        <p className="mt-1 text-sm text-[#0F2A1D]/55">
          Overblik over timer for timelønnede medarbejdere
        </p>
      </header>

      <TimeansatteSummaryCards
        students={students}
        hoursThisMonth={hoursThisMonth}
        hoursThisWeek={hoursThisWeek}
      />

      <TimeansatteWeeklyTable weeks={weeks} rows={rows} />

      <TimeansatteMonthlyTable months={months} rows={rows} />

      <TimeansatteDailySection rows={rows} studentEntries={studentEntries} />
    </div>
  );
}
