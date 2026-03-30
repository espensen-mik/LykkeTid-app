"use client";

import { DayTimeline, type DayEntry } from "@/app/components/day-timeline";
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

/** Same on server and first client paint — avoids hydration mismatch */
const DATE_HEADER_FALLBACK = "\u2026";

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
  const [dayLabel, setDayLabel] = useState<string>(DATE_HEADER_FALLBACK);

  const [entriesByDay, setEntriesByDay] = useState<Record<string, DayEntry[]>>(
    {}
  );

  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayDraftKey, setDayDraftKey] = useState<string>("");
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const now = new Date();
    const key = toDayKey(now);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only initialization
    setSelectedDayKey(key);
    setDayLabel(formatDay(now));
  }, []);

  useEffect(() => {
    const update = () => {
      const el = headerRef.current;
      if (!el) return;
      setHeaderHeight(el.getBoundingClientRect().height);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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

  const goDay = (deltaDays: number) => {
    if (!selectedDayKey) return;
    const d = fromDayKey(selectedDayKey);
    d.setDate(d.getDate() + deltaDays);
    const key = toDayKey(d);
    setSelectedDayKey(key);
    setDayLabel(formatDay(d));
  };

  const openDayPicker = () => {
    if (!selectedDayKey) return;
    setDayDraftKey(selectedDayKey);
    setDayPickerOpen(true);
  };

  const closeDayPicker = () => setDayPickerOpen(false);

  const saveDayPicker = () => {
    if (!dayDraftKey) return;
    const d = fromDayKey(dayDraftKey);
    setSelectedDayKey(dayDraftKey);
    setDayLabel(formatDay(d));
    setDayPickerOpen(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col sm:max-w-xl">
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-[100] shrink-0 bg-white/55 backdrop-blur-md"
      >
        <div
          className="px-3 pt-3 pb-2"
          onTouchStart={(e) => {
            if (dayPickerOpen) return;
            const t = e.touches[0];
            swipeStartRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            if (dayPickerOpen) return;
            const start = swipeStartRef.current;
            if (!start) return;
            swipeStartRef.current = null;

            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;

            if (Math.abs(dx) < 60) return;
            if (Math.abs(dy) > 80) return;

            // Swipe left => next day
            if (dx < 0) goDay(1);
            else goDay(-1);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-[12px] font-semibold tracking-wide text-evergreen/80">
                LykkeTid
              </div>
            </div>

            <button
              type="button"
              onClick={openDayPicker}
              aria-label="Åbn kalender"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft/60 bg-white/45 text-evergreen/80 shadow-sm hover:bg-pastel/25"
            >
              <CalendarIcon />
            </button>
          </div>

          <div className="mt-2">
            <div className="text-xs font-semibold tracking-wide text-evergreen/60">
              {selectedDate ? formatMonthYear(selectedDate) : ""}
            </div>
            <div className="mt-1 text-[22px] font-extrabold tracking-tight text-forest">
              {dayLabel}
            </div>
          </div>

        </div>
      </header>

      {/* Spacer to offset fixed header */}
      <div style={{ height: headerHeight }} />

      {/* Full day hour timeline (page scroll) */}
      <section className="pb-10">
        <DayTimeline
          entries={selectedEntries}
          onEntriesChange={setSelectedEntries}
        />
      </section>

      {/* Day picker bottom sheet */}
      {dayPickerOpen && (
        <div className="fixed inset-0 z-[210] flex items-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            aria-label="Luk kalender"
            onClick={closeDayPicker}
          />
          <div className="relative w-full rounded-t-[1.5rem] bg-white/95 px-4 pb-6 pt-4 ring-1 ring-forest-deep/[0.05] sm:px-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line-soft/70" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-forest">Vælg dato</div>
              </div>
              <button
                type="button"
                onClick={closeDayPicker}
                className="rounded-xl px-2 py-2 text-evergreen/70 hover:bg-pastel/35"
                aria-label="Annuller kalender"
              >
                <span className="text-[18px] leading-none">×</span>
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-[12px] font-semibold text-forest">
                Dato
              </label>
              <input
                type="date"
                value={dayDraftKey}
                onChange={(e) => setDayDraftKey(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeDayPicker}
                className="flex-1 rounded-xl border border-line-soft/75 bg-white px-3 py-2 text-[14px] font-semibold text-forest transition-colors hover:bg-pastel/25"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={saveDayPicker}
                className="flex-1 rounded-xl bg-accent px-3 py-2 text-[14px] font-semibold text-white shadow-[0_12px_30px_-18px_rgba(76,167,113,0.75)] transition-colors hover:bg-accent-mid"
              >
                Vælg
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
