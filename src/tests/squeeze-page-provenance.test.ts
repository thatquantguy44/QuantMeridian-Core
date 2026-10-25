import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const page = readFileSync(
  new URL("../app/securities-lending/squeeze/page.tsx", import.meta.url),
  "utf8",
);

describe("Squeeze Radar provenance", () => {
  test("labels its synthetic-only data without claiming a stream", () => {
    expect(page).toMatch(/<ProvenanceBadge\s+source="SIM"\s+simSelected\s*\/>/);
    expect(page).toMatch(/<PageHeader[\s\S]*?showStreaming=\{false\}[\s\S]*?\/>/);
    expect(page).not.toContain("would stream");
  });
});
