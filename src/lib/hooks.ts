
import { useEffect, useRef, useState } from "react";

/** Mounted flag — guards client-only rendering to avoid hydration mismatches. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** A ticking clock; updates every `ms`. Returns null until mounted. */
export function useClock(ms = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Streaming tick: returns a monotonically increasing counter every `ms`.
 * Components derive "live" jitter from it (price flicker, fill rates, etc.)
 * without each owning a timer.
 */
export function useTick(ms = 2000): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

/** Tracks previous value — used to flash up/down on data cells. */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
