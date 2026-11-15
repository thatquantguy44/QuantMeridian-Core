import { GROUPING_LABELS, type AnalysisResult, type GroupingDimension, type PoliticalParty, type ResearchDataset, type WindowResult } from "@/lib/presidential/contracts";

const colors = { background: "#FFFFFF", text: "#34414D", grid: "#D5DCE3", blue: "#1769A6", amber: "#9B5E00", positive: "#168350", negative: "#BB3348", neutral: "#5C6B78" };
const categoryOrder: Record<GroupingDimension, string[]> = {
  POLITICAL_CONFIGURATION: ["D president · D Congress", "D president · R Congress", "D president · Split Congress", "R president · D Congress", "R president · R Congress", "R president · Split Congress", "UNCLASSIFIED"],
  PRESIDENT_PARTY: ["D president", "R president", "OTHER president", "TIED president", "UNKNOWN president", "UNCLASSIFIED president"],
  HOUSE_CONTROL: ["D House", "R House", "OTHER House", "TIED House", "UNKNOWN House", "UNCLASSIFIED House"],
  SENATE_CONTROL: ["D Senate", "R Senate", "OTHER Senate", "TIED Senate", "UNKNOWN Senate", "UNCLASSIFIED Senate"],
  GOVERNMENT_STRUCTURE: ["Unified D government", "Unified R government", "Divided government", "UNCLASSIFIED government"],
};

function labelsFor(result: AnalysisResult): string[] {
  const observed = new Set(result.groups.map(group => group.category));
  const preferred = categoryOrder[result.config.grouping].filter(label => observed.has(label));
  const additional = result.groups.map(group => group.category).filter(label => !preferred.includes(label));
  return [...preferred, ...additional];
}

function labelLines(value: string): [string, string] {
  const divided = value.split(" · ");
  if (divided.length > 1) return [divided[0], divided.slice(1).join(" · ")];
  const words = value.split(" ");
  if (value.length > 17 && words.length > 1) return [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")];
  return [value, ""];
}
export function pct(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const sign = value >= 0 ? "+" : "";
  const percent = value * 100;
  if (Number.isFinite(percent)) return `${sign}${Math.abs(percent) >= 1e6 || (percent !== 0 && Math.abs(percent) < 0.001) ? percent.toExponential(digits) : percent.toFixed(digits)}%`;
  // Decimal -> percent shifts the exponent; multiplying can overflow even
  // though the supplied decimal return is a finite, representable number.
  const [mantissa, exponent] = value.toExponential(digits).split("e");
  return `${sign}${mantissa}e+${Number(exponent) + 2}%`;
}

/** Pad and project in normalized space, never by subtracting opposite extremes. */
function chartDomain(values: number[], includeZero: boolean, padding: number, anchorZero = false) {
  let scale = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return null;
    scale = Math.max(scale, Math.abs(value));
  }
  scale ||= 1;
  let low = values.length ? Infinity : 0, high = values.length ? -Infinity : 0;
  for (const value of values) { low = Math.min(low, value / scale); high = Math.max(high, value / scale); }
  if (includeZero) { low = Math.min(0, low); high = Math.max(0, high); }
  const rawLow = low, rawHigh = high;
  const pad = high === low ? 0.1 : (high - low) * padding;
  // Clamp denormalized tick bounds to the representable number range.
  const limit = Number.MAX_VALUE / scale;
  low = Math.max(-limit, low - pad); high = Math.min(limit, high + pad);
  if (anchorZero && rawLow === 0) low = 0;
  if (anchorZero && rawHigh === 0) high = 0;
  if (high === low) high = low + 0.1;
  const unscale = (value: number) => {
    const product = value * scale;
    return Number.isFinite(product) ? product : Math.sign(value) * Number.MAX_VALUE;
  };
  return { position: (value: number) => (value / scale - low) / (high - low), tick: (fraction: number) => unscale(low + (high - low) * fraction) };
}

const axisPct = (value: number) => pct(value).replace(/^\+/, "");
const axisNumber = (value: number) => Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 0.001) ? value.toExponential(1) : value.toFixed(1);

