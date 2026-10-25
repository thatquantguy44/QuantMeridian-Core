export type SqueezeIdentityAssetType = "EQUITY" | "ETF" | "ADR";

export interface EffectiveIdentityRecord {
  data_mode: "SIM";
  record_id: string;
  effective_from: string;
  effective_to: string | null;
  first_knowable_at: string;
}

export interface IssuerIdentityRecord extends EffectiveIdentityRecord {
  issuer_id: string;
}

export interface ShareClassIdentityRecord extends EffectiveIdentityRecord {
  share_class_id: string;
  issuer_id: string;
}

export interface SecurityIdentityRecord extends EffectiveIdentityRecord {
  security_id: string;
  share_class_id: string;
  asset_type: SqueezeIdentityAssetType;
}

export interface ListingIdentityRecord extends EffectiveIdentityRecord {
  listing_id: string;
  security_id: string;
  ticker: string;
  venue: string;
}

export interface IdentityCatalog {
  data_mode: "SIM";
  issuers: IssuerIdentityRecord[];
  share_classes: ShareClassIdentityRecord[];
  securities: SecurityIdentityRecord[];
  listings: ListingIdentityRecord[];
}

export interface ResolvedSecurityIdentity {
  issuer_id: string;
  share_class_id: string;
  security_id: string;
  listing_id: string | null;
  ticker: string | null;
  venue: string | null;
  asset_type: SqueezeIdentityAssetType;
}

export type CorporateActionType =
  | "SYMBOL_CHANGE"
  | "SPLIT"
  | "MERGER"
  | "SPIN_OFF"
  | "ADR_CONVERSION"
  | "SHARE_CLASS_CHANGE"
  | "DELISTING";

export interface CorporateActionEdge {
  data_mode: "SIM";
  edge_id: string;
  event_id: string;
  event_type: CorporateActionType;
  effective_at: string;
  first_knowable_at: string;
  from_security_id: string;
  to_security_id: string | null;
  from_share_class_id: string;
  to_share_class_id: string | null;
  from_listing_id: string;
  to_listing_id: string | null;
  conversion_numerator: number | null;
  conversion_denominator: number | null;
}

export type IdentityLookup =
  | { security_id: string; listing_id?: never; ticker?: never; venue?: never }
  | { listing_id: string; security_id?: never; ticker?: never; venue?: never }
  | { ticker: string; venue?: string; security_id?: never; listing_id?: never };

type IdentityReasonCode =
  | "NO_IDENTITY_MATCH"
  | "NO_KNOWABLE_IDENTITY"
  | "NO_EFFECTIVE_IDENTITY"
  | "INVALID_IDENTITY_RECORD"
  | "AMBIGUOUS_IDENTITY_MAPPING"
  | "IDENTITY_REFERENCE_MISMATCH";

type RecordResolution<T> =
  | { status: "RESOLVED"; identity: T }
  | { status: "NOT_FOUND"; reason_code: Extract<IdentityReasonCode, `NO_${string}`> }
  | {
    status: "QUARANTINED";
    reason_code: Exclude<IdentityReasonCode, `NO_${string}`>;
    record_ids: string[];
  };

export type IdentityResolution = RecordResolution<ResolvedSecurityIdentity>;

export type CorporateActionLineageResolution =
  | { status: "RESOLVED"; security_ids: string[]; applied_edge_ids: string[] }
  | {
    status: "QUARANTINED";
    reason_code:
      | "INVALID_CORPORATE_ACTION"
      | "AMBIGUOUS_CORPORATE_ACTION"
      | "IDENTITY_LINEAGE_MISMATCH";
    edge_ids: string[];
  };

interface EffectiveOptions {
  effectiveAt: string;
  decisionAt: string;
}

interface ResolveIdentityOptions extends EffectiveOptions {
  lookup: IdentityLookup;
}

interface ResolveLineageOptions extends EffectiveOptions {
  startSecurityId: string;
}

