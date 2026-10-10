/** Number / currency / date formatting helpers used across the terminal. */

export function fmtNum(n: number, dp = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtInt(n: number): string {
  if (!isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** Compact magnitude: 1.2K / 3.4M / 5.6B / 7.8T */
export function fmtAbbr(n: number, dp = 1): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(dp)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(dp)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(dp)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(dp)}K`;
  return `${sign}${abs.toFixed(dp)}`;
}

export function fmtUsd(n: number, dp = 2): string {
  return `$${fmtNum(n, dp)}`;
}

export function fmtUsdAbbr(n: number, dp = 1): string {
  const sign = n < 0 ? "-$" : "$";
  return `${sign}${fmtAbbr(Math.abs(n), dp)}`;
}

export function fmtPct(n: number, dp = 2): string {
  if (!isFinite(n)) return "—";
  return `${n >= 0 ? "" : ""}${n.toFixed(dp)}%`;
}

export function fmtSignedPct(n: number, dp = 2): string {
  if (!isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

export function fmtBps(n: number, dp = 0): string {
  return `${n >= 0 ? "" : ""}${n.toFixed(dp)} bps`;
}

export function fmtSigned(n: number, dp = 2): string {
  return `${n >= 0 ? "+" : ""}${fmtNum(n, dp)}`;
}

/** P&L / change colour class. */
export function pnlClass(n: number): string {
  if (n > 0) return "text-term-up";
  if (n < 0) return "text-term-down";
  return "text-term-flat";
}

export function pnlBg(n: number): string {
  if (n > 0) return "bg-term-up/10 text-term-up";
  if (n < 0) return "bg-term-down/10 text-term-down";
  return "bg-term-panel-3 text-term-flat";
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function fmtClock(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0").slice(0, 2);
}

/** Map a value in [0,1] to a heat colour (amber→green positive scale variant). */
export function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  // dark -> amber -> bright
  const r = Math.round(20 + c * 235);
  const g = Math.round(15 + c * 125);
  const b = Math.round(10 + c * 5);
  return `rgb(${r},${g},${b})`;
}

/** Diverging red→neutral→green scale for P&L heat surfaces. */
export function divergeColor(v: number, max: number): string {
  const t = Math.max(-1, Math.min(1, v / (max || 1)));
  if (t >= 0) {
    const a = 0.12 + t * 0.55;
    return `rgba(46,204,113,${a.toFixed(3)})`;
  }
  const a = 0.12 + -t * 0.55;
  return `rgba(255,59,59,${a.toFixed(3)})`;
}
