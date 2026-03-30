"use client";

import { DayTimeline, type DayEntry } from "@/app/components/day-timeline";
import { useEffect, useMemo, useState } from "react";

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

/** Same on server and first client paint — avoids hydration mismatch */
const DATE_HEADER_FALLBACK = "\u2026";

export default function Home() {
  const [selectedDayKey, setSelectedDayKey] = useState<string>("");
  const [dayLabel, setDayLabel] = useState<string>(DATE_HEADER_FALLBACK);

  const [entriesByDay, setEntriesByDay] = useState<Record<string, DayEntry[]>>(
    {}
  );

  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayDraftKey, setDayDraftKey] = useState<string>("");

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    const now = new Date();
    const key = toDayKey(now);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only initialization
    setSelectedDayKey(key);
    setDayLabel(formatDay(now));
  }, []);

  const selectedEntries = useMemo(
    () => (selectedDayKey ? entriesByDay[selectedDayKey] ?? [] : []),
    [entriesByDay, selectedDayKey]
  );

  const setSelectedEntries = (next: DayEntry[]) => {
    if (!selectedDayKey) return;
    setEntriesByDay((prev) => ({ ...prev, [selectedDayKey]: next }));
  };

  const trackedProgress = useMemo(() => {
    const totalMinutes = selectedEntries.reduce((sum, e) => {
      const minutes = Math.round((e.endHour - e.startHour) * 60);
      return sum + Math.max(0, minutes);
    }, 0);
    const trackedHours = totalMinutes / 60;
    const progress = Math.min(1, trackedHours / 7.5);
    return { totalMinutes, trackedHours, progress };
  }, [selectedEntries]);

  const trackedLabel = trackedProgress.trackedHours.toFixed(1).replace(".", ",");
  const progressPercent = Math.round(trackedProgress.progress * 100);

  const goDay = (deltaDays: number) => {
    if (!selectedDayKey) return;
    const d = fromDayKey(selectedDayKey);
    d.setDate(d.getDate() + deltaDays);
    const key = toDayKey(d);
    setSelectedDayKey(key);
    setDayLabel(formatDay(d));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (dayPickerOpen) return;
    const t = e.touches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || dayPickerOpen) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;

    // Swipe threshold: horizontal intent, low vertical drift.
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > 80) return;

    // Finger swipes left => next day.
    if (dx < 0) goDay(1);
    else goDay(-1);

    setTouchStart(null);
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
    <main
      className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-wide text-evergreen/90">LykkeTid</p>
            <h1 className="mt-2 min-h-[2.25rem] truncate text-2xl font-bold tracking-tight text-forest sm:min-h-[2.5rem] sm:text-3xl">
              {dayLabel}
            </h1>
          </div>

          {/* Desktop day navigation */}
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => goDay(-1)}
              aria-label="Forrige dag"
              className="rounded-xl border border-line-soft/60 bg-white/50 px-3 py-2 text-evergreen/80 shadow-sm hover:bg-pastel/25"
            >
              ←
            </button>
            <button
              type="button"
              onClick={openDayPicker}
              aria-label="Åbn kalender"
              className="rounded-xl border border-line-soft/60 bg-white/50 px-3 py-2 text-evergreen/80 shadow-sm hover:bg-pastel/25"
            >
              Kalender
            </button>
            <button
              type="button"
              onClick={() => goDay(1)}
              aria-label="Næste dag"
              className="rounded-xl border border-line-soft/60 bg-white/50 px-3 py-2 text-evergreen/80 shadow-sm hover:bg-pastel/25"
            >
              →
            </button>
          </div>
        </div>

        {/* Mobile calendar button */}
        <div className="mt-3 flex items-center justify-end sm:hidden">
          <button
            type="button"
            onClick={openDayPicker}
            aria-label="Åbn kalender"
            className="rounded-xl border border-line-soft/60 bg-white/50 px-3 py-2 text-evergreen/80 shadow-sm hover:bg-pastel/25"
          >
            Kalender
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] font-semibold text-evergreen/60">
            <span>
              {trackedLabel} / 7,5 t
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line-soft/30">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, progressPercent)}%` }}
            />
          </div>
        </div>
      </header>

      <section
        className="mt-6 flex flex-1 flex-col gap-0"
        aria-label="Tidsregistreringer for i dag"
      >
        <div className="flex-1">
          <DayTimeline entries={selectedEntries} onEntriesChange={setSelectedEntries} />
        </div>
      </section>

      {/* Day picker bottom sheet */}
      {dayPickerOpen && (
        <div className="fixed inset-0 z-[90] flex items-end">
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