type ResolutionGoldenExpected =
  | {
    status: "RESOLVED";
    issuer_id: string;
    security_id: string;
    share_class_id: string;
    listing_id: string;
    ticker: string;
  }
  | { status: "NOT_FOUND" | "QUARANTINED"; reason_code: string };

export interface IdentityLineageGoldenFixture {
  fixture_version: "1.0";
  data_mode: "SIM";
  catalog: IdentityCatalog;
  actions: CorporateActionEdge[];
  resolution_cases: Array<{
    id: string;
    lookup: IdentityLookup;
    effective_at: string;
    decision_at: string;
    expected: ResolutionGoldenExpected;
  }>;
  lineage_cases: Array<{
    id: string;
    start_security_id: string;
    effective_at: string;
    decision_at: string;
    expected_security_ids: string[];
    expected_edge_ids: string[];
  }>;
}

function timestamp(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (match === null) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const normalizedInput = `${value.slice(0, 19)}.${(match[7] ?? "").padEnd(3, "0")}Z`;
  return new Date(parsed).toISOString() === normalizedInput ? parsed : null;
}

function nonEmpty(value: string): boolean {
  return value.length > 0;
}

function resolveEffectiveRecord<T extends EffectiveIdentityRecord>(
  records: readonly T[],
  matches: (record: T) => boolean,
  options: EffectiveOptions,
  requiredValues: (record: T) => string[],
  validRecord: (record: T) => boolean = () => true,
): RecordResolution<T> {
  const effectiveAt = timestamp(options.effectiveAt);
  const decisionAt = timestamp(options.decisionAt);
  if (effectiveAt === null || decisionAt === null) {
    return { status: "QUARANTINED", reason_code: "INVALID_IDENTITY_RECORD", record_ids: [] };
  }

  const matching = records.filter(matches);
  if (matching.length === 0) return { status: "NOT_FOUND", reason_code: "NO_IDENTITY_MATCH" };

  // A malformed knowability timestamp cannot safely be placed on the decision timeline.
  const unknowable = matching.filter((record) => timestamp(record.first_knowable_at) === null);
  if (unknowable.length > 0) {
    return {
      status: "QUARANTINED",
      reason_code: "INVALID_IDENTITY_RECORD",
      record_ids: unknowable.map((record) => record.record_id).sort(),
    };
  }

  // Future revisions must not contaminate decisions made before they were knowable.
  const knowable = matching.filter((record) => timestamp(record.first_knowable_at)! <= decisionAt);
  if (knowable.length === 0) return { status: "NOT_FOUND", reason_code: "NO_KNOWABLE_IDENTITY" };

  const invalid = knowable.filter((record) => {
    const from = timestamp(record.effective_from);
    const to = record.effective_to === null ? null : timestamp(record.effective_to);
    return !nonEmpty(record.record_id)
      || record.data_mode !== "SIM"
      || requiredValues(record).some((value) => !nonEmpty(value))
      || !validRecord(record)
      || from === null
      || (record.effective_to !== null && (to === null || to <= from));
  });
  if (invalid.length > 0) {
    return {
      status: "QUARANTINED",
      reason_code: "INVALID_IDENTITY_RECORD",
      record_ids: invalid.map((record) => record.record_id).sort(),
    };
  }

  const effective = knowable.filter((record) => {
    const from = timestamp(record.effective_from)!;
    const to = record.effective_to === null ? null : timestamp(record.effective_to)!;
    return from <= effectiveAt && (to === null || effectiveAt < to);
  });
  if (effective.length === 0) return { status: "NOT_FOUND", reason_code: "NO_EFFECTIVE_IDENTITY" };
  if (effective.length > 1) {
    return {
      status: "QUARANTINED",
      reason_code: "AMBIGUOUS_IDENTITY_MAPPING",
      record_ids: effective.map((record) => record.record_id).sort(),
    };
  }
  return { status: "RESOLVED", identity: effective[0] };
}

export function resolveIssuerIdentity(
  records: readonly IssuerIdentityRecord[],
  issuerId: string,
  options: EffectiveOptions,
): RecordResolution<IssuerIdentityRecord> {
  return resolveEffectiveRecord(records, (record) => record.issuer_id === issuerId, options, (record) => [record.issuer_id]);
}

