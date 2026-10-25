export type SqueezeSemanticRule =
  | "MARKET_UTILIZATION_PCT"
  | "MARKET_AVAILABLE_QTY"
  | "INTERNAL_ELIGIBLE_QTY"
  | "INTERNAL_AVAILABLE_QTY"
  | "EQUIVALENT_FEE_BPS"
  | "LOAN_RATE_COMPARABILITY"
  | "SHORT_INTEREST_PCT"
  | "SHORT_MEASURE_COMPATIBILITY"
  | "SHORT_SALE_VOLUME_PCT"
  | "DAYS_TO_COVER"
  | "PRICE_RETURN_PCT"
  | "PUT_CALL_RATIO"
  | "OPEN_INTEREST_CHANGE_PCT"
  | "OPTIONS_MEASURE_VALIDITY"
  | "PUBLICATION_ELIGIBILITY";

export type SemanticResult =
  | { status: "VALID"; value: number | boolean }
  | { status: "UNAVAILABLE"; reason_code: string }
  | { status: "INVALID"; reason_code: string };

export interface SemanticTestVector {
  id: string;
  rule: SqueezeSemanticRule;
  input: Record<string, unknown>;
  expected: SemanticResult;
}

export interface SemanticTestVectorCatalog {
  vector_version: string;
  semantics_version: string;
  data_mode: "SIM";
  cases: SemanticTestVector[];
}

type FieldResult<T> = { ok: true; value: T } | { ok: false; result: SemanticResult };
type AnyFieldResult = FieldResult<number> | FieldResult<string> | FieldResult<boolean>;

const valid = (value: number | boolean): SemanticResult => ({ status: "VALID", value });
const unavailable = (reason_code: string): SemanticResult => ({ status: "UNAVAILABLE", reason_code });
const invalid = (reason_code: string): SemanticResult => ({ status: "INVALID", reason_code });
const rounded = (value: number): number => Number(value.toFixed(10));

function numberField(input: Record<string, unknown>, field: string): FieldResult<number> {
  const value = input[field];
  if (value === null || value === undefined) return { ok: false, result: unavailable("MISSING_INPUT") };
  if (typeof value !== "number") return { ok: false, result: invalid("INVALID_NUMERIC_INPUT") };
  if (!Number.isFinite(value)) return { ok: false, result: invalid("NON_FINITE_INPUT") };
  return { ok: true, value };
}

function stringField(input: Record<string, unknown>, field: string): FieldResult<string> {
  const value = input[field];
  if (value === null || value === undefined || value === "") return { ok: false, result: unavailable("MISSING_INPUT") };
  if (typeof value !== "string") return { ok: false, result: invalid("INVALID_TEXT_INPUT") };
  return { ok: true, value };
}

function booleanField(input: Record<string, unknown>, field: string): FieldResult<boolean> {
  const value = input[field];
  if (value === null || value === undefined) return { ok: false, result: unavailable("MISSING_INPUT") };
  if (typeof value !== "boolean") return { ok: false, result: invalid("INVALID_BOOLEAN_INPUT") };
  return { ok: true, value };
}

function firstFailure(...fields: AnyFieldResult[]): SemanticResult | null {
  let unavailableResult: SemanticResult | null = null;
  for (const field of fields) {
    if (field.ok) continue;
    if (field.result.status === "INVALID") return field.result;
    unavailableResult ??= field.result;
  }
  return unavailableResult;
}

function rejectNegativeQuantities(...values: number[]): SemanticResult | null {
  return values.some((value) => value < 0) ? invalid("NEGATIVE_QUANTITY") : null;
}

function marketUtilization(input: Record<string, unknown>): SemanticResult {
  const onLoan = numberField(input, "on_loan_qty");
  const lendable = numberField(input, "lendable_qty");
  const failure = firstFailure(onLoan, lendable);
  if (failure) return failure;
  if (!onLoan.ok || !lendable.ok) return invalid("UNREACHABLE_INPUT_STATE");
  const negative = rejectNegativeQuantities(onLoan.value, lendable.value);
  if (negative) return negative;
  if (lendable.value === 0) return onLoan.value === 0 ? unavailable("ZERO_DENOMINATOR") : invalid("ON_LOAN_EXCEEDS_LENDABLE");
  if (onLoan.value > lendable.value) return invalid("ON_LOAN_EXCEEDS_LENDABLE");
  return valid(rounded(100 * onLoan.value / lendable.value));
}