function UnavailableFigure({ title, reason }: { title: string; reason: string }) {
  return <svg role="img" aria-label={title} viewBox="0 0 740 180" width="740" height="180" fontFamily="Arial, sans-serif" className="block h-auto w-full min-w-[480px]">
    <title>{title}</title><desc>{`Figure unavailable. ${reason} No data are sampled. All inputs remain in the run manifest.`}</desc>
    <rect width="740" height="180" fill={colors.background} />
    <text x="28" y="58" fill={colors.text} fontSize="16">Figure unavailable</text>
    <text x="28" y="88" fill={colors.text} fontSize="12">{reason}</text>
    <text x="28" y="116" fill={colors.text} fontSize="12">No data are sampled. All inputs remain in the run manifest.</text>
  </svg>;
}

export function CategoryChart({ result }: { result: AnalysisResult }) {
  const labels = labelsFor(result);
  if (!labels.length) return <UnavailableFigure title="Political-control return comparison" reason="No eligible windows exist for the selected comparison definition." />;
  const groups = labels.map(category => result.groups.find(g => g.category === category));
  const values = groups.flatMap(group => group ? [group.mean, ...(group.interval.lower === null || group.interval.upper === null ? [] : [group.interval.lower, group.interval.upper])] : []);
  const domain = chartDomain(values, true, 0.2, true);
  if (!domain) return <UnavailableFigure title="Political-control return comparison" reason="The supplied summary cannot be represented as a finite chart." />;
  const y = (value: number) => 42 + (1 - domain.position(value)) * 225;
  const zero = y(0);
  const step = 640 / labels.length;
  return <svg role="img" aria-label="Political-control return comparison" viewBox="0 0 760 374" width="760" height="374" fontFamily="Arial, sans-serif" className="block h-auto w-full min-w-[560px]">
    <title>Political-control return comparison</title>
    <desc>{`Arithmetic mean return by ${GROUPING_LABELS[result.config.grouping]} at window origin. Whiskers, when present, show a 95% administration-cluster resampling range for the displayed mean. They are descriptive, not causal confidence intervals. Negative bars extend below the zero line. Counts are windows, not independent experiments.`}</desc>
    <rect width="760" height="374" fill={colors.background} />
    {[0, 1, 2, 3, 4].map(i => {
      const value = domain.tick(i / 4);
      if (Math.abs(y(value) - zero) < 15) return null;
      return <g key={i}><line x1="64" x2="738" y1={y(value)} y2={y(value)} stroke={colors.grid} /><text x="55" y={y(value) + 4} textAnchor="end" fill={colors.text} fontSize={axisPct(value).length > 8 ? 9 : 11}>{axisPct(value)}</text></g>;
    })}
    <line x1="64" x2="738" y1={zero} y2={zero} stroke={colors.text} strokeWidth="1.5" data-testid="return-zero-axis" />
    <text x="55" y={zero + 4} textAnchor="end" fill={colors.text} fontSize="11">0.0%</text>
    {labels.map((category, i) => {
      const group = groups[i], center = 84 + step * (i + 0.5), label = labelLines(category);
      const mean = group?.mean ?? null;
      const intervalUpper = group?.interval.upper ?? mean;
      const intervalLower = group?.interval.lower ?? mean;
      return <g key={category}>
        {mean !== null && <rect data-return={mean} x={center - 27} y={Math.min(zero, y(mean))} width="54" height={Math.abs(zero - y(mean))} fill={mean >= 0 ? colors.positive : colors.negative}><title>{`${category}: ${pct(mean)}, ${group!.count} windows`}</title></rect>}
        {group && group.interval.lower !== null && group.interval.upper !== null && <g data-testid="descriptive-interval"><line x1={center} x2={center} y1={y(group.interval.upper)} y2={y(group.interval.lower)} stroke={colors.text} strokeWidth="1.5" /><line x1={center - 7} x2={center + 7} y1={y(group.interval.upper)} y2={y(group.interval.upper)} stroke={colors.text} strokeWidth="1.5" /><line x1={center - 7} x2={center + 7} y1={y(group.interval.lower)} y2={y(group.interval.lower)} stroke={colors.text} strokeWidth="1.5" /><title>{`${category}: descriptive 95% administration-cluster resampling range ${pct(group.interval.lower)} to ${pct(group.interval.upper)} across ${group.interval.clusterCount} administrations.`}</title></g>}
        <text x={center} y={mean === null ? zero - 10 : mean >= 0 ? Math.min(y(mean), y(intervalUpper!)) - 8 : Math.max(y(mean), y(intervalLower!)) + 15} fill={colors.text} fontSize="12" textAnchor="middle">{mean === null ? "No data" : pct(mean)}</text>
        <text x={center} y="295" fill={colors.text} fontSize="11" textAnchor="middle">{label[0]}</text>
        <text x={center} y="311" fill={colors.text} fontSize="11" textAnchor="middle">{label[1]}</text>
        <text x={center} y="332" fill={colors.text} fontSize="11" textAnchor="middle">n = {group?.count ?? 0}</text>
        <text x={center} y="348" fill={colors.text} fontSize="10" textAnchor="middle">{group?.administrationCount ?? 0} {group?.administrationCount === 1 ? "administration" : "administrations"}</text>
      </g>;
    })}
    <text x="64" y="18" fill={colors.text} fontSize="12">Mean {result.config.metric === "ANNUALIZED" ? "annualized" : "cumulative"} return · {GROUPING_LABELS[result.config.grouping]} · {result.includedCount} included windows</text>
    <text x="64" y="366" fill={colors.text} fontSize="10">Whiskers: 95% administration-cluster resampling range when at least two administrations are observed.</text>
  </svg>;
}