export function resolveShareClassIdentity(
  records: readonly ShareClassIdentityRecord[],
  shareClassId: string,
  options: EffectiveOptions,
): RecordResolution<ShareClassIdentityRecord> {
  return resolveEffectiveRecord(
    records,
    (record) => record.share_class_id === shareClassId,
    options,
    (record) => [record.share_class_id, record.issuer_id],
  );
}

function resolveSecurityRecord(
  records: readonly SecurityIdentityRecord[],
  securityId: string,
  options: EffectiveOptions,
): RecordResolution<SecurityIdentityRecord> {
  return resolveEffectiveRecord(
    records,
    (record) => record.security_id === securityId,
    options,
    (record) => [record.security_id, record.share_class_id, record.asset_type],
    (record) => record.asset_type === "EQUITY" || record.asset_type === "ETF" || record.asset_type === "ADR",
  );
}

function resolveListingRecord(
  records: readonly ListingIdentityRecord[],
  matches: (record: ListingIdentityRecord) => boolean,
  options: EffectiveOptions,
): RecordResolution<ListingIdentityRecord> {
  return resolveEffectiveRecord(
    records,
    matches,
    options,
    (record) => [record.listing_id, record.security_id, record.ticker, record.venue],
  );
}

function referenceMismatch(recordIds: string[]): IdentityResolution {
  return { status: "QUARANTINED", reason_code: "IDENTITY_REFERENCE_MISMATCH", record_ids: [...new Set(recordIds)].sort() };
}

function passThrough<T>(resolution: Exclude<RecordResolution<T>, { status: "RESOLVED" }>): IdentityResolution {
  return resolution;
}

export function resolveSecurityIdentity(catalog: IdentityCatalog, options: ResolveIdentityOptions): IdentityResolution {
  if (catalog.data_mode !== "SIM") {
    return { status: "QUARANTINED", reason_code: "INVALID_IDENTITY_RECORD", record_ids: [] };
  }

  let listing: ListingIdentityRecord | null = null;
  let securityId: string;
  const lookup = options.lookup;

  if (lookup.security_id !== undefined) {
    securityId = lookup.security_id;
  } else {
    const listingResolution = resolveListingRecord(
      catalog.listings,
      lookup.listing_id !== undefined
        ? (record) => record.listing_id === lookup.listing_id
        : (record) => record.ticker === lookup.ticker
          && (lookup.venue === undefined || record.venue === lookup.venue),
      options,
    );
    if (listingResolution.status !== "RESOLVED") return passThrough(listingResolution);
    listing = listingResolution.identity;
    securityId = listing.security_id;
  }

  const securityResolution = resolveSecurityRecord(catalog.securities, securityId, options);
  if (securityResolution.status !== "RESOLVED") {
    if (listing !== null && securityResolution.status === "NOT_FOUND") {
      return referenceMismatch([listing.record_id]);
    }
    return passThrough(securityResolution);
  }
  const security = securityResolution.identity;

  const shareClassResolution = resolveShareClassIdentity(catalog.share_classes, security.share_class_id, options);
  if (shareClassResolution.status !== "RESOLVED") {
    if (shareClassResolution.status === "NOT_FOUND") return referenceMismatch([security.record_id]);
    return passThrough(shareClassResolution);
  }
  const shareClass = shareClassResolution.identity;

  const issuerResolution = resolveIssuerIdentity(catalog.issuers, shareClass.issuer_id, options);
  if (issuerResolution.status !== "RESOLVED") {
    if (issuerResolution.status === "NOT_FOUND") return referenceMismatch([security.record_id, shareClass.record_id]);
    return passThrough(issuerResolution);
  }

  if (listing !== null && listing.security_id !== security.security_id) {
    return referenceMismatch([listing.record_id, security.record_id]);
  }

  if (listing === null) {
    const listingIds = [...new Set(catalog.listings
      .filter((record) => record.security_id === security.security_id)
      .map((record) => record.listing_id))];
    const listingResolutions = listingIds.map((listingId) => resolveListingRecord(
      catalog.listings,
      (record) => record.listing_id === listingId,
      options,
    ));
    const quarantined = listingResolutions.find((resolution) => resolution.status === "QUARANTINED");
    if (quarantined?.status === "QUARANTINED") return passThrough(quarantined);
    const resolvedListings = listingResolutions
      .filter((resolution): resolution is Extract<typeof resolution, { status: "RESOLVED" }> => resolution.status === "RESOLVED")
      .map((resolution) => resolution.identity);
    if (resolvedListings.length === 1) {
      listing = resolvedListings[0];
    }
    // Zero or multiple listings do not invalidate the security hierarchy. Callers that
    // require a listing must use a listing or ticker lookup.
  }

  return {
    status: "RESOLVED",
    identity: {
      issuer_id: issuerResolution.identity.issuer_id,
      share_class_id: shareClass.share_class_id,
      security_id: security.security_id,
      listing_id: listing?.listing_id ?? null,
      ticker: listing?.ticker ?? null,
      venue: listing?.venue ?? null,
      asset_type: security.asset_type,
    },
  };
}

