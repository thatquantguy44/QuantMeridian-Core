import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import ModelsPage from "./page";

describe("MDLS placeholder", () => {
  test("identifies the future registry without claiming live model data", () => {
    const html = renderToStaticMarkup(createElement(ModelsPage));

    expect(html).toContain("Model Dictionary");
    expect(html).toContain("PLACEHOLDER");
    expect(html).toContain("docs/MODEL_DICTIONARY.MD");
    expect(html).not.toContain("STREAMING");
  });
});
