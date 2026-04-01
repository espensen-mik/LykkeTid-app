"use client";

import type { ReportRange } from "../admin-types";

type Props = {
  value: ReportRange;
  onChange: (next: ReportRange) => void;
};

const OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: "week", label: "Uge" },
  { value: "month", label: "Måned" },
  { value: "3months", label: "3 mdr" },
  { value: "12months", label: "12 mdr" },
];

export function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            value === option.value
              ? "bg-[#0F2A1D] text-white shadow-sm"
              : "bg-[#F8FAF9] text-[#0F2A1D]/80 ring-1 ring-black/[0.06] hover:bg-black/[0.04]",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