function positiveRatio(edge: CorporateActionEdge): boolean {
  return edge.conversion_numerator !== null
    && edge.conversion_denominator !== null
    && Number.isFinite(edge.conversion_numerator)
    && Number.isFinite(edge.conversion_denominator)
    && edge.conversion_numerator > 0
    && edge.conversion_denominator > 0;
}

function validCorporateAction(edge: CorporateActionEdge): boolean {
  if (edge.data_mode !== "SIM") return false;
  if ([edge.edge_id, edge.event_id, edge.from_security_id, edge.from_share_class_id, edge.from_listing_id]
    .some((value) => !nonEmpty(value))) return false;
  if (timestamp(edge.effective_at) === null || timestamp(edge.first_knowable_at) === null) return false;

  switch (edge.event_type) {
    case "SYMBOL_CHANGE":
      return edge.to_security_id === edge.from_security_id
        && edge.to_share_class_id === edge.from_share_class_id
        && edge.to_listing_id === edge.from_listing_id
        && edge.conversion_numerator === null
        && edge.conversion_denominator === null;
    case "SPLIT":
      return edge.to_security_id === edge.from_security_id
        && edge.to_share_class_id === edge.from_share_class_id
        && edge.to_listing_id === edge.from_listing_id
        && positiveRatio(edge);
    case "MERGER":
    case "SPIN_OFF":
    case "ADR_CONVERSION":
      return edge.to_security_id !== null
        && nonEmpty(edge.to_security_id)
        && edge.to_security_id !== edge.from_security_id
        && edge.to_share_class_id !== null
        && nonEmpty(edge.to_share_class_id)
        && edge.to_listing_id !== null
        && nonEmpty(edge.to_listing_id)
        && positiveRatio(edge);
    case "SHARE_CLASS_CHANGE":
      return edge.to_security_id !== null
        && nonEmpty(edge.to_security_id)
        && edge.to_security_id !== edge.from_security_id
        && edge.to_share_class_id !== null
        && nonEmpty(edge.to_share_class_id)
        && edge.to_share_class_id !== edge.from_share_class_id
        && edge.to_listing_id !== null
        && nonEmpty(edge.to_listing_id)
        && positiveRatio(edge);
    case "DELISTING":
      return edge.to_security_id === null
        && edge.to_share_class_id === null
        && edge.to_listing_id === null
        && edge.conversion_numerator === null
        && edge.conversion_denominator === null;
  }
}

function semanticKey(edge: CorporateActionEdge): string {
  const securityLevel = [
    edge.event_type,
    timestamp(edge.effective_at),
    edge.from_security_id,
    edge.to_security_id,
    edge.from_share_class_id,
    edge.to_share_class_id,
  ];
  return (edge.event_type === "SYMBOL_CHANGE"
    ? [...securityLevel, edge.from_listing_id, edge.to_listing_id]
    : securityLevel).join("|");
}

