import { Rng } from "@/lib/rng";

export const DATA_SOURCE = "SIM" as const;

/** Macro regime to desk playbook analytics. */

export type RegimeState = "EASING" | "TIGHTENING" | "RISK_ON" | "RISK_OFF" | "STAGFLATION" | "RECESSION_WATCH";
export type NamedRegime = "Goldilocks" | "Reflation" | "Stagflation" | "Growth Scare" | "Liquidity Squeeze" | "Policy Easing";
export type Desk = "SLAB" | "COLL" | "CASH" | "REINV" | "LIQ" | "OPT";
export type CrossDesk = "Repo" | "Agency" | "Prime" | "E-Trading" | "Financing" | "Treasury";

export interface RegimeSummary {
  state: RegimeState;
  probability: number;
  riskScore: number;
  growthScore: number;
  inflationScore: number;
  liquidityScore: number;
  policyBias: "DOVISH" | "NEUTRAL" | "HAWKISH";
  activePlaybooks: number;
}

export interface RegimeFactor {
  factor: string;
  source: "FRED" | "YAHOO" | "LOCAL";
  value: number;
  zScore: number;
  signal: "SUPPORTS" | "CONFLICTS" | "NEUTRAL";
  weight: number;
  stateLink: RegimeState;
}

export interface DeskPlaybook {
  desk: Desk;
  action: string;
  rationale: string;
  urgency: "HIGH" | "MED" | "LOW";
  expectedImpact: number;
  linkedFactor: string;
}

export interface RegimeTransition {
  from: RegimeState;
  to: RegimeState;
  probability: number;
  trigger: string;
}

export interface RegimeExposure {
  desk: Desk;
  carryImpact: number;
  marginImpact: number;
  liquidityImpact: number;
  recommendedBias: "ADD_RISK" | "HOLD" | "DEFEND";
}

export function getRegimeSummary(): RegimeSummary {
  return {
    state: "EASING",
    probability: 64,
    riskScore: 58,
    growthScore: 46,
    inflationScore: 52,
    liquidityScore: 61,
    policyBias: "DOVISH",
    activePlaybooks: 8,
  };
}

export function getRegimeFactors(): RegimeFactor[] {
  return [
    { factor: "2s10s curve slope", source: "FRED", value: -32, zScore: -1.4, signal: "SUPPORTS", weight: 16, stateLink: "EASING" },
    { factor: "3m10y curve slope", source: "FRED", value: -78, zScore: -1.8, signal: "SUPPORTS", weight: 15, stateLink: "RECESSION_WATCH" },
    { factor: "Core PCE momentum", source: "FRED", value: 2.7, zScore: 0.4, signal: "NEUTRAL", weight: 11, stateLink: "STAGFLATION" },
    { factor: "HY OAS level", source: "FRED", value: 382, zScore: 0.7, signal: "CONFLICTS", weight: 13, stateLink: "RISK_OFF" },
    { factor: "Equity drawdown proxy", source: "YAHOO", value: -4.1, zScore: -0.5, signal: "NEUTRAL", weight: 10, stateLink: "RISK_OFF" },
    { factor: "HYG/LQD relative return", source: "YAHOO", value: -1.2, zScore: -0.8, signal: "SUPPORTS", weight: 8, stateLink: "RISK_OFF" },
    { factor: "SOFR-EFFR spread", source: "FRED", value: 14, zScore: 1.1, signal: "SUPPORTS", weight: 9, stateLink: "TIGHTENING" },
    { factor: "Internal funding buffer", source: "LOCAL", value: 18.6, zScore: 0.9, signal: "SUPPORTS", weight: 18, stateLink: "EASING" },
  ];
}

export type LiveRegimeData = Record<string, { observations: { date: string; value: number }[]; source: string }>;

export const REGIME_FRED_IDS = ["DGS10", "DGS2", "DGS3MO", "BAMLH0A0HYM2", "SOFR", "EFFR", "CPILFESL"] as const;