function reconciledDifference(
  input: Record<string, unknown>,
  minuendField: string,
  subtrahendFields: string[],
  reportedField: string,
  negativeReason: string,
  reconciliationReason: string,
): SemanticResult {
  const minuend = numberField(input, minuendField);
  const subtrahends = subtrahendFields.map((field) => numberField(input, field));
  const reported = numberField(input, reportedField);
  const failure = firstFailure(minuend, ...subtrahends, reported);
  if (failure) return failure;
  if (!minuend.ok || !reported.ok || subtrahends.some((field) => !field.ok)) return invalid("UNREACHABLE_INPUT_STATE");
  const numericSubtrahends = subtrahends.filter((field): field is { ok: true; value: number } => field.ok);
  const negative = rejectNegativeQuantities(minuend.value, ...numericSubtrahends.map((field) => field.value));
  if (negative) return negative;
  const calculated = minuend.value - numericSubtrahends.reduce((sum, field) => sum + field.value, 0);
  if (calculated < 0 || reported.value < 0) return invalid(negativeReason);
  if (reported.value !== calculated) return invalid(reconciliationReason);
  return valid(calculated);
}

function equivalentFee(input: Record<string, unknown>): SemanticResult {
  const quoted = numberField(input, "quoted_bps");
  const convention = stringField(input, "rate_convention");
  const failure = firstFailure(quoted, convention);
  if (failure) return failure;
  if (!quoted.ok || !convention.ok) return invalid("UNREACHABLE_INPUT_STATE");
  if (convention.value === "FEE") return valid(rounded(quoted.value));
  if (convention.value !== "REBATE") return invalid("UNSUPPORTED_RATE_CONVENTION");
  const benchmark = numberField(input, "benchmark_bps");
  if (!benchmark.ok) {
    return benchmark.result.status === "UNAVAILABLE"
      ? unavailable("REBATE_BENCHMARK_REQUIRED")
      : benchmark.result;
  }
  return valid(rounded(benchmark.value - quoted.value));
}

function loanRateComparability(input: Record<string, unknown>): SemanticResult {
  const fieldNames = [
    "left_currency", "right_currency", "left_collateral_type", "right_collateral_type",
    "left_term_type", "right_term_type", "left_rate_convention", "right_rate_convention",
    "left_methodology_version", "right_methodology_version", "left_source_cohort", "right_source_cohort",
    "left_status", "right_status",
  ] as const;
  const fields = Object.fromEntries(fieldNames.map((field) => [field, stringField(input, field)])) as Record<typeof fieldNames[number], FieldResult<string>>;
  const failure = firstFailure(...Object.values(fields));
  if (failure) return failure;
  if (Object.values(fields).some((field) => !field.ok)) return invalid("UNREACHABLE_INPUT_STATE");
  const values = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.ok ? field.value : ""])) as Record<typeof fieldNames[number], string>;
  if (values.left_currency !== values.right_currency) return unavailable("CURRENCY_MISMATCH");
  if (values.left_collateral_type !== values.right_collateral_type) return unavailable("COLLATERAL_MISMATCH");
  if (values.left_term_type !== values.right_term_type) return unavailable("TERM_MISMATCH");
  if (values.left_rate_convention !== values.right_rate_convention) return unavailable("RATE_CONVENTION_MISMATCH");
  if (values.left_methodology_version !== values.right_methodology_version) return unavailable("METHODOLOGY_MISMATCH");
  if (values.left_source_cohort !== values.right_source_cohort) return unavailable("SOURCE_COHORT_MISMATCH");
  if (values.left_status !== "SETTLED" || values.right_status !== "SETTLED") return unavailable("SETTLEMENT_STATUS_INELIGIBLE");
  return valid(true);
}