function resolveEndpoint(
  catalog: IdentityCatalog,
  securityId: string,
  shareClassId: string,
  listingId: string,
  effectiveAt: string,
  decisionAt: string,
): ResolvedSecurityIdentity | null {
  const resolved = resolveSecurityIdentity(catalog, {
    lookup: { listing_id: listingId },
    effectiveAt,
    decisionAt,
  });
  return resolved.status === "RESOLVED"
    && resolved.identity.security_id === securityId
    && resolved.identity.share_class_id === shareClassId
    && resolved.identity.listing_id === listingId
    ? resolved.identity
    : null;
}

function isNoLongerEffective<T>(resolution: RecordResolution<T>): boolean {
  return resolution.status === "NOT_FOUND" && resolution.reason_code === "NO_EFFECTIVE_IDENTITY";
}

function lineageMatchesCatalog(catalog: IdentityCatalog, edge: CorporateActionEdge, decisionAt: string): boolean {
  const eventTime = timestamp(edge.effective_at)!;
  const immediatelyBefore = new Date(eventTime - 1).toISOString();
  const sourceBefore = resolveEndpoint(
    catalog,
    edge.from_security_id,
    edge.from_share_class_id,
    edge.from_listing_id,
    immediatelyBefore,
    decisionAt,
  );
  if (sourceBefore === null) return false;

  const sourceAt = resolveEndpoint(
    catalog,
    edge.from_security_id,
    edge.from_share_class_id,
    edge.from_listing_id,
    edge.effective_at,
    decisionAt,
  );

  const sourceSecurityAt = resolveSecurityRecord(
    catalog.securities,
    edge.from_security_id,
    { effectiveAt: edge.effective_at, decisionAt },
  );
  const sourceShareClassAt = resolveShareClassIdentity(
    catalog.share_classes,
    edge.from_share_class_id,
    { effectiveAt: edge.effective_at, decisionAt },
  );
  const sourceListingAt = resolveListingRecord(
    catalog.listings,
    (record) => record.listing_id === edge.from_listing_id,
    { effectiveAt: edge.effective_at, decisionAt },
  );
  const sourceListingRecords = catalog.listings
    .filter((record) => record.security_id === edge.from_security_id);
  const malformedListingKnowability = sourceListingRecords
    .some((record) => timestamp(record.first_knowable_at) === null);
  const sourceListingIds = [...new Set(sourceListingRecords
    .filter((record) => timestamp(record.first_knowable_at)! <= timestamp(decisionAt)!)
    .map((record) => record.listing_id))];
  const allSourceListingsTerminated = !malformedListingKnowability
    && sourceListingIds.length > 0
    && sourceListingIds.every((listingId) => isNoLongerEffective(resolveListingRecord(
      catalog.listings,
      (record) => record.listing_id === listingId,
      { effectiveAt: edge.effective_at, decisionAt },
    )));
  const sourceTerminated = isNoLongerEffective(sourceSecurityAt)
    && isNoLongerEffective(sourceShareClassAt)
    && isNoLongerEffective(sourceListingAt)
    && allSourceListingsTerminated;

  if (edge.event_type === "DELISTING") return sourceTerminated;
  if (edge.to_security_id === null || edge.to_share_class_id === null || edge.to_listing_id === null) return false;

  const targetAt = resolveEndpoint(
    catalog,
    edge.to_security_id,
    edge.to_share_class_id,
    edge.to_listing_id,
    edge.effective_at,
    decisionAt,
  );
  if (targetAt === null) return false;

  if (edge.event_type === "SPLIT") return sourceAt !== null;
  if (edge.event_type === "SPIN_OFF") {
    const targetSecurityBefore = resolveSecurityRecord(
      catalog.securities,
      edge.to_security_id,
      { effectiveAt: immediatelyBefore, decisionAt },
    );
    const targetShareClassBefore = resolveShareClassIdentity(
      catalog.share_classes,
      edge.to_share_class_id,
      { effectiveAt: immediatelyBefore, decisionAt },
    );
    const targetListingBefore = resolveListingRecord(
      catalog.listings,
      (record) => record.listing_id === edge.to_listing_id,
      { effectiveAt: immediatelyBefore, decisionAt },
    );
    return sourceAt !== null
      && isNoLongerEffective(targetSecurityBefore)
      && isNoLongerEffective(targetShareClassBefore)
      && isNoLongerEffective(targetListingBefore);
  }
  if (edge.event_type === "SYMBOL_CHANGE") {
    const before = resolveListingRecord(
      catalog.listings,
      (record) => record.listing_id === edge.from_listing_id,
      { effectiveAt: immediatelyBefore, decisionAt },
    );
    const after = resolveListingRecord(
      catalog.listings,
      (record) => record.listing_id === edge.to_listing_id,
      { effectiveAt: edge.effective_at, decisionAt },
    );
    return before.status === "RESOLVED"
      && after.status === "RESOLVED"
      && before.identity.ticker !== after.identity.ticker;
  }
  if (!sourceTerminated) return false;
  if (edge.event_type === "ADR_CONVERSION") {
    return sourceBefore.asset_type === "ADR"
      && targetAt.asset_type === "EQUITY"
      && sourceBefore.issuer_id === targetAt.issuer_id;
  }
  if (edge.event_type === "SHARE_CLASS_CHANGE") {
    return sourceBefore.issuer_id === targetAt.issuer_id;
  }
  return true;
}

