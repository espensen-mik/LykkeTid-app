import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  children?: ReactNode;
};

export function AdminKpiCard({ label, value, helper, icon: Icon, children }: Props) {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,42,29,0.1)] ring-1 ring-black/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in srgb, #C0E6BA 28%, white)" }}
        >
          <Icon className="h-5 w-5 text-[#0F2A1D]" strokeWidth={2} aria-hidden />
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#0F2A1D]/50">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-[#0F2A1D]">{value}</p>
      {helper ? <p className="mt-2 text-sm text-[#0F2A1D]/55">{helper}</p> : null}
      {children}
    </article>
  );
}