export function FundamentalScatter({ rows, field, definition }: { rows: WindowResult[]; field: "valuation" | "policyRatePct"; definition?: string }) {
  const data = rows.filter(row => row.included && row.value !== null && row[field] !== null && (field !== "valuation" || row.valuationDefinition === definition));
  const title = field === "valuation" ? "Starting valuation and subsequent return" : "Starting policy rate and subsequent return";
  const xLabel = field === "valuation" ? definition ?? "Starting valuation" : "Starting policy rate (%)";
  if (data.length > 2000) return <UnavailableFigure title={title} reason="This view exceeds the 2,000-observation figure limit." />;
  const xDomain = chartDomain(data.map(row => row[field]!), false, 0.1);
  const yDomain = chartDomain(data.map(row => row.value!), true, 0.15);
  if (!xDomain || !yDomain) return <UnavailableFigure title={title} reason="The supplied values cannot be represented as a finite chart." />;
  const x = (value: number) => 74 + xDomain.position(value) * 590;
  const y = (value: number) => 38 + (1 - yDomain.position(value)) * 220;
  return <svg role="img" aria-label={title} viewBox="0 0 740 338" width="740" height="338" fontFamily="Arial, sans-serif" className="block h-auto w-full min-w-[480px]">
    <title>{title}</title><desc>Descriptive scatter of included windows with dated inputs available at origin. No fitted model, significance or causal effect is estimated.</desc>
    <rect width="740" height="338" fill={colors.background} />
    {!data.length ? <text x="370" y="130" fill={colors.text} fontSize="14" textAnchor="middle">No eligible at-origin observations</text> : <>
      {[0, 1, 2, 3, 4].map(i => {
        const xv = xDomain.tick(i / 4), yv = yDomain.tick(i / 4);
        return <g key={i}>{Math.abs(y(yv) - y(0)) >= 15 && <><line x1="74" x2="664" y1={y(yv)} y2={y(yv)} stroke={colors.grid} /><text x="62" y={y(yv) + 4} fill={colors.text} fontSize="11" textAnchor="end">{axisPct(yv)}</text></>}<text x={x(xv)} y="282" fill={colors.text} fontSize="11" textAnchor="middle">{axisNumber(xv)}</text></g>;
      })}
      <line x1="74" x2="664" y1={y(0)} y2={y(0)} stroke={colors.text} />
      <text x="62" y={y(0) + 4} fill={colors.text} fontSize="11" textAnchor="end">0.0%</text>
      {data.map(row => <g key={row.id}><circle cx={x(row[field]!)} cy={y(row.value!)} r="5" fill={row.category.startsWith("D president") ? colors.blue : row.category.startsWith("R president") ? colors.amber : colors.neutral}><title>{`${row.label}: ${xLabel} ${row[field]}, return ${pct(row.value)}; ${row.category}; source ${row.fundamentalSourceId}`}</title></circle>{data.length <= 16 && <text x={Math.min(590, x(row[field]!) + 8)} y={Math.max(39, y(row.value!) - 7)} fill={colors.text} fontSize="10">{row.label.length > 12 ? `${row.label.slice(0, 11)}…` : row.label}</text>}</g>)}
    </>}
    <text x="370" y="306" fill={colors.text} fontSize="12" textAnchor="middle">{xLabel}</text>
    <text x="74" y="18" fill={colors.text} fontSize="12">Return (%) · eligible observations n = {data.length}</text>
    <text x="74" y="329" fill={colors.text} fontSize="11">Blue: D president · Amber: R president · Gray: other/unknown</text>
  </svg>;
}