function hasKnownRootIdentity(
  catalog: IdentityCatalog,
  securityId: string,
  effectiveAt: number,
  decisionAt: number,
): boolean {
  const candidates = catalog.securities
    .filter((record) => record.security_id === securityId)
    .filter((record) => timestamp(record.first_knowable_at) !== null
      && timestamp(record.first_knowable_at)! <= decisionAt)
    .filter((record) => timestamp(record.effective_from) !== null
      && timestamp(record.effective_from)! <= effectiveAt)
    .sort((left, right) => timestamp(right.effective_from)! - timestamp(left.effective_from)!);
  const candidate = candidates[0];
  if (candidate === undefined || candidate.data_mode !== "SIM") return false;
  const end = candidate.effective_to === null ? null : timestamp(candidate.effective_to);
  if (candidate.effective_to !== null && end === null) return false;
  const sampleTime = end === null ? effectiveAt : Math.min(effectiveAt, end - 1);
  if (sampleTime < timestamp(candidate.effective_from)!) return false;
  return resolveSecurityIdentity(catalog, {
    lookup: { security_id: securityId },
    effectiveAt: new Date(sampleTime).toISOString(),
    decisionAt: new Date(decisionAt).toISOString(),
  }).status === "RESOLVED";
}

const REPLACEMENT_ACTIONS = new Set<CorporateActionType>([
  "MERGER",
  "ADR_CONVERSION",
  "SHARE_CLASS_CHANGE",
  "DELISTING",
]);