export function mergeLiveRegimeFactors(factors: RegimeFactor[], fred: LiveRegimeData): RegimeFactor[] {
  const last = (id: string) => {
    const obs = fred[id]?.observations;
    return obs?.length ? obs[obs.length - 1].value : null;
  };
  const zOf = (id: string) => {
    const obs = fred[id]?.observations;
    if (!obs || obs.length < 10) return null;
    const vals = obs.map((o) => o.value);
    const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
    return (vals[vals.length - 1] - mean) / std;
  };

  return factors.map((f) => {
    if (f.factor === "2s10s curve slope") {
      const t10 = last("DGS10");
      const t2 = last("DGS2");
      if (t10 != null && t2 != null) {
        const bps = Math.round((t10 - t2) * 100);
        const z = zOf("DGS10") ?? f.zScore;
        return { ...f, value: bps, zScore: Math.round(z * 100) / 100, signal: Math.abs(z) > 1 ? "SUPPORTS" : Math.abs(z) > 0.5 ? "NEUTRAL" : "CONFLICTS" };
      }
    }
    if (f.factor === "3m10y curve slope") {
      const t10 = last("DGS10");
      const t3m = last("DGS3MO");
      if (t10 != null && t3m != null) {
        const bps = Math.round((t10 - t3m) * 100);
        const z = zOf("DGS3MO") ?? f.zScore;
        return { ...f, value: bps, zScore: Math.round(z * 100) / 100, signal: bps < -50 ? "SUPPORTS" : "NEUTRAL" };
      }
    }
    if (f.factor === "Core PCE momentum") {
      const v = last("CPILFESL");
      if (v != null) {
        const z = zOf("CPILFESL") ?? f.zScore;
        return { ...f, value: Math.round(v * 10) / 10, zScore: Math.round(z * 100) / 100, signal: v > 3 ? "SUPPORTS" : v > 2.5 ? "NEUTRAL" : "CONFLICTS" };
      }
    }
    if (f.factor === "HY OAS level") {
      const v = last("BAMLH0A0HYM2");
      if (v != null) {
        const bps = Math.round(v * 100);
        const z = zOf("BAMLH0A0HYM2") ?? f.zScore;
        return { ...f, value: bps, zScore: Math.round(z * 100) / 100, signal: bps > 400 ? "SUPPORTS" : bps > 300 ? "NEUTRAL" : "CONFLICTS" };
      }
    }
    if (f.factor === "SOFR-EFFR spread") {
      const sofr = last("SOFR");
      const effr = last("EFFR");
      if (sofr != null && effr != null) {
        const bps = Math.round((sofr - effr) * 100);
        return { ...f, value: bps, signal: bps > 15 ? "SUPPORTS" : bps > 5 ? "NEUTRAL" : "CONFLICTS" };
      }
    }
    return f;
  });
}

export function computeLiveRegimeSummary(factors: RegimeFactor[]): RegimeSummary {
  const weighted = factors.reduce((a, f) => a + f.zScore * f.weight, 0) / factors.reduce((a, f) => a + f.weight, 0);
  const easing = factors.filter((f) => f.stateLink === "EASING" && f.signal === "SUPPORTS").length;
  const riskOff = factors.filter((f) => f.stateLink === "RISK_OFF" && f.signal === "SUPPORTS").length;
  const recession = factors.filter((f) => f.stateLink === "RECESSION_WATCH" && f.signal === "SUPPORTS").length;

  let state: RegimeState = "EASING";
  if (recession >= 2) state = "RECESSION_WATCH";
  else if (riskOff >= 2) state = "RISK_OFF";
  else if (weighted > 0.8) state = "TIGHTENING";
  else if (weighted < -0.8 && easing >= 2) state = "EASING";

  const riskScore = Math.round(50 + weighted * 15);
  return {
    state,
    probability: Math.round(60 + weighted * 8),
    riskScore: Math.max(0, Math.min(100, riskScore)),
    growthScore: Math.round(46 + (factors.find((f) => f.factor === "3m10y curve slope")?.zScore ?? 0) * 8),
    inflationScore: Math.round(52 + (factors.find((f) => f.factor === "Core PCE momentum")?.zScore ?? 0) * 10),
    liquidityScore: Math.round(61 + (factors.find((f) => f.factor === "SOFR-EFFR spread")?.zScore ?? 0) * 6),
    policyBias: weighted < -0.3 ? "DOVISH" : weighted > 0.3 ? "HAWKISH" : "NEUTRAL",
    activePlaybooks: factors.filter((f) => f.signal === "SUPPORTS").length + 2,
  };
}

