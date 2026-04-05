import { getInitials } from "../../admin-utils";

type Props = {
  displayName: string;
  title: string | null;
  recentProjectName: string | null;
  avatarUrl: string | null;
};

export function TimeansatteEmployeeCell({
  displayName,
  title,
  recentProjectName,
  avatarUrl,
}: Props) {
  const secondary =
    title && recentProjectName
      ? `${title} · ${recentProjectName}`
      : title || recentProjectName;

  return (
    <div className="flex min-w-[200px] max-w-[260px] items-center gap-3 py-1">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,#C0E6BA_32%,white)] text-xs font-semibold text-[#0F2A1D] ring-1 ring-black/[0.06]">
        {avatarUrl ? (
          <span
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url("${avatarUrl}")` }}
            aria-hidden
          />
        ) : (
          getInitials(displayName)
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[#0F2A1D]">{displayName}</div>
        {secondary ? (
          <div className="truncate text-xs leading-snug text-[#0F2A1D]/48">{secondary}</div>
        ) : null}
      </div>
    </div>
  );
}
