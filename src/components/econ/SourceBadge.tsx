
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import type { DataSource } from "@/lib/useEcon";

/**
 * Econ data-provenance pill. Thin wrapper over the canonical {@link ProvenanceBadge}
 * so econ panels share one vocabulary with the rest of the terminal. The econ
 * `DataSource` codes (FRED | SIM | ETL | LOADING) are a subset of the canonical
 * provenance vocabulary, so they pass straight through.
 */
export function SourceBadge({ source, className }: { source: DataSource; className?: string }) {
  return <ProvenanceBadge source={source} className={className} />;
}