function shortInterest(input: Record<string, unknown>): SemanticResult {
  const position = numberField(input, "position_qty");
  const basis = stringField(input, "basis");
  const failure = firstFailure(position, basis);
  if (failure) return failure;
  if (!position.ok || !basis.ok) return invalid("UNREACHABLE_INPUT_STATE");
  const denominatorField = basis.value === "FLOAT"
    ? "float_shares"
    : basis.value === "SHARES_OUTSTANDING"
      ? "shares_outstanding"
      : null;
  if (!denominatorField) return invalid("UNSUPPORTED_SHORT_INTEREST_BASIS");
  const denominator = numberField(input, denominatorField);
  if (!denominator.ok) return denominator.result;
  const negative = rejectNegativeQuantities(position.value, denominator.value);
  if (negative) return negative;
  if (denominator.value === 0) return unavailable("ZERO_DENOMINATOR");
  return valid(rounded(100 * position.value / denominator.value));
}

function shortMeasureCompatibility(input: Record<string, unknown>): SemanticResult {
  const measure = stringField(input, "measure_kind");
  const requested = stringField(input, "requested_kind");
  const failure = firstFailure(measure, requested);
  if (failure) return failure;
  if (!measure.ok || !requested.ok) return invalid("UNREACHABLE_INPUT_STATE");
  const supportedKinds = new Set(["OFFICIAL", "ESTIMATED", "SHORT_SALE_VOLUME"]);
  if (!supportedKinds.has(measure.value) || !supportedKinds.has(requested.value)) {
    return invalid("UNSUPPORTED_SHORT_MEASURE_KIND");
  }
  if (measure.value === requested.value) return valid(true);
  if (measure.value === "SHORT_SALE_VOLUME" && requested.value !== "SHORT_SALE_VOLUME") {
    return invalid("SHORT_VOLUME_IS_NOT_POSITION");
  }
  return invalid("MEASURE_KIND_MISMATCH");
}

function shortSaleVolumePct(input: Record<string, unknown>): SemanticResult {
  const shortVolume = numberField(input, "short_volume_qty");
  const shortExemptVolume = numberField(input, "short_exempt_volume_qty");
  const totalVolume = numberField(input, "total_reported_volume_qty");
  const failure = firstFailure(shortVolume, shortExemptVolume, totalVolume);
  if (failure) return failure;
  if (!shortVolume.ok || !shortExemptVolume.ok || !totalVolume.ok) return invalid("UNREACHABLE_INPUT_STATE");
  const negative = rejectNegativeQuantities(shortVolume.value, shortExemptVolume.value, totalVolume.value);
  if (negative) return negative;
  if (shortExemptVolume.value > shortVolume.value) return invalid("SHORT_EXEMPT_EXCEEDS_SHORT_VOLUME");
  if (shortVolume.value > totalVolume.value) return invalid("SHORT_VOLUME_EXCEEDS_TOTAL_VOLUME");
  if (totalVolume.value === 0) return unavailable("ZERO_DENOMINATOR");
  return valid(rounded(100 * shortVolume.value / totalVolume.value));
}

function ratio(input: Record<string, unknown>, numeratorField: string, denominatorField: string): SemanticResult {
  const numerator = numberField(input, numeratorField);
  const denominator = numberField(input, denominatorField);
  const failure = firstFailure(numerator, denominator);
  if (failure) return failure;
  if (!numerator.ok || !denominator.ok) return invalid("UNREACHABLE_INPUT_STATE");
  const negative = rejectNegativeQuantities(numerator.value, denominator.value);
  if (negative) return negative;
  if (denominator.value === 0) return unavailable("ZERO_DENOMINATOR");
  return valid(rounded(numerator.value / denominator.value));
}

function priceReturn(input: Record<string, unknown>): SemanticResult {
  const start = numberField(input, "start_price");
  const end = numberField(input, "end_price");
  const startBasis = stringField(input, "start_basis");
  const endBasis = stringField(input, "end_basis");
  const failure = firstFailure(start, end, startBasis, endBasis);
  if (failure) return failure;
  if (!start.ok || !end.ok || !startBasis.ok || !endBasis.ok) return invalid("UNREACHABLE_INPUT_STATE");
  if (startBasis.value !== endBasis.value) return invalid("PRICE_BASIS_MISMATCH");
  if (!new Set(["RAW", "ADJUSTED"]).has(startBasis.value)) return invalid("UNSUPPORTED_PRICE_BASIS");
  if (start.value <= 0 || end.value < 0) return invalid("NON_POSITIVE_PRICE");
  return valid(rounded(100 * (end.value / start.value - 1)));
}

