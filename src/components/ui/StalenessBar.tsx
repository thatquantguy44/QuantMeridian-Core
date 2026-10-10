import { classifyFreshness } from "@/lib/provenance";

export function StalenessBar({ asOf, threshold = 7 }: { asOf: string | null | undefined; threshold?: number }) {
  if (!asOf) return null;
  const fresh = classifyFreshness(asOf);
  if (fresh.status !== "STALE" || (fresh.ageDays ?? 0) < threshold) return null;
  return (
    <div className="flex items-center gap-2 border-b border-term-down/30 bg-term-down/10 px-3 py-1 text-2xs text-term-down">
      <span className="h-1.5 w-1.5 rounded-full bg-term-down" />
      <span>Data is {fresh.ageDays}d stale (as of {asOf}) — run pipeline to refresh</span>
    </div>
  );
}