const partyColor = (party: PoliticalParty) => party === "D" ? colors.blue : party === "R" ? colors.amber : colors.neutral;
export function PoliticalTimeline({ dataset }: { dataset: ResearchDataset }) {
  if (dataset.controls.length > 2000) return <UnavailableFigure title="Political control timeline" reason="This view exceeds the 2,000-interval figure limit." />;
  const intervals = [...dataset.controls].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const date = (value: string) => Date.parse(`${value}T00:00:00Z`);
  let start = Infinity, end = -Infinity;
  for (const row of intervals) { start = Math.min(start, date(row.startDate)); end = Math.max(end, date(row.endDate)); }
  const x = (value: number) => 100 + (value - start) / Math.max(1, end - start) * 600;
  const bands = [{ field: "presidentParty", label: "President" }, { field: "houseControl", label: "House" }, { field: "senateControl", label: "Senate" }] as const;
  return <svg role="img" aria-label="Political control timeline" viewBox="0 0 740 232" width="740" height="232" fontFamily="Arial, sans-serif" className="block h-auto w-full min-w-[520px]">
    <title>Political control timeline</title><desc>Normalized intervals for president, House and Senate. Interval end dates are exclusive. Gaps remain blank. All labels are supplied data.</desc>
    <rect width="740" height="232" fill={colors.background} />
    {!intervals.length ? <text x="370" y="100" fill={colors.text} textAnchor="middle">No political-control intervals supplied</text> : <>
      {bands.map((band, bandIndex) => <g key={band.field}><text x="90" y={52 + bandIndex * 41} textAnchor="end" fill={colors.text} fontSize="12">{band.label}</text>
        {intervals.map(row => {
          const width = x(date(row.endDate)) - x(date(row.startDate));
          return <g key={row.id}><rect x={x(date(row.startDate))} y={34 + bandIndex * 41} width={width} height="29" fill={partyColor(row[band.field])} stroke={colors.background}><title>{`${row.presidentName}; ${band.label}: ${row[band.field]}; ${row.startDate} to ${row.endDate} exclusive; source ${row.sourceId}`}</title></rect>{width > 22 && <text x={x(date(row.startDate)) + width / 2} y={53 + bandIndex * 41} fill={colors.background} fontSize="11" textAnchor="middle">{row[band.field]}</text>}</g>;
        })}
      </g>)}
      {[0, 1, 2, 3, 4].map(i => { const t = start + (end - start) * i / 4; return <text key={i} x={x(t)} y="173" fill={colors.text} fontSize="11" textAnchor="middle">{new Date(t).toISOString().slice(0, 10)}</text>; })}
    </>}
    <text x="100" y="204" fill={colors.text} fontSize="11">D = Democratic · R = Republican · Gray = other / tied / unknown</text>
    <text x="100" y="222" fill={colors.text} fontSize="11">Supplied control intervals · blank spans indicate missing coverage</text>
  </svg>;
}