function openInterestChange(input: Record<string, unknown>): SemanticResult {
  const prior = numberField(input, "prior_open_interest_qty");
  const current = numberField(input, "current_open_interest_qty");
  const failure = firstFailure(prior, current);
  if (failure) return failure;
  if (!prior.ok || !current.ok) return invalid("UNREACHABLE_INPUT_STATE");
  const negative = rejectNegativeQuantities(prior.value, current.value);
  if (negative) return negative;
  if (prior.value === 0) return unavailable("ZERO_DENOMINATOR");
  return valid(rounded(100 * (current.value - prior.value) / prior.value));
}

function optionsMeasureValidity(input: Record<string, unknown>): SemanticResult {
  const iv30 = numberField(input, "iv30_pct");
  const ivRank = numberField(input, "iv_rank_1y_pct");
  const skew = numberField(input, "skew_25d_vol_points");
  const failure = firstFailure(iv30, ivRank, skew);
  if (failure) return failure;
  if (!iv30.ok || !ivRank.ok || !skew.ok) return invalid("UNREACHABLE_INPUT_STATE");
  if (iv30.value < 0) return invalid("IV_NEGATIVE");
  if (ivRank.value < 0 || ivRank.value > 100) return invalid("IV_RANK_OUT_OF_RANGE");
  return valid(true);
}

function publicationEligibility(input: Record<string, unknown>): SemanticResult {
  const quality = stringField(input, "quality_state");
  const stale = booleanField(input, "is_stale");
  const required = booleanField(input, "required_source");
  const allowDegraded = booleanField(input, "allow_degraded");
  const failure = firstFailure(quality, stale, required, allowDegraded);
  if (failure) return failure;
  if (!quality.ok || !stale.ok || !required.ok || !allowDegraded.ok) return invalid("UNREACHABLE_INPUT_STATE");
  if (quality.value !== "VALID" && quality.value !== "DEGRADED" && quality.value !== "QUARANTINED") {
    return invalid("UNKNOWN_QUALITY_STATE");
  }
  if (quality.value === "QUARANTINED") return invalid("QUARANTINED");
  if (stale.value) return unavailable(required.value ? "STALE_REQUIRED_SOURCE" : "STALE_OPTIONAL_SOURCE");
  if (quality.value === "DEGRADED" && !allowDegraded.value) return unavailable("DEGRADED_POLICY_REQUIRED");
  return valid(true);
}

export function evaluateSqueezeSemanticRule(
  rule: SqueezeSemanticRule,
  input: Record<string, unknown>,
): SemanticResult {
  switch (rule) {
    case "MARKET_UTILIZATION_PCT": return marketUtilization(input);
    case "MARKET_AVAILABLE_QTY": return reconciledDifference(input, "lendable_qty", ["on_loan_qty"], "reported_available_qty", "NEGATIVE_AVAILABILITY", "AVAILABILITY_RECONCILIATION_FAILED");
    case "INTERNAL_ELIGIBLE_QTY": return reconciledDifference(input, "gross_inventory_qty", ["restricted_qty"], "reported_eligible_lendable_qty", "NEGATIVE_ELIGIBLE_INVENTORY", "ELIGIBLE_RECONCILIATION_FAILED");
    case "INTERNAL_AVAILABLE_QTY": return reconciledDifference(input, "eligible_lendable_qty", ["reserved_qty", "on_loan_qty"], "reported_available_qty", "NEGATIVE_AVAILABILITY", "AVAILABILITY_RECONCILIATION_FAILED");
    case "EQUIVALENT_FEE_BPS": return equivalentFee(input);
    case "LOAN_RATE_COMPARABILITY": return loanRateComparability(input);
    case "SHORT_INTEREST_PCT": return shortInterest(input);
    case "SHORT_MEASURE_COMPATIBILITY": return shortMeasureCompatibility(input);
    case "SHORT_SALE_VOLUME_PCT": return shortSaleVolumePct(input);
    case "DAYS_TO_COVER": return ratio(input, "position_qty", "adv20_qty");
    case "PRICE_RETURN_PCT": return priceReturn(input);
    case "PUT_CALL_RATIO": return ratio(input, "put_volume_qty", "call_volume_qty");
    case "OPEN_INTEREST_CHANGE_PCT": return openInterestChange(input);
    case "OPTIONS_MEASURE_VALIDITY": return optionsMeasureValidity(input);
    case "PUBLICATION_ELIGIBILITY": return publicationEligibility(input);
  }
}
