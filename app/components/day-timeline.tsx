"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DAY_START = 8;
const EVENING_END = 20;
const SLOT_DURATION_HOURS = 1;

/** Row height in px — one hour per row */
const ROW_PX = 48;

const PROJECTS = ["Drift", "LykkeCup", "KlasseBold", "Håndboldtjek"] as const;
const LOCATIONS = ["Kontor", "Hjemme", "Hal", "Ude"] as const;

const PROJECT_STYLES: Record<
  (typeof PROJECTS)[number],
  { from: string; to: string; border: string }
> = {
  Drift: { from: "#4ca771", to: "#3f9a68", border: "rgba(76,167,113,0.35)" },
  LykkeCup: {
    from: "#fbbf24",
    to: "#f59e0b",
    border: "rgba(245,158,11,0.35)",
  },
  KlasseBold: {
    from: "#7c3aed",
    to: "#6d28d9",
    border: "rgba(124,58,237,0.35)",
  },
  Håndboldtjek: {
    from: "#f43f5e",
    to: "#e11d48",
    border: "rgba(244,63,94,0.35)",
  },
};

function formatHour(h: number): string {
  // `h` may be fractional (e.g. 10.25 = 10:15).
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type DayEntry = {
  id: string;
  startHour: number;
  endHour: number;
  project: (typeof PROJECTS)[number];
  location: (typeof LOCATIONS)[number];
  note?: string;
};

export function DayTimeline({
  entries,
  onEntriesChange,
}: {
  entries: DayEntry[];
  onEntriesChange: (next: DayEntry[]) => void;
}) {
  const [isSelecting, setIsSelecting] = useState(false);

  type Draft = {
    id?: string;
    startHour: number;
    endHour: number;
    project: (typeof PROJECTS)[number];
    location: (typeof LOCATIONS)[number];
    note: string;
  };

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [dragSelection, setDragSelection] = useState<{
    startHour: number;
    endHour: number;
  } | null>(null);
  const [dragBlocked, setDragBlocked] = useState(false);

  const snapToQuarterHour = (hour: number) => {
    const totalMinutes = Math.round(hour * 60);
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    return snappedMinutes / 60;
  };

  const DRAG_TAP_THRESHOLD_PX = 2;
  /** Touch: wait before tap/drag selection so vertical scroll isn’t mistaken for a slot gesture */
  const ARM_DELAY_MS = 280;
  /** If the finger moves farther than this before the arm delay, treat as scroll — cancel */
  const SCROLL_CANCEL_THRESHOLD_PX = 14;

  const activePointerIdRef = useRef<number | null>(null);
  const dragStartHourRef = useRef<number | null>(null);
  const dragOriginClientYRef = useRef<number | null>(null);
  const dragGestureStartedRef = useRef(false);

  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    pointerId: number;
    slotStart: number;
    originX: number;
    originY: number;
  } | null>(null);
  const pendingTargetRef = useRef<HTMLButtonElement | null>(null);
  const pendingListenersCleanupRef = useRef<(() => void) | null>(null);
  const armedRef = useRef(false);

  const dragSelectionRef = useRef(dragSelection);
  const dragBlockedRef = useRef(dragBlocked);

  const resetDragSelection = useCallback(() => {
    dragSelectionRef.current = null;
    dragBlockedRef.current = false;
    setDragSelection(null);
    setDragBlocked(false);
  }, []);

  const applyDragSelection = useCallback(
    (next: { startHour: number; endHour: number }, blocked: boolean) => {
      dragSelectionRef.current = next;
      dragBlockedRef.current = blocked;
      setDragSelection(next);
      setDragBlocked(blocked);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (armTimerRef.current != null) clearTimeout(armTimerRef.current);
      if (pendingListenersCleanupRef.current) pendingListenersCleanupRef.current();
    };
  }, []);

  // Always show the full day timeline (including evenings).
  const dayEnd = EVENING_END;

  const labels = useMemo(() => {
    const out: number[] = [];
    for (let h = DAY_START; h <= dayEnd; h += 1) out.push(h);
    return out;
  }, [dayEnd]);

  const timelineHeightPx = (dayEnd - DAY_START) * ROW_PX;

  const openDraftForRange = useCallback(
    (startHour: number, endHour: number) => {
      if (startHour < DAY_START || endHour > dayEnd) return;
      if (endHour <= startHour) return;

      const slotOccupied = entries.some(
        (e) => startHour < e.endHour && endHour > e.startHour
      );
      if (slotOccupied) return;

      setDraft({
        startHour: snapToQuarterHour(startHour),
        endHour: snapToQuarterHour(endHour),
        project: PROJECTS[0],
        location: LOCATIONS[0],
        note: "",
      });
      setSheetOpen(true);
    },
    [entries, dayEnd]
  );

  const openDraftForEntry = useCallback((entry: DayEntry) => {
    setDraft({
      id: entry.id,
      startHour: snapToQuarterHour(entry.startHour),
      endHour: snapToQuarterHour(entry.endHour),
      project: entry.project as Draft["project"],
      location: entry.location as Draft["location"],
      note: entry.note ?? "",
    });
    setSheetOpen(true);
  }, []);

  const isRangeBlocked = useCallback(
    (startHour: number, endHour: number) =>
      entries.some((e) => startHour < e.endHour && endHour > e.startHour),
    [entries]
  );

  const getSlotStartForClientY = useCallback(
    (clientY: number) => {
      const el = timelineRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top;
      const slotCount = dayEnd - DAY_START; // e.g. 8 hours
      const idx = Math.floor(y / ROW_PX);
      const clampedIdx = Math.max(0, Math.min(slotCount - 1, idx));
      return DAY_START + clampedIdx;
    },
    [dayEnd]
  );

  const clearArmTimer = useCallback(() => {
    if (armTimerRef.current != null) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }, []);

  const removePendingListeners = useCallback(() => {
    if (pendingListenersCleanupRef.current) {
      pendingListenersCleanupRef.current();
      pendingListenersCleanupRef.current = null;
    }
  }, []);

  const cancelPendingTouch = useCallback(() => {
    clearArmTimer();
    removePendingListeners();
    const pend = pendingRef.current;
    const el = pendingTargetRef.current;
    const pid = pend?.pointerId ?? activePointerIdRef.current;
    if (el != null && pid != null) {
      try {
        el.releasePointerCapture(pid);
      } catch {
        // no-op
      }
    }
    pendingRef.current = null;
    pendingTargetRef.current = null;
    armedRef.current = false;
    activePointerIdRef.current = null;
    dragStartHourRef.current = null;
    dragOriginClientYRef.current = null;
    dragGestureStartedRef.current = false;
    setIsSelecting(false);
    resetDragSelection();
  }, [clearArmTimer, removePendingListeners, resetDragSelection]);

  const finishDrag = useCallback(
    (pointerId: number) => {
      if (activePointerIdRef.current !== pointerId) return;

      activePointerIdRef.current = null;
      dragStartHourRef.current = null;
      dragOriginClientYRef.current = null;
      dragGestureStartedRef.current = false;
      armedRef.current = false;
      setIsSelecting(false);

      const sel = dragSelectionRef.current;
      const blocked = dragBlockedRef.current;
      if (sel && !blocked) {
        openDraftForRange(sel.startHour, sel.endHour);
      }

      resetDragSelection();
    },
    [openDraftForRange, resetDragSelection]
  );

  const handleSlotPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, slotStart: number) => {
      if (sheetOpen) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      // Desktop / mouse: immediate selection (no delay)
      if (e.pointerType === "mouse") {
        armedRef.current = true;
        activePointerIdRef.current = e.pointerId;
        dragStartHourRef.current = slotStart;
        dragOriginClientYRef.current = e.clientY;
        dragGestureStartedRef.current = false;
        setIsSelecting(false);

        const endHour = slotStart + SLOT_DURATION_HOURS;
        applyDragSelection(
          { startHour: slotStart, endHour },
          isRangeBlocked(slotStart, endHour)
        );

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // no-op
        }
        return;
      }

      // Touch: defer *visual* selection, but capture the pointer synchronously here.
      // (iOS/Safari only reliably tracks drags if setPointerCapture runs in pointerdown.)
      cancelPendingTouch();

      const pointerId = e.pointerId;
      const originX = e.clientX;
      const originY = e.clientY;
      const el = e.currentTarget;

      pendingRef.current = { pointerId, slotStart, originX, originY };
      pendingTargetRef.current = el;
      armedRef.current = false;

      try {
        el.setPointerCapture(pointerId);
      } catch {
        // no-op
      }

      armTimerRef.current = setTimeout(() => {
        armTimerRef.current = null;
        const pend = pendingRef.current;
        if (!pend || pend.pointerId !== pointerId) return;

        armedRef.current = true;
        activePointerIdRef.current = pointerId;
        dragStartHourRef.current = pend.slotStart;
        dragOriginClientYRef.current = pend.originY;
        dragGestureStartedRef.current = false;
        setIsSelecting(false);

        const endHour = pend.slotStart + SLOT_DURATION_HOURS;
        applyDragSelection(
          { startHour: pend.slotStart, endHour },
          isRangeBlocked(pend.slotStart, endHour)
        );

        pendingRef.current = null;
      }, ARM_DELAY_MS);
    },
    [applyDragSelection, cancelPendingTouch, isRangeBlocked, sheetOpen]
  );

  const handleSlotPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const pointerId = e.pointerId;

      // Touch: waiting for arm — cancel if finger moves enough to mean “scroll”
      if (!armedRef.current && pendingRef.current?.pointerId === pointerId) {
        const p = pendingRef.current;
        const dist = Math.hypot(e.clientX - p.originX, e.clientY - p.originY);
        if (dist > SCROLL_CANCEL_THRESHOLD_PX) {
          cancelPendingTouch();
        }
        return;
      }

      if (activePointerIdRef.current !== pointerId) return;
      const startHour = dragStartHourRef.current;
      if (startHour == null) return;

      const originY = dragOriginClientYRef.current;
      const dy = originY == null ? 0 : Math.abs(e.clientY - originY);

      const currentSlotStart = getSlotStartForClientY(e.clientY);
      if (currentSlotStart == null) return;

      const slotChanged = currentSlotStart !== startHour;

      // Keep a 1-hour pill until the finger moves enough or enters another hour
      if (
        !dragGestureStartedRef.current &&
        dy < DRAG_TAP_THRESHOLD_PX &&
        !slotChanged
      ) {
        const endHour = startHour + SLOT_DURATION_HOURS;
        applyDragSelection(
          { startHour, endHour },
          isRangeBlocked(startHour, endHour)
        );
        return;
      }

      dragGestureStartedRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      setIsSelecting(true);

      const selStart = Math.min(startHour, currentSlotStart);
      const selEnd = Math.max(startHour, currentSlotStart) + SLOT_DURATION_HOURS;

      applyDragSelection(
        { startHour: selStart, endHour: selEnd },
        isRangeBlocked(selStart, selEnd)
      );
    },
    [applyDragSelection, cancelPendingTouch, getSlotStartForClientY, isRangeBlocked]
  );

  const handleSlotPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const pointerId = e.pointerId;

      if (pendingRef.current?.pointerId === pointerId && !armedRef.current) {
        cancelPendingTouch();
        return;
      }

      finishDrag(pointerId);
    },
    [cancelPendingTouch, finishDrag]
  );

  const handleSlotPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const pointerId = e.pointerId;
      if (pendingRef.current?.pointerId === pointerId && !armedRef.current) {
        cancelPendingTouch();
        return;
      }
      if (activePointerIdRef.current === pointerId) {
        activePointerIdRef.current = null;
        dragStartHourRef.current = null;
        dragOriginClientYRef.current = null;
        dragGestureStartedRef.current = false;
        armedRef.current = false;
        setIsSelecting(false);
        resetDragSelection();
      }
    },
    [cancelPendingTouch, resetDragSelection]
  );

  const cancelDraft = useCallback(() => {
    setSheetOpen(false);
    setDraft(null);
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft) return;
    const snappedStart = snapToQuarterHour(draft.startHour);
    const snappedEnd = snapToQuarterHour(draft.endHour);

    const slotOccupied = entries.some((e) => {
      if (draft.id && e.id === draft.id) return false;
      return snappedStart < e.endHour && snappedEnd > e.startHour;
    });
    if (slotOccupied) return;

    if (draft.id) {
      const next = entries
        .map((e) => {
          if (e.id !== draft.id) return e;
          return {
            ...e,
            startHour: snappedStart,
            endHour: snappedEnd,
            project: draft.project,
            location: draft.location,
            note: draft.note.trim() ? draft.note.trim() : undefined,
          };
        })
        .sort((a, b) => a.startHour - b.startHour);
      onEntriesChange(next);
    } else {
      const next = [
        ...entries,
        {
          id: crypto.randomUUID(),
          startHour: snappedStart,
          endHour: snappedEnd,
          project: draft.project,
          location: draft.location,
          note: draft.note.trim() ? draft.note.trim() : undefined,
        },
      ].sort((a, b) => a.startHour - b.startHour);
      onEntriesChange(next);
    }

    cancelDraft();
  }, [draft, cancelDraft, entries, onEntriesChange]);

  const deleteDraft = useCallback(() => {
    if (!draft?.id) return;
    onEntriesChange(entries.filter((e) => e.id !== draft.id));
    cancelDraft();
  }, [draft, cancelDraft, onEntriesChange, entries]);

  const hasEntries = entries.length > 0;

  return (
    <>
      <div
        className="overflow-hidden bg-transparent px-0 py-0 select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [touch-action:pan-y] sm:rounded-[1.25rem] sm:border sm:border-line-soft/55 sm:bg-white/55 sm:px-3 sm:py-3 sm:shadow-sm sm:shadow-forest-deep/[0.06] sm:ring-1 sm:ring-forest-deep/[0.03] sm:backdrop-blur-sm"
        aria-label="Dagtidslinje"
        data-day-timeline-root="true"
      >
        <div className="flex px-1 sm:px-0">
          {/* Left time column */}
          <div
            className="relative shrink-0 w-[4.15rem] select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [touch-action:pan-y] sm:w-[4.4rem]"
            style={{ height: timelineHeightPx }}
          >
            {labels.map((h) => {
              // Start-time labels sit slightly below the top line for a calmer look.
              const y =
                h === dayEnd
                  ? timelineHeightPx - 16
                  : (h - DAY_START) * ROW_PX + 16;
              return (
                <div
                  key={h}
                  className="absolute right-1.5 text-right text-[12px] font-semibold tabular-nums text-evergreen/60 select-none [-webkit-user-select:none] [-webkit-touch-callout:none]"
                  aria-hidden
                  style={{
                    top: y,
                    transform: "translateY(-50%)",
                  }}
                >
                  {formatHour(h)}
                </div>
              );
            })}

          </div>

          {/* Timeline column */}
          <div
            className="relative min-w-0 flex-1 border-l border-line-soft/70 bg-[linear-gradient(180deg,rgba(234,249,231,0.22)_0%,rgba(255,255,255,0.72)_100%)] select-none [-webkit-user-select:none] [-webkit-touch-callout:none]"
              style={{ height: timelineHeightPx }}
              ref={timelineRef}
          >
            {/* Faint “add” affordance near the bottom (touch-friendly) */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-accent/12 to-transparent"
              aria-hidden
            />

            {/* Empty state */}
            {!hasEntries && (
              <>
                <div
                  className="pointer-events-none absolute left-3 right-3 top-1/2 -translate-y-1/2 text-center text-[12px] font-medium text-evergreen/35"
                  aria-hidden
                >
                  Ingen tidsblokke endnu
                </div>

                <div
                  className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-evergreen/15 bg-white/60 px-3 py-1 text-[12px] font-semibold text-evergreen/60 shadow-[0_8px_30px_rgba(15,42,29,0.08)]"
                  aria-hidden
                >
                  Hold et øjeblik på en time for at tilføje — scroll frit i listen
                </div>
              </>
            )}

            {/* Drag selection highlight */}
            {dragSelection && (
              <div
                className="pointer-events-none absolute left-2 right-2 z-[6] rounded-lg border px-2 py-1 transition-[top,height] duration-100"
                style={{
                  top: (dragSelection.startHour - DAY_START) * ROW_PX + 2,
                  height: Math.max(
                    8,
                    (dragSelection.endHour - dragSelection.startHour) * ROW_PX - 4
                  ),
                }}
                aria-hidden
              >
                <div
                  className={[
                    "h-full w-full rounded-[0.45rem]",
                    dragBlocked
                      ? "border-rose-400/55 bg-rose-400/12"
                      : "border-accent/45 bg-accent/15",
                  ].join(" ")}
                />
              </div>
            )}

            {Array.from({ length: dayEnd - DAY_START }, (_, i) => {
              const slotStart = DAY_START + i;
              const isLastSlot = slotStart === dayEnd - 1;
              return (
                <button
                  key={slotStart}
                  type="button"
                  className={[
                    "group absolute left-0 right-0 z-0 border-b border-line-soft/30 bg-transparent text-left",
                    "transition-colors duration-150",
                    "hover:bg-pastel/22 active:bg-pastel/32",
                    "focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    isLastSlot ? "bg-transparent" : "",
                    "select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [touch-action:pan-y]",
                    isSelecting ? "[-webkit-touch-callout:none] [touch-action:none]" : "",
                  ].join(" ")}
                  style={{
                    top: (slotStart - DAY_START) * ROW_PX,
                    height: ROW_PX,
                  }}
                  onPointerDown={(e) => handleSlotPointerDown(e, slotStart)}
                  onPointerMove={handleSlotPointerMove}
                  onPointerUp={handleSlotPointerUp}
                  onPointerCancel={handleSlotPointerCancel}
                  aria-label={`Tilføj tidsblok fra ${formatHour(slotStart)}`}
                >
                  <span
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[16px] font-light leading-none text-accent opacity-0 transition-opacity duration-150 group-hover:opacity-30"
                    aria-hidden
                  >
                    +
                  </span>
                </button>
              );
            })}

            {entries.map((entry, idx) => {
              const durationHours = entry.endHour - entry.startHour;
              const durationMinutes = Math.round(durationHours * 60);
              const projectStyle = PROJECT_STYLES[entry.project] ?? PROJECT_STYLES.Drift;

              const showProject = durationMinutes >= 30;

              return (
                <div
                  key={entry.id}
                  style={{
                    top: (entry.startHour - DAY_START) * ROW_PX + 2,
                    height: Math.max(8, durationHours * ROW_PX - 4),
                    zIndex: 10 + idx,
                    borderColor: projectStyle.border,
                    background: `linear-gradient(180deg, ${projectStyle.from} 0%, ${projectStyle.to} 100%)`,
                  }}
                  className="absolute left-2 right-2 flex items-center justify-center rounded-lg border px-2 py-1 text-[11px] font-semibold text-white shadow-[0_1px_6px_rgba(15,42,29,0.10)] sm:left-2.5 sm:right-2.5"
                  role="button"
                  tabIndex={0}
                  aria-label={`Rediger tidsblok ${formatHour(entry.startHour)} – ${formatHour(entry.endHour)} (${entry.project})`}
                  onClick={() => openDraftForEntry(entry)}
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    {showProject && (
                      <span className="max-w-[10rem] truncate text-[11px] font-bold leading-none">
                        {entry.project}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Bottom sheet */}
      {sheetOpen && draft && (
        <div className="fixed inset-0 z-[200] flex items-end">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            aria-label="Luk"
            onClick={cancelDraft}
          />

          <div className="relative w-full rounded-t-[1.5rem] bg-white/95 px-4 pb-6 pt-4 shadow-[0_-20px_60px_-40px_rgba(15,42,29,0.35)] ring-1 ring-forest-deep/[0.05] sm:px-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line-soft/70" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-forest">
                  {draft.id ? "Rediger tidsregistrering" : "Ny tidsregistrering"}
                </div>
                <div className="mt-0.5 text-[12px] font-medium text-evergreen/70">
                  {formatHour(draft.startHour)} – {formatHour(draft.endHour)}
                </div>
              </div>

              <button
                type="button"
                onClick={cancelDraft}
                className="rounded-xl px-2 py-2 text-evergreen/70 transition-colors hover:bg-pastel/35 hover:text-evergreen/95"
                aria-label="Annuller"
              >
                <span className="text-[18px] leading-none">×</span>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Start time (15-minute increments) */}
              <label className="block">
                <div className="mb-1 text-[12px] font-semibold text-forest">
                  Starter kl.
                </div>
                {(() => {
                  const startOptions: number[] = [];
                  const dayStartMinutes = DAY_START * 60;
                  const dayEndMinutes = dayEnd * 60;

                  // End must be at least +15 minutes, so limit the last selectable start.
                  for (let m = dayStartMinutes; m <= dayEndMinutes - 15; m += 15) {
                    startOptions.push(m / 60);
                  }

                  return (
                    <select
                      value={draft.startHour}
                      onChange={(e) => {
                        const nextStartHour = Number(e.target.value);
                        const snappedStart = snapToQuarterHour(nextStartHour);

                        setDraft((d) => {
                          if (!d) return d;

                          const minEnd = snappedStart + 0.25;
                          const nextEnd = d.endHour < minEnd ? minEnd : d.endHour;
                          const clampedEnd = Math.min(nextEnd, dayEnd);

                          // Ensure end > start.
                          const finalEnd =
                            clampedEnd <= snappedStart
                              ? Math.min(snappedStart + 0.25, dayEnd)
                              : clampedEnd;

                          return {
                            ...d,
                            startHour: snappedStart,
                            endHour: finalEnd,
                          };
                        });
                      }}
                      className="w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
                    >
                      {startOptions.map((h) => (
                        <option key={h} value={h}>
                          {formatHour(h)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </label>

              {/* End time (15-minute increments) */}
              <label className="block">
                <div className="mb-1 text-[12px] font-semibold text-forest">
                  Slutter kl.
                </div>
                {(() => {
                  const startTotalMinutes = Math.round(draft.startHour * 60);
                  const snappedStartMinutes =
                    Math.round(startTotalMinutes / 15) * 15;

                  const dayEndMinutes = dayEnd * 60;
                  const endOptions: number[] = [];
                  for (
                    let m = snappedStartMinutes + 15;
                    m <= dayEndMinutes;
                    m += 15
                  ) {
                    endOptions.push(m / 60);
                  }

                  return (
                    <select
                      value={draft.endHour}
                      onChange={(e) => {
                        const nextEndHour = Number(e.target.value);
                        setDraft((d) => (d ? { ...d, endHour: nextEndHour } : d));
                      }}
                      className="w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
                    >
                      {endOptions.map((h) => (
                        <option key={h} value={h}>
                          {formatHour(h)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </label>

              <label className="block">
                <div className="mb-1 text-[12px] font-semibold text-forest">
                  Projekt
                </div>
                <select
                  value={draft.project}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? { ...d, project: e.target.value as Draft["project"] }
                        : d
                    )
                  }
                  className="w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
                >
                  {PROJECTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-[12px] font-semibold text-forest">
                  Lokation
                </div>
                <select
                  value={draft.location}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? { ...d, location: e.target.value as Draft["location"] }
                        : d
                    )
                  }
                  className="w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
                >
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-[12px] font-semibold text-forest">
                  Note (valgfri)
                </div>
                <input
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, note: e.target.value } : d))
                  }
                  placeholder="fx fokus på øvelser"
                  className="w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={cancelDraft}
                className="flex-1 rounded-xl border border-line-soft/75 bg-white px-3 py-2 text-[14px] font-semibold text-forest transition-colors hover:bg-pastel/25"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="flex-1 rounded-xl bg-accent px-3 py-2 text-[14px] font-semibold text-white shadow-[0_12px_30px_-18px_rgba(76,167,113,0.75)] transition-colors hover:bg-accent-mid"
              >
                Gem
              </button>
            </div>

            {/* Edit-only: delete existing entry */}
            {draft.id && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={deleteDraft}
                  className="w-full rounded-xl border border-evergreen/20 bg-white px-3 py-2 text-[14px] font-semibold text-evergreen/90 transition-colors hover:bg-rose-500/10 hover:text-rose-700"
                >
                  Slet
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
