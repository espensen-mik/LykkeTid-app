"use client";

import { DayTimeline, type DayEntry } from "@/app/components/day-timeline";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [selectedDayKey, setSelectedDayKey] = useState<string>("");

  const [entriesByDay, setEntriesByDay] = useState<Record<string, DayEntry[]>>(
    {}
  );

  const [profileOpen, setProfileOpen] = useState(false);
  const weekSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const now = new Date();
    const key = toDayKey(now);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only initialization
    setSelectedDayKey(key);
  }, []);

  const selectedEntries = useMemo(
    () => (selectedDayKey ? entriesByDay[selectedDayKey] ?? [] : []),
    [entriesByDay, selectedDayKey]
  );

  const setSelectedEntries = (next: DayEntry[]) => {
    if (!selectedDayKey) return;
    setEntriesByDay((prev) => ({ ...prev, [selectedDayKey]: next }));
  };

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
    if (!selectedDayKey) {
      setSelectedDayKey(nextKey);
      return;
    }
    const from = fromDayKey(selectedDayKey);
    const to = fromDayKey(nextKey);
    let dir: "next" | "prev" | null = null;
    if (to.getTime() > from.getTime()) dir = "next";
    else if (to.getTime() < from.getTime()) dir = "prev";
    setTransitionDirection(dir);
    setSelectedDayKey(nextKey);
  };

  const goDay = (deltaDays: number) => {
    if (!selectedDayKey) return;
    const d = fromDayKey(selectedDayKey);
    d.setDate(d.getDate() + deltaDays);
    const key = toDayKey(d);
    goToDayKey(key);
  };

  const goWeek = (deltaWeeks: number) => goDay(deltaWeeks * 7);

  const handleOpenDatePicker = () => {
    const el = datePickerRef.current;
    if (!el) return;
    // Prefer modern showPicker when available (Safari / mobile browsers)
    const anyEl = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof anyEl.showPicker === "function") {
      anyEl.showPicker();
    } else {
      el.click();
    }
  };

  return (
    <main className="mx-auto flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden sm:max-w-xl">
      {/* Hidden native date picker driven by the calendar icon */}
      <input
        ref={datePickerRef}
        type="date"
        className="absolute h-0 w-0 opacity-0 pointer-events-none"
        value={selectedDayKey || todayKey}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          goToDayKey(value);
        }}
      />
      <header className="z-[100] w-full shrink-0 bg-white/55 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="px-3 pb-1.5 pt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-medium tracking-wide text-evergreen/75">
              LykkeTid
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenDatePicker}
                aria-label="Åbn kalender"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line-soft/55 bg-white/50 text-evergreen/75 shadow-sm hover:bg-pastel/25"
              >
                <CalendarIcon />
              </button>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                aria-label="Profil"
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/80 ring-offset-1 ring-offset-mint/90"
              >
                <Image
                  src="/mik_profil.jpg"
                  alt=""
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                  sizes="36px"
                />
              </button>
            </div>
          </div>

          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-normal text-evergreen/55">
                {selectedDate ? formatMonthYear(selectedDate) : ""}
              </div>
              <button
                type="button"
                aria-label="Gå til i dag"
                onClick={() => {
                  if (!todayKey) return;
                  goToDayKey(todayKey);
                }}
                className={[
                  "rounded-full border px-3 py-1 text-[10px] font-semibold transition",
                  isTodaySelected
                    ? "border-line-soft/50 bg-white/80 text-evergreen/45"
                    : "border-line-soft/70 bg-white/90 text-evergreen/80 shadow-sm hover:bg-pastel/25",
                ].join(" ")}
              >
                I dag
              </button>
            </div>
            <div className="text-[13px] font-normal leading-snug text-evergreen/80">
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
            entries={selectedEntries}
            onEntriesChange={setSelectedEntries}
          />
        </div>

        {/* Floating side day navigation arrows */}
        <button
          type="button"
          aria-label="Forrige dag"
          className="pointer-events-auto absolute left-3 top-1/2 z-[130] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-white/70 text-evergreen/80 shadow-[0_10px_30px_rgba(15,42,29,0.18)] backdrop-blur-md active:scale-[0.97] transition"
          onClick={() => goDay(-1)}
        >
          <span className="text-[18px] leading-none">‹</span>
        </button>
        <button
          type="button"
          aria-label="Næste dag"
          className="pointer-events-auto absolute right-3 top-1/2 z-[130] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-white/70 text-evergreen/80 shadow-[0_10px_30px_rgba(15,42,29,0.18)] backdrop-blur-md active:scale-[0.97] transition"
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
                  Brugeroplysninger og indstillinger kommer her.
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
          </div>
        </div>
      )}
    </main>
  );
}
