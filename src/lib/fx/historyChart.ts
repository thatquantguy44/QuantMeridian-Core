export interface HistoryChartPoint { observationDate: string; displayLevel: number | null }

/** Calendar-spaced coordinates in [0,1], with separate segments across gaps. */
export function historyGeometry(points: readonly HistoryChartPoint[]) {
  const dated = points.map(p => {
    const ms = Date.parse(`${p.observationDate}T00:00:00Z`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(p.observationDate) && Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === p.observationDate;
    return { ...p, ms: validDate ? ms : NaN };
  });
  const dates = dated.filter(p => Number.isFinite(p.ms)).map(p => p.ms);
  const first = dates.length ? Math.min(...dates) : null;
  const last = dates.length ? Math.max(...dates) : null;
  const valid = dated.filter(p => Number.isFinite(p.ms) && p.displayLevel !== null && Number.isFinite(p.displayLevel) && p.displayLevel > 0);
  const min = valid.length ? Math.min(...valid.map(p => p.displayLevel!)) : null;
  const max = valid.length ? Math.max(...valid.map(p => p.displayLevel!)) : null;
  const segments: { x: number; y: number; value: number; date: string }[][] = [];
  let segment: typeof segments[number] = [];
  let previous = -Infinity;
  for (const p of dated) {
    if (!valid.includes(p)) { if (segment.length) segments.push(segment); segment = []; previous = -Infinity; continue; }
    if (p.ms <= previous && segment.length) { segments.push(segment); segment = []; }
    segment.push({ x: first === last ? .5 : (p.ms - first!) / (last! - first!),
      y: min === max ? .5 : (max! - p.displayLevel!) / (max! - min!), value: p.displayLevel!, date: p.observationDate });
    previous = p.ms;
  }
  if (segment.length) segments.push(segment);
  return { segments, gapCount: points.length - valid.length, min, max,
    firstDate: first === null ? null : new Date(first).toISOString().slice(0, 10),
    lastDate: last === null ? null : new Date(last).toISOString().slice(0, 10) };
}
