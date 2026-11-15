/* eslint-disable */
/**
 * GENERATED from contracts/agent/quantsmith-pin.schema.json by scripts/generate-agent-contracts.mjs.
 * Do not edit by hand; run `npm run generate:agent-contracts`.
 */

/**
 * contracts/agent/quantsmith-pin.json: reviewed content fingerprints of the locally supplied QuantSmith copy (quantsmith-pin/1).
 */
export interface QuantSmithPin {
  schema_version: "quantsmith-pin/1";
  package: {
    name: "quantsmith";
    version: string;
    code_digest: string;
  };
  assets: {
    digest: string;
    /**
     * @minItems 1
     */
    paths: [string, ...string[]];
  };
  reviewed: QuantSmithCommitSource | QuantSmithLocalSource | QuantSmithLocalCommitSource;
}
export interface QuantSmithCommitSource {
  on: string;
  source_commit: string;
  note?: string;
}
export interface QuantSmithLocalSource {
  on: string;
  /**
   * Optional local QuantSmith root, absolute or relative to the QuantMeridian repository root. No Git checkout or commit is required. Content fingerprints remain mandatory.
   */
  source_path: string;
  note?: string;
}
export interface QuantSmithLocalCommitSource {
  on: string;
  source_commit: string;
  /**
   * Optional local QuantSmith root, absolute or relative to the QuantMeridian repository root. No Git checkout or commit is required. Content fingerprints remain mandatory.
   */
  source_path: string;
  note?: string;
}
