"use client";

import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Profile,
  ProjectRow,
  ReportRange,
  SubcategoryRow,
  TimeEntryRow,
} from "./admin-types";
import {
  buildUserUsage,
  countWeekdaysInclusive,
  exportProjectCsvFromRows,
  formatMonthKey,
  getEndOfToday,
  getEntryDurationHours,
  getRegistrationBarColor,
  getStartMonthsAgo,
  getStartOfCurrentMonth,
  getStartOfCurrentWeekMonday,
  getWeekdaysInRange,
  parseDayKeyToDate,
  toDayKey,
} from "./admin-utils";

export type ProjectDashboardRow = {
  projectSlug: string;
  projectName: string;
  periodHours: number;
  sharePct: number;
  userIds: string[];
  byUser: Array<{
    userId: string;
    userName: string;
    avatarUrl: string | null;
    hours: number;
  }>;
  byMonth: Array<{ monthKey: string; label: string; hours: number }>;
  bySubcategory: Array<{ name: string; hours: number }>;
  rangeEntries: TimeEntryRow[];
};

type AdminContextValue = {
  session: Session | null;
  authLoading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  projects: ProjectRow[];
  subcategories: SubcategoryRow[];
  timeEntries: TimeEntryRow[];
  profiles: Profile[];
  adminDataLoading: boolean;
  adminDataError: string;
  projectName: string;
  setProjectName: (v: string) => void;
  projectSlug: string;
  setProjectSlug: (v: string) => void;
  projectSortOrder: string;
  setProjectSortOrder: (v: string) => void;
  creatingProject: boolean;
  createProjectError: string;
  openSubcategoryProjectId: string | null;
  newSubcategoryName: string;
  setNewSubcategoryName: (v: string) => void;
  newSubcategorySortOrder: string;
  setNewSubcategorySortOrder: (v: string) => void;
  subcategoryError: string;
  isSavingSubcategory: boolean;
  summaryRange: ReportRange;
  setSummaryRange: (v: ReportRange) => void;
  handleCreateProject: (e: FormEvent) => Promise<void>;
  openSubcategoryForm: (projectId: string) => void;
  closeSubcategoryForm: () => void;
  handleCreateSubcategory: (projectId: string) => Promise<void>;
  subcategoriesByProjectId: Map<string, SubcategoryRow[]>;
  periodMeta: {
    label: string;
    helper: string;
    start: Date;
    end: Date;
  };
  summaryFilteredEntries: TimeEntryRow[];
  filteredTimeEntries: TimeEntryRow[];
  timeUsageByProject: Array<{
    projectName: string;
    projectSlug: string;
    totalHours: number;
  }>;
  projectNameBySlug: Map<string, string>;
  profileNameById: Map<string, string>;
  avatarByUserId: Map<string, string | null>;
  projectDashboardRows: ProjectDashboardRow[];
  summaryPeriodLabel: string;
  monthsToShow: number;
  summaryKpis: {
    totalHours: number;
    activeEmployees: number;
    activeProjects: number;
    registrationRatePct: number;
    registrationRateHelper: string;
  };
  registrationByDay: Array<{
    dayKey: string;
    dayLabel: string;
    percentage: number;
    actual: number;
    expected: number;
    fill: string;
  }>;
  userUsage: ReturnType<typeof buildUserUsage>;
  exportProjectCsv: (projectSlug: string) => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminContext must be used within AdminProvider");
  }
  return ctx;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const [adminDataError, setAdminDataError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [projectSortOrder, setProjectSortOrder] = useState("0");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");
  const [openSubcategoryProjectId, setOpenSubcategoryProjectId] = useState<string | null>(
    null
  );
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategorySortOrder, setNewSubcategorySortOrder] = useState("0");
  const [subcategoryError, setSubcategoryError] = useState("");
  const [isSavingSubcategory, setIsSavingSubcategory] = useState(false);
  const [summaryRange, setSummaryRange] = useState<ReportRange>("quarter");

  useEffect(() => {
    let isActive = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isActive) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    };

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchProfile = async () => {
      if (!session?.user?.id) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, title, avatar_url, role, created_at")
        .eq("id", session.user.id)
        .single();

      if (!isActive) return;

      if (error) {
        setProfile(null);
      } else {
        setProfile((data as Profile | null) ?? null);
      }
      setProfileLoading(false);
    };

    void fetchProfile();

    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, slug, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { error };
    setProjects((data ?? []) as ProjectRow[]);
    return { error: null };
  }, []);

  const fetchSubcategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("project_subcategories")
      .select("id, project_id, name, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { error };
    setSubcategories((data ?? []) as SubcategoryRow[]);
    return { error: null };
  }, []);

  const fetchTimeEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from("time_entries")
      .select(
        "id, user_id, entry_date, start_time, end_time, project_id, subcategory, location"
      );

    if (error) return { error };
    setTimeEntries((data ?? []) as TimeEntryRow[]);
    return { error: null };
  }, []);

  const fetchProfilesForUsage = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, title, avatar_url, role, created_at")
      .order("full_name", { ascending: true });

    if (error) return { error };
    setProfiles((data ?? []) as Profile[]);
    return { error: null };
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchAdminData = async () => {
      if (profile?.role !== "admin") {
        setProjects([]);
        setSubcategories([]);
        setAdminDataLoading(false);
        setAdminDataError("");
        return;
      }

      setAdminDataLoading(true);
      setAdminDataError("");

      const [projectsResult, subcategoriesResult, timeEntriesResult, profilesResult] =
        await Promise.all([
          fetchProjects(),
          fetchSubcategories(),
          fetchTimeEntries(),
          fetchProfilesForUsage(),
        ]);

      if (!isActive) return;

      if (
        projectsResult.error ||
        subcategoriesResult.error ||
        timeEntriesResult.error ||
        profilesResult.error
      ) {
        setAdminDataError("Kunne ikke hente admin-data");
      } else {
        setAdminDataError("");
      }
      setAdminDataLoading(false);
    };

    void fetchAdminData();

    return () => {
      isActive = false;
    };
  }, [profile?.role, fetchProjects, fetchSubcategories, fetchTimeEntries, fetchProfilesForUsage]);

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectSlug.trim()) return;

    setCreatingProject(true);
    setCreateProjectError("");

    const sortOrderValue = Number(projectSortOrder);
    const { error } = await supabase.from("projects").insert({
      name: projectName.trim(),
      slug: projectSlug.trim(),
      sort_order: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
      is_active: true,
    });

    if (error) {
      setCreateProjectError("Kunne ikke oprette projekt");
      setCreatingProject(false);
      return;
    }

    setProjectName("");
    setProjectSlug("");
    setProjectSortOrder("0");
    await fetchProjects();
    setCreatingProject(false);
  };

  const openSubcategoryForm = (projectId: string) => {
    setOpenSubcategoryProjectId(projectId);
    setNewSubcategoryName("");
    setNewSubcategorySortOrder("0");
    setSubcategoryError("");
  };

  const closeSubcategoryForm = () => {
    setOpenSubcategoryProjectId(null);
    setNewSubcategoryName("");
    setNewSubcategorySortOrder("0");
    setSubcategoryError("");
  };

  const handleCreateSubcategory = async (projectId: string) => {
    if (!newSubcategoryName.trim()) return;
    setIsSavingSubcategory(true);
    setSubcategoryError("");

    const sortOrderValue = Number(newSubcategorySortOrder);
    const { error } = await supabase.from("project_subcategories").insert({
      project_id: projectId,
      name: newSubcategoryName.trim(),
      sort_order: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
      is_active: true,
    });

    if (error) {
      console.error("Kunne ikke oprette underpunkt", error);
      setSubcategoryError("Kunne ikke oprette underpunkt");
      setIsSavingSubcategory(false);
      return;
    }

    await Promise.all([fetchProjects(), fetchSubcategories()]);
    setIsSavingSubcategory(false);
    closeSubcategoryForm();
  };

  const subcategoriesByProjectId = useMemo(() => {
    const map = new Map<string, SubcategoryRow[]>();
    for (const sub of subcategories) {
      const list = map.get(sub.project_id) ?? [];
      list.push(sub);
      map.set(sub.project_id, list);
    }
    return map;
  }, [subcategories]);

  const periodMeta = useMemo(() => {
    if (summaryRange === "weekly") {
      return {
        label: "denne uge",
        helper: "Mandag til i dag",
        start: getStartOfCurrentWeekMonday(),
        end: getEndOfToday(),
      };
    }
    if (summaryRange === "monthly") {
      return {
        label: "denne måned",
        helper: "1. i måneden til i dag",
        start: getStartOfCurrentMonth(),
        end: getEndOfToday(),
      };
    }
    if (summaryRange === "quarter") {
      return {
        label: "3 mdr",
        helper: "Seneste 3 måneder til i dag",
        start: getStartMonthsAgo(2),
        end: getEndOfToday(),
      };
    }
    return {
      label: "12 mdr",
      helper: "Seneste 12 måneder til i dag",
      start: getStartMonthsAgo(11),
      end: getEndOfToday(),
    };
  }, [summaryRange]);

  const summaryFilteredEntries = useMemo(() => {
    return timeEntries.filter((entry) => {
      const date = parseDayKeyToDate(entry.entry_date);
      return date >= periodMeta.start && date <= periodMeta.end;
    });
  }, [periodMeta, timeEntries]);

  const filteredTimeEntries = summaryFilteredEntries;

  const timeUsageByProject = useMemo(() => {
    const usageMap = new Map<string, { projectName: string; totalHours: number }>();
    const activeProjects = projects.filter((p) => p.is_active);

    for (const project of activeProjects) {
      usageMap.set(project.slug, { projectName: project.name, totalHours: 0 });
    }

    for (const entry of filteredTimeEntries) {
      const usage = usageMap.get(entry.project_id);
      if (!usage) continue;
      usage.totalHours += getEntryDurationHours(entry.start_time, entry.end_time);
    }

    return activeProjects
      .slice()
      .sort((a, b) => {
        const aSort = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bSort = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) return aSort - bSort;
        return a.name.localeCompare(b.name, "da");
      })
      .map((project) => {
        const usage = usageMap.get(project.slug);
        return {
          projectName: project.name,
          projectSlug: project.slug,
          totalHours: usage?.totalHours ?? 0,
        };
      });
  }, [filteredTimeEntries, projects]);

  const projectNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.slug, project.name);
    }
    return map;
  }, [projects]);

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(p.id, p.full_name?.trim() || p.title?.trim() || "Bruger");
    }
    return map;
  }, [profiles]);

  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of profiles) {
      map.set(p.id, p.avatar_url?.trim() || null);
    }
    return map;
  }, [profiles]);

  const projectDashboardRows = useMemo((): ProjectDashboardRow[] => {
    const totalRangeHours = timeUsageByProject.reduce((sum, row) => sum + row.totalHours, 0);
    const activeProjects = projects.filter((p) => p.is_active);

    return activeProjects
      .map((project) => {
        const rangeEntries = filteredTimeEntries.filter((e) => e.project_id === project.slug);
        const periodHours = rangeEntries.reduce(
          (sum, entry) => sum + getEntryDurationHours(entry.start_time, entry.end_time),
          0
        );

        const usersSet = new Set<string>();
        for (const entry of rangeEntries) usersSet.add(entry.user_id);
        const userIds = Array.from(usersSet);

        const byUserMap = new Map<string, number>();
        for (const entry of rangeEntries) {
          const hours = getEntryDurationHours(entry.start_time, entry.end_time);
          byUserMap.set(entry.user_id, (byUserMap.get(entry.user_id) ?? 0) + hours);
        }
        const byUser = Array.from(byUserMap.entries())
          .map(([userId, hours]) => ({
            userId,
            userName: profileNameById.get(userId) ?? "Ukendt bruger",
            avatarUrl: avatarByUserId.get(userId) ?? null,
            hours,
          }))
          .sort((a, b) => b.hours - a.hours);

        const byMonthMap = new Map<string, number>();
        for (const entry of rangeEntries) {
          const monthKey = entry.entry_date.slice(0, 7);
          const hours = getEntryDurationHours(entry.start_time, entry.end_time);
          byMonthMap.set(monthKey, (byMonthMap.get(monthKey) ?? 0) + hours);
        }
        const byMonth = Array.from(byMonthMap.entries())
          .map(([monthKey, hours]) => ({ monthKey, label: formatMonthKey(monthKey), hours }))
          .sort((a, b) => b.monthKey.localeCompare(a.monthKey, "da"));

        const subcategoryMap = new Map<string, number>();
        for (const entry of rangeEntries) {
          const key = entry.subcategory?.trim() || "Uden underpunkt";
          const hours = getEntryDurationHours(entry.start_time, entry.end_time);
          subcategoryMap.set(key, (subcategoryMap.get(key) ?? 0) + hours);
        }
        const bySubcategory = Array.from(subcategoryMap.entries())
          .map(([name, hours]) => ({ name, hours }))
          .sort((a, b) => b.hours - a.hours);

        return {
          projectSlug: project.slug,
          projectName: project.name,
          periodHours,
          sharePct: totalRangeHours > 0 ? (periodHours / totalRangeHours) * 100 : 0,
          userIds,
          byUser,
          byMonth,
          bySubcategory,
          rangeEntries,
        };
      })
      .sort((a, b) => b.periodHours - a.periodHours);
  }, [avatarByUserId, filteredTimeEntries, profileNameById, projects, timeUsageByProject]);

  const summaryPeriodLabel = periodMeta.label;
  const monthsToShow =
    summaryRange === "weekly"
      ? 1
      : summaryRange === "monthly"
        ? 1
        : summaryRange === "quarter"
          ? 3
          : 12;

  const summaryKpis = useMemo(() => {
    let totalHours = 0;
    const userIds = new Set<string>();
    const projectIds = new Set<string>();

    for (const entry of summaryFilteredEntries) {
      totalHours += getEntryDurationHours(entry.start_time, entry.end_time);
      userIds.add(entry.user_id);
      projectIds.add(entry.project_id);
    }

    const activeEmployees = userIds.size;
    const activeProjects = projectIds.size;
    const weekdaysToDate = countWeekdaysInclusive(periodMeta.start, periodMeta.end);
    const expectedHoursPerEmployee = 7.5 * weekdaysToDate;
    const expectedTotal = activeEmployees * expectedHoursPerEmployee;
    const registrationRatePct = expectedTotal > 0 ? (totalHours / expectedTotal) * 100 : 0;
    const registrationRateHelper =
      summaryRange === "weekly"
        ? "Baseret på arbejdsdage indtil i dag"
        : summaryRange === "monthly"
          ? "Baseret på arbejdsdage i måneden til dato"
          : summaryRange === "quarter"
            ? "Baseret på arbejdsdage i de seneste 3 måneder"
            : "Baseret på arbejdsdage i de seneste 12 måneder";

    const clampedRegistrationRatePct = Math.max(0, registrationRatePct);

    return {
      totalHours,
      activeEmployees,
      activeProjects,
      registrationRatePct: clampedRegistrationRatePct,
      registrationRateHelper,
    };
  }, [periodMeta.end, periodMeta.start, summaryFilteredEntries, summaryRange]);

  const registrationByDay = useMemo(() => {
    const todayEnd = getEndOfToday();
    const weekdays = getWeekdaysInRange(periodMeta.start, todayEnd).slice(-7);
    const activeEmployees = profiles.length;

    const hoursByDay = new Map<string, number>();
    for (const entry of summaryFilteredEntries) {
      const current = hoursByDay.get(entry.entry_date) ?? 0;
      hoursByDay.set(
        entry.entry_date,
        current + getEntryDurationHours(entry.start_time, entry.end_time)
      );
    }

    return weekdays.map((dayDate) => {
      const dayKey = toDayKey(dayDate);
      const actual = hoursByDay.get(dayKey) ?? 0;
      const expected = activeEmployees * 7.5;
      const percentage = expected > 0 ? (actual / expected) * 100 : 0;
      const dayLabel = new Intl.DateTimeFormat("da-DK", { weekday: "short" })
        .format(dayDate)
        .replace(".", "");
      return {
        dayKey,
        dayLabel,
        percentage: Number.isFinite(percentage) ? Math.max(0, percentage) : 0,
        actual,
        expected,
        fill: getRegistrationBarColor(percentage),
      };
    });
  }, [periodMeta.start, profiles.length, summaryFilteredEntries]);

  const userUsage = useMemo(
    () => buildUserUsage(profiles, timeEntries, projectNameBySlug),
    [profiles, timeEntries, projectNameBySlug]
  );

  const exportProjectCsv = useCallback(
    (slug: string) => {
      const target = projectDashboardRows.find((row) => row.projectSlug === slug);
      if (!target) return;
      exportProjectCsvFromRows({
        projectSlug: slug,
        summaryRange,
        projectName: target.projectName,
        rangeEntries: target.rangeEntries,
        profileNameById,
      });
    },
    [profileNameById, projectDashboardRows, summaryRange]
  );

  const value: AdminContextValue = {
    session,
    authLoading,
    profile,
    profileLoading,
    projects,
    subcategories,
    timeEntries,
    profiles,
    adminDataLoading,
    adminDataError,
    projectName,
    setProjectName,
    projectSlug,
    setProjectSlug,
    projectSortOrder,
    setProjectSortOrder,
    creatingProject,
    createProjectError,
    openSubcategoryProjectId,
    newSubcategoryName,
    setNewSubcategoryName,
    newSubcategorySortOrder,
    setNewSubcategorySortOrder,
    subcategoryError,
    isSavingSubcategory,
    summaryRange,
    setSummaryRange,
    handleCreateProject,
    openSubcategoryForm,
    closeSubcategoryForm,
    handleCreateSubcategory,
    subcategoriesByProjectId,
    periodMeta,
    summaryFilteredEntries,
    filteredTimeEntries,
    timeUsageByProject,
    projectNameBySlug,
    profileNameById,
    avatarByUserId,
    projectDashboardRows,
    summaryPeriodLabel,
    monthsToShow,
    summaryKpis,
    registrationByDay,
    userUsage,
    exportProjectCsv,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
