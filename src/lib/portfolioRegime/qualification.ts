import type { SnapshotArtifact } from "./snapshotClient";

/** Summarizes an already verified artifact; this report cannot admit data to a model. */
export function qualifySnapshot(artifact: SnapshotArtifact) {
  const check = artifact.verification;
  const imported = artifact.origin === "IMPORTED";
  const labels = check.assets.map((asset) => asset.reference?.status === "REPORTED" ? asset.reference.unitLabel : null);
  const catalogLabels = labels.some((label) => label === null) ? "INCOMPLETE" as const : new Set(labels).size === 1 ? "MATCHING_UNVERIFIED_LABELS" as const : "CONFLICTING_LABELS" as const;
  return {
    version: "pora-qualification-report/1" as const,
    snapshotId: check.snapshotId,
    modelAdmission: "BLOCKED" as const,
    knowledgeBasis: "CURRENT_VINTAGE" as const,
    sourceEvidence: imported ? "IMPORTED_ORIGIN_NOT_RECHECKED" as const : "RECEIPTS_CHECKED_AT_CAPTURE" as const,
    interpretation: "Internal consistency and content hashes do not authenticate provider origin; imported receipt contents are not rechecked. This report does not grant rights or admit model inputs.",
    context: {
      scope: "HISTORICAL_LOCAL_REVIEW_NOT_SNAPSHOT_EVIDENCE" as const,
      reviewedOn: "2026-11-12",
      currency: "A reviewed local EcoMedallion manifest labels SPY, AGG, ACWI and BIL USD; the label is not bound to this snapshot and is not independent provider evidence.",
      calendar: "A local warehouse marked 2018-12-05 and 2025-01-09 as business days despite exchange closures; the two examples were refreshed locally. The local EcoMedallion runtime was updated to the merged fix. The catalog remains partial, and the refresh was not rechecked for this snapshot.",
      rights: "Tiingo's published documentation distinguishes internal use from redistribution; account entitlement remains unknown.",
      membership: "The selected fixed universe is not evidence of historical eligibility and may introduce survivorship bias.",
      references: {
        manifest: "https://github.com/thatquantguy44/EcoMedallion/blob/7b26d1e9d0e27313e7e367e47d59605ce8db6f7d/manifests/equity_tiingo.yml",
        tiingo: "https://www.tiingo.com/documentation/",
        mergedFix: "https://github.com/thatquantguy44/EcoMedallion/pull/101",
        closure2018: "https://ir.theice.com/press/news-details/2018/New-York-Stock-Exchange-to-Honor-President-George-H-W-Bush/default.aspx",
        closure2025: "https://ir.theice.com/press/news-details/2024/The-New-York-Stock-Exchange-Will-Close-Markets-on-January-9-to-Honor-the-Passing-of-Former-President-Jimmy-Carter-on-National-Day-of-Mourning/default.aspx",
      },
    },
    asOfDate: check.asOfDate,
    capturedAt: check.capturedAt,
    firstDate: check.firstDate,
    lastDate: check.lastDate,
    catalogLabels,
    assets: check.assets.map((asset) => ({
      id: asset.id,
      sessionCount: check.returnCount + 1,
      returnCount: asset.returns.length,
      reference: asset.reference,
      internalChecks: ["ALIGNED_OBSERVATIONS", "RETURN_RECONCILIATION", "SOURCE_REFERENCES"] as const,
      blockers: ["TICKER_ONLY_IDENTITY", "CURRENCY_UNKNOWN", "SOURCE_RIGHTS_UNKNOWN", "MEMBERSHIP_NOT_POINT_IN_TIME"] as const,
    })),
    blockers: [
      ...(imported ? ["IMPORTED_ORIGIN_NOT_RECHECKED" as const] : []),
      "POINT_IN_TIME_NOT_ESTABLISHED" as const,
      "CALENDAR_NOT_INDEPENDENTLY_VERIFIED" as const,
      "POLICY_AND_MODEL_BINDING_UNRESOLVED" as const,
    ],
  };
}
