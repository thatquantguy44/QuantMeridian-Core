import { useEffect, useState } from "react";
import type { VixForwardResponse } from "@/app/api/market-volatility/vix-forward/route";
import type { VixForwardBasis } from "@/lib/vixImpliedForward";
import { fetchVixForward } from "@/lib/vixForwardClient";

export type VixForwardUiSource = "LOADING" | "DB" | "ERR";
interface State { basis: VixForwardBasis; data: VixForwardResponse | null; source: VixForwardUiSource; error: string | null }

/** A failed check clears all analytics, including data from the previously selected basis. */
export function useVixForward(basis: VixForwardBasis): Omit<State, "basis"> {
  const [state, setState] = useState<State>({ basis, data: null, source: "LOADING", error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ basis, data: null, source: "LOADING", error: null });
    fetchVixForward(basis, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ basis, data, source: "DB", error: null }); })
      .catch((err) => {
        if (!controller.signal.aborted) setState({ basis, data: null, source: "ERR", error: err instanceof Error ? err.message : "VIXR history unavailable." });
      });
    return () => controller.abort();
  }, [basis]);
  return state.basis === basis ? state : { data: null, source: "LOADING", error: null };
}
