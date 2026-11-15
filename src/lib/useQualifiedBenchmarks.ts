import { useCallback, useEffect, useRef, useState } from "react";
import { fetchQualifiedBenchmarks, type QualifiedBenchmarkResponse } from "@/lib/benchmarkQualified";

type State = { source: "LOADING" | "DB" | "ERR"; data: QualifiedBenchmarkResponse | null; error: string | null };

/** Every load and retry checks the source again; previous results are cleared immediately. */
export function useQualifiedBenchmarks(): State & { refresh: () => void } {
  const [revision, setRevision] = useState(0);
  const requestGeneration = useRef(0);
  const [state, setState] = useState<State>({ source: "LOADING", data: null, error: null });
  const refresh = useCallback(() => {
    requestGeneration.current += 1;
    setState({ source: "LOADING", data: null, error: null });
    setRevision((n) => n + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    setState({ source: "LOADING", data: null, error: null });
    fetchQualifiedBenchmarks(controller.signal).then((data) => {
      if (!controller.signal.aborted && requestGeneration.current === generation) setState({ source: data.source, data, error: data.source === "ERR" ? data.error ?? "No source-qualified benchmark history is available." : null });
    }).catch((error) => {
      if (!controller.signal.aborted && requestGeneration.current === generation) setState({ source: "ERR", data: null, error: error instanceof Error ? error.message : "Benchmark history unavailable." });
    });
    return () => controller.abort();
  }, [revision]);
  return { ...state, refresh };
}
