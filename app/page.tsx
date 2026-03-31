"use client";

import {
  DayTimeline,
  type DayEntry,
  type TimelineProjectOption,
} from "@/app/components/day-timeline";
import { LoginScreen } from "@/app/components/login-screen";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Clock3 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function fromDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map((x) => Number(x));
  // Local time date to avoid timezone drift.
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatDay(d: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatMonthYear(d: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(d);
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const out = new Date(d);
  out.setDate(d.getDate() - diffToMonday);
  out.setHours(12, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function getWeekDays(d: Date): Date[] {
  const start = startOfWeekMonday(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

type Profile = {
  id: string;
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
};

type TimeEntryRow = {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  project_id: string;
  subcategory: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
};

type TimeEntryInsert = {
  id?: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  project_id: string;
  subcategory: string | null;
  location: string | null;
};

const KNOWN_LOCATIONS = ["Kontor", "Hjemme", "Hal", "Ude"] as const;

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

type ProjectSubcategoryRow = {
  id: string;
  project_id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

function parseDbTimeToHour(dbTime: string): number {
  const [hhRaw, mmRaw] = dbTime.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw ?? "0");
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 8;
  return hh + mm / 60;
}

function toDbTime(hour: number): string {
  const totalMinutes = Math.round(hour * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function toKnownLocation(value: string | null): DayEntry["location"] {
  if (value && (KNOWN_LOCATIONS as readonly string[]).includes(value)) {
    return value as DayEntry["location"];
  }
  return "Kontor";
}

function mapRowToDayEntry(row: TimeEntryRow): DayEntry {
  return {
    id: row.id,
    startHour: parseDbTimeToHour(row.start_time),
    endHour: parseDbTimeToHour(row.end_time),
    project: row.project_id || "andet",
    subcategory: row.subcategory,
    location: toKnownLocation(row.location),
  };
}

function mapDayEntryToInsertPayload(
  entry: DayEntry,
  userId: string,
  dayKey: string
): TimeEntryInsert {
  return {
    id: entry.id,
    user_id: userId,
    entry_date: dayKey,
    start_time: toDbTime(entry.startHour),
    end_time: toDbTime(entry.endHour),
    project_id: entry.project,
    subcategory: entry.subcategory ?? null,
    location: entry.location ?? null,
  };
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="17" rx="2" ry="2" />
      <line x1="16" y1="2.8" x2="16" y2="6.2" />
      <line x1="8" y1="2.8" x2="8" y2="6.2" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() =>
    toDayKey(new Date())
  );
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string>("");
  const [projectOptions, setProjectOptions] = useState<TimelineProjectOption[]>(
    []
  );
  const [projectsError, setProjectsError] = useState<string>("");

  const [profileOpen, setProfileOpen] = useState(false);
  const weekSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const fetchRequestIdRef = useRef(0);
  const selectedDayKeyRef = useRef(selectedDayKey);
  const userId = session?.user?.id ?? null;

  const reloadProjectOptions = useCallback(async (targetUserId: string | null = userId) => {
    if (!targetUserId) return;
    setProjectsError("");

    const [{ data: projectsData, error: projectsFetchError }, { data: subData, error: subsFetchError }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("id, name, slug, is_active, sort_order, created_at")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("project_subcategories")
          .select("id, project_id, name, is_active, sort_order, created_at")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

    if (projectsFetchError || subsFetchError) {
      setProjectsError("Kunne ikke hente projekter");
      return;
    }

    const projects = (projectsData ?? []) as ProjectRow[];
    const subcategories = (subData ?? []) as ProjectSubcategoryRow[];
    const groupedSubs = new Map<string, { id: string; label: string }[]>();
    for (const sub of subcategories) {
      const list = groupedSubs.get(sub.project_id) ?? [];
      list.push({ id: sub.id, label: sub.name });
      groupedSubs.set(sub.project_id, list);
    }

    const mapped: TimelineProjectOption[] = projects.map((project) => ({
      id: project.slug,
      slug: project.slug,
      label: project.name,
      subcategories: groupedSubs.get(project.id) ?? [],
    }));
    setProjectOptions(mapped);
  }, [userId]);

  useEffect(() => {
    let isActive = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isActive) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
      const nextUserId = data.session?.user?.id ?? null;
      if (nextUserId) {
        void reloadProjectOptions(nextUserId);
      } else {
        setProjectOptions([]);
        setProjectsError("");
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      const nextUserId = nextSession?.user?.id ?? null;
      if (nextUserId) {
        void reloadProjectOptions(nextUserId);
      } else {
        setProjectOptions([]);
        setProjectsError("");
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [reloadProjectOptions]);

  useEffect(() => {
    let isActive = true;

    const fetchProfile = async () => {
      if (!session) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive) return;
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, title, avatar_url")
        .eq("id", user.id)
        .single();

      if (!isActive) return;
      setProfile((data as Profile | null) ?? null);
      setProfileLoading(false);
    };

    fetchProfile();

    return () => {
      isActive = false;
    };
  }, [session]);

  async function fetchDayEntries(dayKey: string, forUserId: string) {
    const requestId = ++fetchRequestIdRef.current;
    setEntriesLoading(true);
    setEntriesError("");

    const { data, error } = await supabase
      .from("time_entries")
      .select(
        "id, user_id, entry_date, start_time, end_time, project_id, subcategory, location, created_at, updated_at"
      )
      .eq("user_id", forUserId)
      .eq("entry_date", dayKey)
      .order("start_time", { ascending: true });

    if (requestId !== fetchRequestIdRef.current) return;

    if (error) {
      setEntriesError("Kunne ikke hente tidsregistreringer");
      setDayEntries([]);
      setEntriesLoading(false);
      return;
    }

    const rows = (data ?? []) as TimeEntryRow[];
    setDayEntries(rows.map(mapRowToDayEntry));
    setEntriesLoading(false);
  }

  async function saveEntry(entryInput: DayEntry, dayKey: string) {
    if (!userId) {
      return { error: new Error("Ingen bruger") };
    }

    const payload = mapDayEntryToInsertPayload(entryInput, userId, dayKey);
    const { error } = await supabase
      .from("time_entries")
      .upsert(payload, { onConflict: "id" });

    return { error };
  }

  async function syncDayEntries(nextEntries: DayEntry[]) {
    if (!selectedDayKey || !userId) return;

    setEntriesError("");
    const prevById = new Map(dayEntries.map((e) => [e.id, e]));
    const nextById = new Map(nextEntries.map((e) => [e.id, e]));

    const deletedIds = dayEntries
      .filter((entry) => !nextById.has(entry.id))
      .map((entry) => entry.id);

    if (deletedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("time_entries")
        .delete()
        .eq("user_id", userId)
        .in("id", deletedIds);

      if (deleteError) {
        setEntriesError("Kunne ikke gemme ændringer lige nu");
        return;
      }
    }

    const changedOrNew = nextEntries.filter((entry) => {
      const prev = prevById.get(entry.id);
      if (!prev) return true;
      return (
        prev.startHour !== entry.startHour ||
        prev.endHour !== entry.endHour ||
        prev.project !== entry.project ||
        prev.subcategory !== entry.subcategory ||
        prev.location !== entry.location
      );
    });

    for (const entry of changedOrNew) {
      const { error } = await saveEntry(entry, selectedDayKey);
      if (error) {
        setEntriesError("Kunne ikke gemme ændringer lige nu");
        return;
      }
    }

    await fetchDayEntries(selectedDayKey, userId);
  }

  useEffect(() => {
    if (!userId || !selectedDayKey) return;
    const timer = setTimeout(() => {
      void fetchDayEntries(selectedDayKey, userId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedDayKey, userId]);

  const selectedDate = selectedDayKey ? fromDayKey(selectedDayKey) : null;

  const weekDays = useMemo(() => {
    if (!selectedDate) return [];
    return getWeekDays(selectedDate);
  }, [selectedDate]);

  const headerDateText = useMemo(() => {
    if (!selectedDate) return { weekday: "", dateLine: "" };
    const weekday = new Intl.DateTimeFormat("da-DK", {
      weekday: "long",
    }).format(selectedDate);
    const dateLine = new Intl.DateTimeFormat("da-DK", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(selectedDate);
    return { weekday, dateLine };
  }, [selectedDate]);

  const todayKey = useMemo(() => toDayKey(new Date()), []);
  const isTodaySelected = selectedDayKey === todayKey;

  const [transitionDirection, setTransitionDirection] = useState<
    "next" | "prev" | null
  >(null);

  const goToDayKey = (nextKey: string) => {
    if (!nextKey) return;
    selectedDayKeyRef.current = nextKey;
    if (!selectedDayKey) {
      setSelectedDayKey(nextKey);
      if (userId) void fetchDayEntries(nextKey, userId);
      return;
    }
    const from = fromDayKey(selectedDayKey);
    const to = fromDayKey(nextKey);
    let dir: "next" | "prev" | null = null;
    if (to.getTime() > from.getTime()) dir = "next";
    else if (to.getTime() < from.getTime()) dir = "prev";
    setTransitionDirection(dir);
    setSelectedDayKey(nextKey);
    if (userId) void fetchDayEntries(nextKey, userId);
  };

  const goDay = (deltaDays: number) => {
    if (!selectedDayKey) return;
    const d = fromDayKey(selectedDayKey);
    d.setDate(d.getDate() + deltaDays);
    const key = toDayKey(d);
    goToDayKey(key);
  };

  const goWeek = (deltaWeeks: number) => goDay(deltaWeeks * 7);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfileOpen(false);
  };

  const displayName =
    profile?.full_name?.trim() || session?.user?.email || "Bruger";
  const displayTitle = profile?.title?.trim() || "Medlem";
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (authLoading) {
    return (
      <main className="mx-auto flex h-full min-h-0 w-full flex-1 items-center justify-center px-4">
        <div className="rounded-xl border border-line-soft/45 bg-white/70 px-4 py-2 text-[13px] font-medium text-evergreen/70">
          Indlæser...
        </div>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <main className="mx-auto flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden sm:max-w-xl">
      <header className="z-[100] w-full shrink-0 bg-white/55 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="px-3 pb-1.5 pt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-evergreen">
              <Clock3
                className="h-[17px] w-[17px]"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className="text-[17px] font-bold tracking-tight">LykkeTid</span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label="Gå til i dag"
                onClick={() => {
                  if (!todayKey) return;
                  goToDayKey(todayKey);
                }}
                className={[
                  "flex h-9 items-center rounded-xl border px-3 text-[12px] font-semibold transition",
                  isTodaySelected
                    ? "border-line-soft/50 bg-white/75 text-evergreen/45"
                    : "border-line-soft/70 bg-white/90 text-evergreen/85 shadow-sm hover:bg-pastel/25",
                ].join(" ")}
              >
                I dag
              </button>
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line-soft/55 bg-white/50 text-evergreen/75 shadow-sm hover:bg-pastel/25">
                <CalendarIcon />
                <input
                  ref={datePickerRef}
                  type="date"
                  aria-label="Åbn kalender"
                  className="absolute inset-0 opacity-0"
                  value={selectedDayKey || todayKey}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;
                    goToDayKey(value);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                aria-label="Profil"
                className="flex items-center gap-2 rounded-xl border border-line-soft/60 bg-white/70 px-1.5 py-1 shadow-sm"
              >
                <div className="min-w-0 text-right">
                  <div className="max-w-[7.5rem] truncate text-[11px] font-semibold text-forest">
                    {profileLoading ? "Henter..." : displayName}
                  </div>
                  <div className="max-w-[7.5rem] truncate text-[10px] text-evergreen/65">
                    {displayTitle}
                  </div>
                </div>
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-[12px] font-semibold text-white ring-2 ring-white/80 ring-offset-1 ring-offset-mint/90">
                  {avatarUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${avatarUrl}")` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span>{initials || "?"}</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-evergreen/70">
                {selectedDate ? formatMonthYear(selectedDate) : ""}
              </div>
            </div>
            <div className="text-[15px] font-semibold leading-snug text-evergreen">
              <span className="capitalize">{headerDateText.weekday}</span>
              <span className="mx-1 text-evergreen/35">·</span>
              <span>{headerDateText.dateLine}</span>
            </div>
          </div>

          {/* Slim week strip — swipe left/right for previous/next week (look unchanged) */}
          <div
            className="mt-2 border-t border-line-soft/40 pt-2"
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              weekSwipeStartRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              const start = weekSwipeStartRef.current;
              weekSwipeStartRef.current = null;
              if (!start) return;

              const t = e.changedTouches[0];
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;

              if (Math.abs(dx) < 50) return;
              if (Math.abs(dy) > 70) return;

              e.stopPropagation();
              if (dx < 0) goWeek(1);
              else goWeek(-1);
            }}
          >
            <div className="grid grid-cols-7 gap-0.5">
              {weekDays.map((d) => {
                const key = toDayKey(d);
                const isSelected = key === selectedDayKey;
                const weekdayNarrow = new Intl.DateTimeFormat("da-DK", {
                  weekday: "narrow",
                }).format(d);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      goToDayKey(key);
                    }}
                    aria-label={`Vælg ${formatDay(d)}`}
                    className="flex min-w-0 flex-col items-center rounded-lg py-0.5 transition-colors hover:bg-pastel/25"
                  >
                    <span className="text-[9px] font-medium uppercase leading-none text-evergreen/50">
                      {weekdayNarrow}
                    </span>
                    <span
                      className={[
                        "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                        isSelected
                          ? "bg-accent text-white shadow-sm"
                          : "text-forest/85",
                      ].join(" ")}
                    >
                      {d.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Fills remaining viewport; 08:00–16:00 scales to this area (no overlap under header) */}
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {projectsError ? (
          <div className="mx-3 mt-1 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-1.5 text-[11px] font-medium text-amber-700">
            {projectsError}
          </div>
        ) : null}
        {entriesError ? (
          <div className="mx-3 mt-1 rounded-lg border border-rose-200/70 bg-rose-50/80 px-3 py-1.5 text-[11px] font-medium text-rose-700">
            {entriesError}
          </div>
        ) : null}
        {entriesLoading ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-evergreen/20 border-t-accent bg-white/45 backdrop-blur-sm" />
          </div>
        ) : null}
        <div
          key={selectedDayKey ?? "no-day"}
          className={[
            "flex h-full min-h-0 w-full flex-1 flex-col transition-transform duration-200 ease-out will-change-transform",
            transitionDirection === "next"
              ? "day-slide-next"
              : transitionDirection === "prev"
              ? "day-slide-prev"
              : "",
          ].join(" ")}
          onAnimationEnd={() => setTransitionDirection(null)}
        >
          <DayTimeline
            entries={dayEntries}
            onEntriesChange={syncDayEntries}
            projectOptions={projectOptions}
            onOpenEntryForm={reloadProjectOptions}
          />
        </div>

        {/* Floating side day navigation arrows (below modal z-index) */}
        <button
          type="button"
          aria-label="Forrige dag"
          className="pointer-events-auto absolute left-3 top-[43.75%] z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-white/70 text-evergreen/80 shadow-[0_10px_30px_rgba(15,42,29,0.18)] backdrop-blur-md active:scale-[0.97] transition"
          onClick={() => goDay(-1)}
        >
          <span className="text-[18px] leading-none">‹</span>
        </button>
        <button
          type="button"
          aria-label="Næste dag"
          className="pointer-events-auto absolute right-3 top-[43.75%] z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-white/70 text-evergreen/80 shadow-[0_10px_30px_rgba(15,42,29,0.18)] backdrop-blur-md active:scale-[0.97] transition"
          onClick={() => goDay(1)}
        >
          <span className="text-[18px] leading-none">›</span>
        </button>
      </section>

      {profileOpen && (
        <div className="fixed inset-0 z-[205] flex items-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            aria-label="Luk profil"
            onClick={() => setProfileOpen(false)}
          />
          <div className="relative w-full rounded-t-[1.5rem] bg-white/95 px-4 pb-6 pt-4 ring-1 ring-forest-deep/[0.05] sm:px-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line-soft/70" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-forest">Profil</div>
                <div className="mt-1 text-[12px] font-medium text-evergreen/65">
                  {displayName}
                </div>
                <div className="mt-0.5 text-[12px] text-evergreen/60">
                  {displayTitle}
                </div>
                <div className="mt-1 text-[11px] text-evergreen/50">
                  {session?.user?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-xl px-2 py-2 text-evergreen/70 hover:bg-pastel/35"
                aria-label="Luk"
              >
                <span className="text-[18px] leading-none">×</span>
              </button>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={signOut}
                className="w-full rounded-xl border border-line-soft/75 bg-white px-3 py-2 text-[14px] font-semibold text-forest transition-colors hover:bg-pastel/25"
              >
                Log ud
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
