import { Clock3, TrendingUp, Users, WalletCards } from "lucide-react";
import type { Profile } from "../../admin-types";
import { AdminKpiCard } from "../../_components/admin-kpi";
import { formatHours, getInitials } from "../../admin-utils";

type Props = {
  students: readonly Profile[];
  hoursThisMonth: number;
  hoursThisWeek: number;
};

export function TimeansatteSummaryCards({ students, hoursThisMonth, hoursThisWeek }: Props) {
  const count = students.length;
  const avgThisMonth = count > 0 ? hoursThisMonth / count : 0;
  const preview = students.slice(0, 8);

  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <AdminKpiCard label="Timeansatte" value={String(count)} icon={Users}>
        {preview.length > 0 ? (
          <div className="mt-4 flex items-center pl-0.5">
            <div className="flex items-center -space-x-2.5">
              {preview.map((s, i) => {
                const name = s.full_name?.trim() || s.title?.trim() || "?";
                const url = s.avatar_url?.trim() || null;
                return (
                  <span
                    key={s.id}
                    className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,#C0E6BA_35%,white)] text-[10px] font-semibold text-[#0F2A1D] ring-2 ring-white"
                    style={{ zIndex: preview.length - i }}
                    title={name}
                  >
                    {url ? (
                      <span
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${url}")` }}
                        aria-hidden
                      />
                    ) : (
                      getInitials(name)
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#0F2A1D]/50">Ingen studerende registreret.</p>
        )}
      </AdminKpiCard>

      <AdminKpiCard
        label="Timer denne måned"
        value={`${formatHours(hoursThisMonth)} t`}
        icon={WalletCards}
      />

      <AdminKpiCard
        label="Timer denne uge"
        value={`${formatHours(hoursThisWeek)} t`}
        icon={Clock3}
      />

      <AdminKpiCard
        label="Gennemsnit pr. student denne måned"
        value={`${formatHours(avgThisMonth)} t`}
        icon={TrendingUp}
        helper={count > 0 ? `Baseret på ${count} studerende` : undefined}
      />
    </section>
  );
}
