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
      className="mx-auto flex h-screen w-full max-w-xl flex-1 flex-col overflow-hidden px-4 py-0 sm:px-6"
    >
      <header
        className="sticky top-0 z-[50] shrink-0 bg-white/55 backdrop-blur-md"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="px-2 pb-3 pt-3 sm:px-4">
          {/* Top app bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goDay(-1)}
                aria-label="Forrige dag"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft/60 bg-white/45 text-evergreen/80 shadow-sm hover:bg-pastel/25"
              >
                ‹
              </button>

              <div className="min-w-0">
                <div className="text-[12px] font-semibold tracking-wide text-evergreen/70">
                  {selectedDayKey ? new Intl.DateTimeFormat("da-DK", { month: "long" }).format(fromDayKey(selectedDayKey)) : ""}
                </div>
                <div className="mt-1 truncate text-[18px] font-extrabold tracking-tight text-forest">
                  {dayLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openDayPicker}
                aria-label="Åbn kalender"
                className="flex h-10 items-center justify-center rounded-2xl border border-line-soft/60 bg-white/45 px-3 text-evergreen/80 shadow-sm hover:bg-pastel/25"
              >
                Kalender
              </button>
              <button
                type="button"
                onClick={() => goDay(1)}
                aria-label="Næste dag"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft/60 bg-white/45 text-evergreen/80 shadow-sm hover:bg-pastel/25"
              >
                ›
              </button>
            </div>
          </div>

          {/* Lightweight “event chips” from entries */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {selectedEntries.slice(0, 3).map((e) => (
              <span
                key={`${e.id}-chip`}
                className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-line-soft/60 bg-white/45 px-2 py-1 text-[12px] font-semibold text-evergreen/80"
              >
                {e.project}
              </span>
            ))}
            {selectedEntries.length > 3 && (
              <span className="inline-flex rounded-full border border-line-soft/60 bg-white/45 px-2 py-1 text-[12px] font-semibold text-evergreen/70">
                +{selectedEntries.length - 3}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
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
        </div>
      </header>

      <section
        className="flex flex-1 flex-col overflow-hidden"
        aria-label="Tidsregistreringer for i dag"
      >
        {/* Scrollable day view */}
        <div className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] pb-24">
          <div className="pb-10">
            <DayTimeline entries={selectedEntries} onEntriesChange={setSelectedEntries} />
          </div>
        </div>
      </section>

      {/* Bottom quick actions (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-[45] border-t border-line-soft/55 bg-white/75 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            className="rounded-2xl border border-line-soft/60 bg-white/55 px-3 py-2 text-[14px] font-semibold text-forest shadow-sm hover:bg-pastel/25"
            onClick={() => {
              const now = new Date();
              setSelectedDayKey(toDayKey(now));
              setDayLabel(formatDay(now));
            }}
          >
            I dag
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft/60 bg-white/55 text-evergreen/80 shadow-sm hover:bg-pastel/25"
              onClick={openDayPicker}
              aria-label="Åbn kalender"
            >
              Kalender
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft/60 bg-white/55 text-evergreen/80 shadow-sm">
              <span className="text-[14px] font-bold" aria-label="Antal blokke">
                {selectedEntries.length}
              </span>
            </div>
          </div>
        </div>
      </div>

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