export function resolveCorporateActionLineage(
  catalog: IdentityCatalog,
  actions: readonly CorporateActionEdge[],
  options: ResolveLineageOptions,
): CorporateActionLineageResolution {
  const effectiveAt = timestamp(options.effectiveAt);
  const decisionAt = timestamp(options.decisionAt);
  if (catalog.data_mode !== "SIM"
    || effectiveAt === null
    || decisionAt === null
    || !nonEmpty(options.startSecurityId)) {
    return { status: "QUARANTINED", reason_code: "INVALID_CORPORATE_ACTION", edge_ids: [] };
  }

  if (!hasKnownRootIdentity(catalog, options.startSecurityId, effectiveAt, decisionAt)) {
    return { status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH", edge_ids: [] };
  }

  const malformedKnowability = actions.filter((edge) => timestamp(edge.first_knowable_at) === null);
  if (malformedKnowability.length > 0) {
    return {
      status: "QUARANTINED",
      reason_code: "INVALID_CORPORATE_ACTION",
      edge_ids: malformedKnowability.map((edge) => edge.edge_id).sort(),
    };
  }

  const known = actions.filter((edge) => timestamp(edge.first_knowable_at)! <= decisionAt);
  const invalid = known.filter((edge) => !validCorporateAction(edge));
  if (invalid.length > 0) {
    return {
      status: "QUARANTINED",
      reason_code: "INVALID_CORPORATE_ACTION",
      edge_ids: invalid.map((edge) => edge.edge_id).sort(),
    };
  }

  const eligible = known
    .filter((edge) => timestamp(edge.effective_at)! <= effectiveAt)
    .sort((left, right) => timestamp(left.effective_at)! - timestamp(right.effective_at)!
      || left.edge_id.localeCompare(right.edge_id));

  const seenEdgeIds = new Set<string>();
  const seenSemanticKeys = new Map<string, string>();
  const duplicateIds = new Set<string>();
  for (const edge of eligible) {
    if (seenEdgeIds.has(edge.edge_id)) duplicateIds.add(edge.edge_id);
    seenEdgeIds.add(edge.edge_id);
    const key = semanticKey(edge);
    const previous = seenSemanticKeys.get(key);
    if (previous !== undefined) {
      duplicateIds.add(previous);
      duplicateIds.add(edge.edge_id);
    } else {
      seenSemanticKeys.set(key, edge.edge_id);
    }
  }
  if (duplicateIds.size > 0) {
    return {
      status: "QUARANTINED",
      reason_code: "AMBIGUOUS_CORPORATE_ACTION",
      edge_ids: [...duplicateIds].sort(),
    };
  }

  const active = new Set([options.startSecurityId]);
  const appliedEdgeIds: string[] = [];
  for (let index = 0; index < eligible.length;) {
    const groupTime = timestamp(eligible[index].effective_at)!;
    const group: CorporateActionEdge[] = [];
    while (index < eligible.length && timestamp(eligible[index].effective_at) === groupTime) {
      group.push(eligible[index]);
      index += 1;
    }

    const applicable = group.filter((edge) => active.has(edge.from_security_id));
    const replacementCounts = new Map<string, CorporateActionEdge[]>();
    for (const edge of applicable.filter((candidate) => REPLACEMENT_ACTIONS.has(candidate.event_type))) {
      const current = replacementCounts.get(edge.from_security_id) ?? [];
      current.push(edge);
      replacementCounts.set(edge.from_security_id, current);
    }
    const conflicting = [...replacementCounts.values()].filter((edges) => edges.length > 1).flat();
    const sameTimeChain = applicable.flatMap((edge) => edge.to_security_id === null
      || edge.to_security_id === edge.from_security_id
      ? []
      : group
        .filter((candidate) => candidate.edge_id !== edge.edge_id
          && candidate.from_security_id === edge.to_security_id)
        .flatMap((candidate) => [edge, candidate]));
    if (conflicting.length > 0 || sameTimeChain.length > 0) {
      return {
        status: "QUARANTINED",
        reason_code: "AMBIGUOUS_CORPORATE_ACTION",
        edge_ids: [...new Set([...conflicting, ...sameTimeChain].map((edge) => edge.edge_id))].sort(),
      };
    }

    const mismatched = applicable.filter((edge) => !lineageMatchesCatalog(catalog, edge, options.decisionAt));
    if (mismatched.length > 0) {
      return {
        status: "QUARANTINED",
        reason_code: "IDENTITY_LINEAGE_MISMATCH",
        edge_ids: mismatched.map((edge) => edge.edge_id).sort(),
      };
    }

    for (const edge of applicable) {
      if (edge.event_type === "SPIN_OFF") {
        active.add(edge.to_security_id!);
      } else if (REPLACEMENT_ACTIONS.has(edge.event_type)) {
        active.delete(edge.from_security_id);
        if (edge.to_security_id !== null) active.add(edge.to_security_id);
      }
      appliedEdgeIds.push(edge.edge_id);
    }
  }

  return {
    status: "RESOLVED",
    security_ids: [...active].sort(),
    applied_edge_ids: appliedEdgeIds,
  };
}