export function getDeskPlaybooks(): DeskPlaybook[] {
  return [
    {
      desk: "REINV",
      action: "Shorten reset profile and keep T+0 liquidity above 40%.",
      rationale: "Easing path reduces cash collateral carry; protect reinvestment spread with faster resets.",
      urgency: "HIGH",
      expectedImpact: 2.8e6,
      linkedFactor: "2s10s curve slope",
    },
    {
      desk: "SLAB",
      action: "Raise review priority for specials with high recall value.",
      rationale: "Risk-off transition probability is rising, which can lift borrow demand but increase recall risk.",
      urgency: "MED",
      expectedImpact: 1.9e6,
      linkedFactor: "HYG/LQD relative return",
    },
    {
      desk: "COLL",
      action: "Favor HQLA collateral substitutions over HY and equity collateral.",
      rationale: "Credit spread pressure can raise haircut overlays and weaken eligibility breadth.",
      urgency: "HIGH",
      expectedImpact: 3.3e6,
      linkedFactor: "HY OAS level",
    },
    {
      desk: "CASH",
      action: "Keep term repo dry powder for CPI and FOMC event windows.",
      rationale: "Policy repricing can widen funding spreads quickly.",
      urgency: "MED",
      expectedImpact: 1.4e6,
      linkedFactor: "SOFR-EFFR spread",
    },
    {
      desk: "LIQ",
      action: "Run repo squeeze and prime client draw stress before close.",
      rationale: "Liquidity score is positive but early-warning breadth has moved from green to watch.",
      urgency: "HIGH",
      expectedImpact: 2.2e6,
      linkedFactor: "Internal funding buffer",
    },
    {
      desk: "OPT",
      action: "Increase penalty on term liquidity usage in optimization runs.",
      rationale: "Protect scarce collateral and cash optionality while policy path is repricing.",
      urgency: "MED",
      expectedImpact: 2.5e6,
      linkedFactor: "3m10y curve slope",
    },
  ];
}

export function getRegimeTransitions(): RegimeTransition[] {
  return [
    { from: "EASING", to: "RISK_OFF", probability: 28, trigger: "HY OAS widens by 75 bps and equity proxy falls 6%" },
    { from: "EASING", to: "RECESSION_WATCH", probability: 34, trigger: "3m10y inversion persists with claims acceleration" },
    { from: "EASING", to: "RISK_ON", probability: 24, trigger: "Core PCE slows and HY OAS tightens below 325 bps" },
    { from: "EASING", to: "STAGFLATION", probability: 9, trigger: "Inflation momentum re-accelerates while growth score weakens" },
    { from: "EASING", to: "TIGHTENING", probability: 5, trigger: "Policy path reprices higher by 50 bps" },
  ];
}

export function getRegimeExposures(): RegimeExposure[] {
  const rng = new Rng("regime-exposures");
  const desks: Desk[] = ["SLAB", "COLL", "CASH", "REINV", "LIQ", "OPT"];
  return desks.map((desk) => {
    const carryImpact = rng.float(-4.5, 4.8) * 1e6;
    const marginImpact = rng.float(-5.2, 2.4) * 1e6;
    const liquidityImpact = rng.float(-4.8, 3.2) * 1e6;
    const total = carryImpact + marginImpact + liquidityImpact;
    return {
      desk,
      carryImpact,
      marginImpact,
      liquidityImpact,
      recommendedBias: total > 2e6 ? "ADD_RISK" : total < -2e6 ? "DEFEND" : "HOLD",
    };
  });
}

// ── Impulse Scores ──────────────────────────────────────────────────────────

export interface ImpulseScore {
  label: string;
  value: number;
  direction: "Accelerating" | "Stable" | "Decelerating";
  detail: string;
  source: "FRED" | "YAHOO" | "LOCAL";
}

export function getImpulseScores(): ImpulseScore[] {
  return [
    { label: "Growth", value: 46, direction: "Decelerating", detail: "ISM 48.7, GDPNOW 1.8%, payrolls softening", source: "FRED" },
    { label: "Inflation", value: 52, direction: "Stable", detail: "Core PCE 2.7% YoY, shelter sticky, goods disinflating", source: "FRED" },
    { label: "Policy", value: 38, direction: "Decelerating", detail: "Fed on hold, dot-plot dovish tilt, 2 cuts priced", source: "FRED" },
    { label: "Liquidity", value: 61, direction: "Stable", detail: "RRP draining, reserves adequate, QT pace halved", source: "FRED" },
    { label: "Credit", value: 55, direction: "Accelerating", detail: "HY OAS widening, IG stable, leveraged loans soft", source: "FRED" },
    { label: "Risk Appetite", value: 58, direction: "Stable", detail: "VIX sub-18, equity breadth narrowing, flows neutral", source: "YAHOO" },
  ];
}

