import { describe, expect, it } from "vitest";

import goldenJson from "../../../contracts/squeeze_radar/v1/identity-lineage-golden-1.0.json";
import {
  resolveCorporateActionLineage,
  resolveIssuerIdentity,
  resolveSecurityIdentity,
  resolveShareClassIdentity,
  type IdentityCatalog,
  type IdentityLineageGoldenFixture,
} from "./identityLineage";

const golden = goldenJson as IdentityLineageGoldenFixture;

describe("Squeeze Radar effective-dated identities", () => {
  it("resolves issuer, security, share-class, and listing identities separately", () => {
    const options = { effectiveAt: "2026-09-01T12:00:00Z", decisionAt: "2026-09-01T12:00:00Z" };

    expect(resolveIssuerIdentity(golden.catalog.issuers, "ISS-DUAL", options)).toMatchObject({
      status: "RESOLVED",
      identity: { issuer_id: "ISS-DUAL" },
    });
    expect(resolveShareClassIdentity(golden.catalog.share_classes, "CLS-DUAL-A", options)).toMatchObject({
      status: "RESOLVED",
      identity: { issuer_id: "ISS-DUAL", share_class_id: "CLS-DUAL-A" },
    });

    const us = resolveSecurityIdentity(golden.catalog, {
      lookup: { ticker: "QDUA", venue: "XNAS" },
      ...options,
    });
    const gb = resolveSecurityIdentity(golden.catalog, {
      lookup: { ticker: "QDUA", venue: "XLON" },
      ...options,
    });
    expect(us).toMatchObject({
      status: "RESOLVED",
      identity: { issuer_id: "ISS-DUAL", share_class_id: "CLS-DUAL-A", security_id: "SEC-DUAL", listing_id: "LST-DUAL-US" },
    });
    expect(gb).toMatchObject({
      status: "RESOLVED",
      identity: { issuer_id: "ISS-DUAL", share_class_id: "CLS-DUAL-A", security_id: "SEC-DUAL", listing_id: "LST-DUAL-GB" },
    });
  });

  it("resolves every golden mapping or quarantines it with the expected reason", () => {
    for (const testCase of golden.resolution_cases) {
      const resolution = resolveSecurityIdentity(golden.catalog, {
        lookup: testCase.lookup,
        effectiveAt: testCase.effective_at,
        decisionAt: testCase.decision_at,
      });

      expect(resolution.status, testCase.id).toBe(testCase.expected.status);
      if (resolution.status === "RESOLVED" && testCase.expected.status === "RESOLVED") {
        expect(resolution.identity, testCase.id).toMatchObject({
          issuer_id: testCase.expected.issuer_id,
          security_id: testCase.expected.security_id,
          share_class_id: testCase.expected.share_class_id,
          listing_id: testCase.expected.listing_id,
          ticker: testCase.expected.ticker,
        });
      } else if (resolution.status !== "RESOLVED" && testCase.expected.status !== "RESOLVED") {
        expect(resolution.reason_code, testCase.id).toBe(testCase.expected.reason_code);
      }
    }
  });

  it("does not use an identity revision before it became knowable", () => {
    const resolution = resolveSecurityIdentity(golden.catalog, {
      lookup: { ticker: "QNEW", venue: "XNAS" },
      effectiveAt: "2026-02-02T12:00:00Z",
      decisionAt: "2026-01-20T12:00:00Z",
    });

    expect(resolution).toEqual({ status: "NOT_FOUND", reason_code: "NO_KNOWABLE_IDENTITY" });
  });

  it("does not let a future malformed revision alter a past decision", () => {
    const futureMalformed = {
      ...golden.catalog.listings.find((record) => record.record_id === "LSTREC-SYM-NEW")!,
      record_id: "LSTREC-SYM-FUTURE-BAD",
      ticker: "QOLD",
      effective_from: "not-a-timestamp",
      first_knowable_at: "2026-12-01T00:00:00Z",
    };
    const catalog = { ...golden.catalog, listings: [...golden.catalog.listings, futureMalformed] };

    expect(resolveSecurityIdentity(catalog, {
      lookup: { ticker: "QOLD", venue: "XNAS" },
      effectiveAt: "2026-01-20T12:00:00Z",
      decisionAt: "2026-01-20T12:00:00Z",
    })).toMatchObject({ status: "RESOLVED", identity: { ticker: "QOLD" } });
  });

  it("quarantines broken hierarchy references, malformed known listings, and non-SIM catalogs", () => {
    const brokenReference = {
      ...golden.catalog,
      listings: golden.catalog.listings.map((record) => record.listing_id === "LST-ETF"
        ? { ...record, security_id: "SEC-MISSING" }
        : record),
    };
    expect(resolveSecurityIdentity(brokenReference, {
      lookup: { listing_id: "LST-ETF" },
      effectiveAt: "2026-09-01T12:00:00Z",
      decisionAt: "2026-09-01T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_REFERENCE_MISMATCH" });

    const malformedListing = {
      ...golden.catalog.listings.find((record) => record.listing_id === "LST-ETF")!,
      record_id: "LSTREC-ETF-BAD",
      venue: "",
    };
    expect(resolveSecurityIdentity({
      ...golden.catalog,
      listings: [...golden.catalog.listings, malformedListing],
    }, {
      lookup: { security_id: "SEC-ETF" },
      effectiveAt: "2026-09-01T12:00:00Z",
      decisionAt: "2026-09-01T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_IDENTITY_RECORD" });

    const overlappingListing = {
      ...golden.catalog.listings.find((record) => record.listing_id === "LST-ETF")!,
      record_id: "LSTREC-ETF-OVERLAP",
      ticker: "QETF2",
    };
    expect(resolveSecurityIdentity({
      ...golden.catalog,
      listings: [...golden.catalog.listings, overlappingListing],
    }, {
      lookup: { security_id: "SEC-ETF" },
      effectiveAt: "2026-09-01T12:00:00Z",
      decisionAt: "2026-09-01T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "AMBIGUOUS_IDENTITY_MAPPING" });

    const invalidAssetCatalog = {
      ...golden.catalog,
      securities: golden.catalog.securities.map((record) => record.security_id === "SEC-ETF"
        ? { ...record, asset_type: "BOND" }
        : record),
    } as unknown as IdentityCatalog;
    expect(resolveSecurityIdentity(invalidAssetCatalog, {
      lookup: { security_id: "SEC-ETF" },
      effectiveAt: "2026-09-01T12:00:00Z",
      decisionAt: "2026-09-01T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_IDENTITY_RECORD" });

    const liveCatalog = { ...golden.catalog, data_mode: "LIVE" } as unknown as IdentityCatalog;
    expect(resolveSecurityIdentity(liveCatalog, {
      lookup: { security_id: "SEC-ETF" },
      effectiveAt: "2026-09-01T12:00:00Z",
      decisionAt: "2026-09-01T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_IDENTITY_RECORD" });
  });
});

describe("Squeeze Radar corporate-action lineage", () => {
  it("covers every event type required by SQZ-T07", () => {
    expect(new Set(golden.actions.map((edge) => edge.event_type))).toEqual(new Set([
      "SYMBOL_CHANGE",
      "SPLIT",
      "MERGER",
      "SPIN_OFF",
      "ADR_CONVERSION",
      "SHARE_CLASS_CHANGE",
      "DELISTING",
    ]));
  });

  it("applies every event-specific golden lineage without double counting", () => {
    for (const testCase of golden.lineage_cases) {
      const lineage = resolveCorporateActionLineage(golden.catalog, golden.actions, {
        startSecurityId: testCase.start_security_id,
        effectiveAt: testCase.effective_at,
        decisionAt: testCase.decision_at,
      });

      expect(lineage.status, testCase.id).toBe("RESOLVED");
      if (lineage.status === "RESOLVED") {
        expect(lineage.security_ids, testCase.id).toEqual(testCase.expected_security_ids);
        expect(lineage.applied_edge_ids, testCase.id).toEqual(testCase.expected_edge_ids);
        expect(new Set(lineage.security_ids).size, testCase.id).toBe(lineage.security_ids.length);
      }
    }
  });

  it("does not apply an action before it became knowable", () => {
    expect(resolveCorporateActionLineage(golden.catalog, golden.actions, {
      startSecurityId: "SEC-MERGE-A",
      effectiveAt: "2026-04-02T12:00:00Z",
      decisionAt: "2026-03-01T12:00:00Z",
    })).toEqual({
      status: "RESOLVED",
      security_ids: ["SEC-MERGE-A"],
      applied_edge_ids: [],
    });
  });

  it("quarantines malformed, duplicate, and identity-inconsistent action edges", () => {
    const adr = golden.actions.find((edge) => edge.event_type === "ADR_CONVERSION")!;
    const malformed = { ...adr, edge_id: "EDGE-BAD-ADR", conversion_denominator: 0 };
    expect(resolveCorporateActionLineage(golden.catalog, [malformed], {
      startSecurityId: "SEC-ADR",
      effectiveAt: "2026-06-02T12:00:00Z",
      decisionAt: "2026-06-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_CORPORATE_ACTION" });

    const liveAction = { ...adr, edge_id: "EDGE-LIVE-ADR", data_mode: "LIVE" } as unknown as typeof adr;
    expect(resolveCorporateActionLineage(golden.catalog, [liveAction], {
      startSecurityId: "SEC-ADR",
      effectiveAt: "2026-06-02T12:00:00Z",
      decisionAt: "2026-06-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_CORPORATE_ACTION" });

    const duplicate = { ...adr, edge_id: "EDGE-ADR-DUPLICATE" };
    expect(resolveCorporateActionLineage(golden.catalog, [adr, duplicate], {
      startSecurityId: "SEC-ADR",
      effectiveAt: "2026-06-02T12:00:00Z",
      decisionAt: "2026-06-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "AMBIGUOUS_CORPORATE_ACTION" });

    const inconsistent = { ...adr, edge_id: "EDGE-ADR-WRONG-CLASS", from_share_class_id: "CLS-WRONG" };
    expect(resolveCorporateActionLineage(golden.catalog, [inconsistent], {
      startSecurityId: "SEC-ADR",
      effectiveAt: "2026-06-02T12:00:00Z",
      decisionAt: "2026-06-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH" });
  });

  it("quarantines semantic duplicates and same-time chains without relying on row order", () => {
    const symbol = golden.actions.find((edge) => edge.event_type === "SYMBOL_CHANGE")!;
    const duplicateEvent = { ...symbol, edge_id: "EDGE-SYMBOL-ALIAS", event_id: "EV-SYMBOL-ALIAS" };
    expect(resolveCorporateActionLineage(golden.catalog, [symbol, duplicateEvent], {
      startSecurityId: "SEC-SYM",
      effectiveAt: "2026-02-02T12:00:00Z",
      decisionAt: "2026-02-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "AMBIGUOUS_CORPORATE_ACTION" });

    const merger = golden.actions.find((edge) => edge.event_type === "MERGER")!;
    const chained = {
      ...merger,
      edge_id: "EDGE-SAME-TIME-CHAIN",
      event_id: "EV-SAME-TIME-CHAIN",
      from_security_id: "SEC-MERGE-B",
      from_share_class_id: "CLS-MERGE-B",
      from_listing_id: "LST-MERGE-B",
      to_security_id: "SEC-PARENT",
      to_share_class_id: "CLS-PARENT-A",
      to_listing_id: "LST-PARENT",
    };
    expect(resolveCorporateActionLineage(golden.catalog, [merger, chained], {
      startSecurityId: "SEC-MERGE-A",
      effectiveAt: "2026-04-02T12:00:00Z",
      decisionAt: "2026-04-02T12:00:00Z",
    })).toEqual({
      status: "QUARANTINED",
      reason_code: "AMBIGUOUS_CORPORATE_ACTION",
      edge_ids: ["EDGE-MERGER", "EDGE-SAME-TIME-CHAIN"],
    });
  });

  it("quarantines a knowable action with a malformed timestamp", () => {
    const malformed = {
      ...golden.actions.find((edge) => edge.event_type === "MERGER")!,
      edge_id: "EDGE-BAD-TIME",
      effective_at: "not-a-timestamp",
    };

    expect(resolveCorporateActionLineage(golden.catalog, [malformed], {
      startSecurityId: "SEC-MERGE-A",
      effectiveAt: "2026-04-02T12:00:00Z",
      decisionAt: "2026-04-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_CORPORATE_ACTION" });

    const normalizedByDateParse = {
      ...golden.actions.find((edge) => edge.event_type === "MERGER")!,
      edge_id: "EDGE-BAD-CALENDAR-DATE",
      effective_at: "2026-02-30T00:00:00Z",
    };
    expect(resolveCorporateActionLineage(golden.catalog, [normalizedByDateParse], {
      startSecurityId: "SEC-MERGE-A",
      effectiveAt: "2026-04-02T12:00:00Z",
      decisionAt: "2026-04-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_CORPORATE_ACTION" });
  });

  it("classifies empty action targets as invalid structures", () => {
    const spin = golden.actions.find((edge) => edge.event_type === "SPIN_OFF")!;
    const emptyTarget = { ...spin, edge_id: "EDGE-EMPTY-TARGET", to_listing_id: "" };
    expect(resolveCorporateActionLineage(golden.catalog, [emptyTarget], {
      startSecurityId: spin.from_security_id,
      effectiveAt: "2026-05-02T12:00:00Z",
      decisionAt: "2026-05-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "INVALID_CORPORATE_ACTION" });
  });

  it("reconciles termination at every identity layer and preserves a still-listed security", () => {
    const merger = golden.actions.find((edge) => edge.event_type === "MERGER")!;
    const sourceStillExists = {
      ...golden.catalog,
      share_classes: golden.catalog.share_classes.map((record) => record.share_class_id === merger.from_share_class_id
        ? { ...record, effective_to: null }
        : record),
      securities: golden.catalog.securities.map((record) => record.security_id === merger.from_security_id
        ? { ...record, effective_to: null }
        : record),
    };
    expect(resolveCorporateActionLineage(sourceStillExists, [merger], {
      startSecurityId: merger.from_security_id,
      effectiveAt: "2026-04-02T12:00:00Z",
      decisionAt: "2026-04-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH" });

    const delisting = {
      ...golden.actions.find((edge) => edge.event_type === "DELISTING")!,
      edge_id: "EDGE-DUAL-US-DELIST",
      event_id: "EV-DUAL-US-DELIST",
      effective_at: "2026-10-01T00:00:00Z",
      first_knowable_at: "2026-09-15T12:00:00Z",
      from_security_id: "SEC-DUAL",
      from_share_class_id: "CLS-DUAL-A",
      from_listing_id: "LST-DUAL-US",
    };
    const oneVenueEnds = {
      ...golden.catalog,
      share_classes: golden.catalog.share_classes.map((record) => record.share_class_id === "CLS-DUAL-A"
        ? { ...record, effective_to: delisting.effective_at }
        : record),
      securities: golden.catalog.securities.map((record) => record.security_id === "SEC-DUAL"
        ? { ...record, effective_to: delisting.effective_at }
        : record),
      listings: golden.catalog.listings.map((record) => record.listing_id === "LST-DUAL-US"
        ? { ...record, effective_to: delisting.effective_at }
        : record),
    };
    expect(resolveCorporateActionLineage(oneVenueEnds, [delisting], {
      startSecurityId: "SEC-DUAL",
      effectiveAt: "2026-10-02T12:00:00Z",
      decisionAt: "2026-10-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH" });

    const baseDelisting = golden.actions.find((edge) => edge.event_type === "DELISTING")!;
    const futureSibling = {
      ...golden.catalog.listings.find((record) => record.listing_id === "LST-DUAL-GB")!,
      record_id: "LSTREC-DELIST-FUTURE",
      listing_id: "LST-DELIST-FUTURE",
      security_id: "SEC-DELIST",
      effective_from: "2027-01-01T00:00:00Z",
      first_knowable_at: "2027-01-01T00:05:00Z",
    };
    expect(resolveCorporateActionLineage({
      ...golden.catalog,
      listings: [...golden.catalog.listings, futureSibling],
    }, [baseDelisting], {
      startSecurityId: baseDelisting.from_security_id,
      effectiveAt: "2026-08-02T12:00:00Z",
      decisionAt: "2026-08-02T12:00:00Z",
    })).toEqual({
      status: "RESOLVED",
      security_ids: [],
      applied_edge_ids: ["EDGE-DELIST"],
    });
  });

  it("deduplicates security-level actions represented once per listing", () => {
    const split = {
      ...golden.actions.find((edge) => edge.event_type === "SPLIT")!,
      edge_id: "EDGE-DUAL-SPLIT-US",
      event_id: "EV-DUAL-SPLIT-US",
      effective_at: "2026-09-01T00:00:00Z",
      first_knowable_at: "2026-08-15T12:00:00Z",
      from_security_id: "SEC-DUAL",
      to_security_id: "SEC-DUAL",
      from_share_class_id: "CLS-DUAL-A",
      to_share_class_id: "CLS-DUAL-A",
      from_listing_id: "LST-DUAL-US",
      to_listing_id: "LST-DUAL-US",
    };
    const otherListing = {
      ...split,
      edge_id: "EDGE-DUAL-SPLIT-GB",
      event_id: "EV-DUAL-SPLIT-GB",
      from_listing_id: "LST-DUAL-GB",
      to_listing_id: "LST-DUAL-GB",
    };
    expect(resolveCorporateActionLineage(golden.catalog, [split, otherListing], {
      startSecurityId: "SEC-DUAL",
      effectiveAt: "2026-09-02T12:00:00Z",
      decisionAt: "2026-09-02T12:00:00Z",
    })).toEqual({
      status: "QUARANTINED",
      reason_code: "AMBIGUOUS_CORPORATE_ACTION",
      edge_ids: ["EDGE-DUAL-SPLIT-GB", "EDGE-DUAL-SPLIT-US"],
    });
  });

  it("enforces ADR and share-class event semantics and rejects phantom lineage roots", () => {
    const adr = golden.actions.find((edge) => edge.event_type === "ADR_CONVERSION")!;
    const wrongAdrType = {
      ...golden.catalog,
      securities: golden.catalog.securities.map((record) => record.security_id === adr.from_security_id
        ? { ...record, asset_type: "EQUITY" as const }
        : record),
    };
    expect(resolveCorporateActionLineage(wrongAdrType, [adr], {
      startSecurityId: adr.from_security_id,
      effectiveAt: "2026-06-02T12:00:00Z",
      decisionAt: "2026-06-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH" });

    const classChange = golden.actions.find((edge) => edge.event_type === "SHARE_CLASS_CHANGE")!;
    const changedIssuer = {
      ...golden.catalog,
      share_classes: golden.catalog.share_classes.map((record) => record.share_class_id === classChange.to_share_class_id
        ? { ...record, issuer_id: "ISS-MERGE-B" }
        : record),
    };
    expect(resolveCorporateActionLineage(changedIssuer, [classChange], {
      startSecurityId: classChange.from_security_id,
      effectiveAt: "2026-07-02T12:00:00Z",
      decisionAt: "2026-07-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH" });

    expect(resolveCorporateActionLineage(golden.catalog, [], {
      startSecurityId: "SEC-DOES-NOT-EXIST",
      effectiveAt: "2026-09-01T12:00:00Z",
      decisionAt: "2026-09-01T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH" });
  });

  it("requires a spin-off child to begin at the event", () => {
    const spin = golden.actions.find((edge) => edge.event_type === "SPIN_OFF")!;
    const childAlreadyExists = {
      ...golden.catalog,
      share_classes: golden.catalog.share_classes.map((record) => record.share_class_id === spin.to_share_class_id
        ? { ...record, effective_from: "2026-01-01T00:00:00Z" }
        : record),
      securities: golden.catalog.securities.map((record) => record.security_id === spin.to_security_id
        ? { ...record, effective_from: "2026-01-01T00:00:00Z" }
        : record),
      listings: golden.catalog.listings.map((record) => record.listing_id === spin.to_listing_id
        ? { ...record, effective_from: "2026-01-01T00:00:00Z" }
        : record),
    };
    expect(resolveCorporateActionLineage(childAlreadyExists, [spin], {
      startSecurityId: spin.from_security_id,
      effectiveAt: "2026-05-02T12:00:00Z",
      decisionAt: "2026-05-02T12:00:00Z",
    })).toMatchObject({ status: "QUARANTINED", reason_code: "IDENTITY_LINEAGE_MISMATCH" });
  });
});
