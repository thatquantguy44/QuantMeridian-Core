import { describe, expect, it } from "vitest";
import { qualifySnapshot } from "./qualification";
import { verifySnapshot } from "./snapshot";
import { signSnapshotFixture, snapshotFixtureContent } from "./snapshot.fixture";

async function artifact(origin: "CAPTURED" | "IMPORTED") {
  const snapshot = await signSnapshotFixture(snapshotFixtureContent());
  return { origin, json: JSON.stringify(snapshot), verification: await verifySnapshot(snapshot) };
}

describe("PORA snapshot qualification", () => {
  it("reports per-asset internal coverage and unresolved gates without model admission", async () => {
    const input = await artifact("CAPTURED");
    const report = qualifySnapshot(input);
    expect(report.snapshotId).toBe(input.verification.snapshotId);
    expect(report.modelAdmission).toBe("BLOCKED");
    expect(report.knowledgeBasis).toBe("CURRENT_VINTAGE");
    expect(report.sourceEvidence).toBe("RECEIPTS_CHECKED_AT_CAPTURE");
    expect(report.context.scope).toBe("HISTORICAL_LOCAL_REVIEW_NOT_SNAPSHOT_EVIDENCE");
    expect(report.context.reviewedOn).toBe("2026-11-12");
    expect(report.context.currency).toContain("not bound to this snapshot");
    expect(report.context.calendar).toContain("2025-01-09");
    expect(report.context.calendar).toContain("refreshed locally");
    expect(report.context.calendar).toContain("local EcoMedallion runtime was updated to the merged fix");
    expect(report.context.calendar).toContain("not rechecked for this snapshot");
    expect(report.context.rights).toContain("account entitlement remains unknown");
    expect(report.assets.map((asset) => asset.id)).toEqual(["SPY", "AGG"]);
    for (const asset of report.assets) {
      expect(asset.sessionCount).toBe(253);
      expect(asset.returnCount).toBe(252);
      expect(asset.internalChecks).toEqual(["ALIGNED_OBSERVATIONS", "RETURN_RECONCILIATION", "SOURCE_REFERENCES"]);
      expect(asset.blockers).toEqual(["TICKER_ONLY_IDENTITY", "CURRENCY_UNKNOWN", "SOURCE_RIGHTS_UNKNOWN", "MEMBERSHIP_NOT_POINT_IN_TIME"]);
    }
    expect(report.blockers).toContain("POLICY_AND_MODEL_BINDING_UNRESOLVED");
    expect(report.blockers).toContain("POINT_IN_TIME_NOT_ESTABLISHED");
    expect(report.blockers).toContain("CALENDAR_NOT_INDEPENDENTLY_VERIFIED");
  });

  it("preserves unverified origin for an internally valid imported artifact", async () => {
    const report = qualifySnapshot(await artifact("IMPORTED"));
    expect(report.modelAdmission).toBe("BLOCKED");
    expect(report.sourceEvidence).toBe("IMPORTED_ORIGIN_NOT_RECHECKED");
    expect(report.context.scope).toBe("HISTORICAL_LOCAL_REVIEW_NOT_SNAPSHOT_EVIDENCE");
    expect(report.blockers).toContain("IMPORTED_ORIGIN_NOT_RECHECKED");
  });
});