// ── Named Regime Classification ─────────────────────────────────────────────

export interface NamedRegimeResult {
  regime: NamedRegime;
  probability: number;
  drivers: string;
  history: { regime: NamedRegime; probability: number }[];
}

export function getNamedRegime(): NamedRegimeResult {
  const rng = new Rng("named-regime");
  const regimes: NamedRegime[] = ["Goldilocks", "Reflation", "Stagflation", "Growth Scare", "Liquidity Squeeze", "Policy Easing"];
  const probs = [18, 8, 12, 22, 6, 34];
  const best = probs.indexOf(Math.max(...probs));
  return {
    regime: regimes[best],
    probability: probs[best],
    drivers: "Fed dovish tilt + growth softening = classic late-cycle easing setup. Watch for stagflation risk if inflation re-accelerates.",
    history: regimes.map((r, i) => ({ regime: r, probability: probs[i] })),
  };
}

// ── Cross-Desk Playbooks (Agency/Prime/E-Trading) ───────────────────────────

export interface CrossDeskPlaybook {
  desk: CrossDesk;
  action: string;
  rationale: string;
  urgency: "HIGH" | "MED" | "LOW";
  regime: NamedRegime;
  impactBps: number;
}

export function getCrossDeskPlaybooks(): CrossDeskPlaybook[] {
  const regime = getNamedRegime().regime;
  return [
    {
      desk: "Repo",
      action: regime === "Liquidity Squeeze" ? "Term out aggressively and widen marks." : "Keep GC pricing normal; watch term repo for quarter-end.",
      rationale: "Repo markets tighten first in liquidity stress; proactive terming protects financing continuity.",
      urgency: regime === "Liquidity Squeeze" ? "HIGH" : "MED",
      regime,
      impactBps: regime === "Liquidity Squeeze" ? 15 : 3,
    },
    {
      desk: "Agency",
      action: regime === "Growth Scare" ? "Protect rebate floors and review recall exposure." : "Standard lending economics; monitor specials.",
      rationale: "Growth scares lift borrow demand but increase recall risk and volatility in GC-specials.",
      urgency: regime === "Growth Scare" ? "HIGH" : "LOW",
      regime,
      impactBps: regime === "Growth Scare" ? 8 : 2,
    },
    {
      desk: "Prime",
      action: regime === "Stagflation" ? "Widen financing, review margin sensitivity across HF book." : "Maintain client financing assumptions; watch leverage.",
      rationale: "Stagflation pressures both equity and rates books simultaneously — double margin exposure.",
      urgency: regime === "Stagflation" ? "HIGH" : "MED",
      regime,
      impactBps: regime === "Stagflation" ? 20 : 4,
    },
    {
      desk: "E-Trading",
      action: regime === "Liquidity Squeeze" ? "Reduce aggression, raise slippage assumptions, passive algos only." : "Standard parameters; watch vol ratio.",
      rationale: "Electronic market-making profitability inverts when liquidity evaporates — protect capital.",
      urgency: regime === "Liquidity Squeeze" ? "HIGH" : "LOW",
      regime,
      impactBps: regime === "Liquidity Squeeze" ? 12 : 1,
    },
    {
      desk: "Financing",
      action: regime === "Policy Easing" ? "Lock in term financing at current rates before cuts compress spreads." : "Roll short; capture carry in current rate environment.",
      rationale: "Easing compresses term financing spreads — early movers capture the premium.",
      urgency: regime === "Policy Easing" ? "HIGH" : "MED",
      regime,
      impactBps: regime === "Policy Easing" ? 10 : 3,
    },
    {
      desk: "Treasury",
      action: regime === "Reflation" ? "Shorten duration, increase TIPS allocation." : "Maintain benchmark duration; ladder maturities.",
      rationale: "Reflation erodes real returns on nominal duration — rotate into linkers.",
      urgency: regime === "Reflation" ? "HIGH" : "LOW",
      regime,
      impactBps: regime === "Reflation" ? 18 : 2,
    },
  ];
}
