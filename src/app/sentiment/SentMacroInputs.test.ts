import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SentMacroInputs } from "./SentMacroInputs";
import type { SentMacroResponse } from "@/lib/sentiment/macro";

it.each([[], {}, { series: [] }, { series: [{ id: "VIXCLS" }] }])("renders no data for an obsolete or incomplete retained feed shape: %j", data => {
  const html = renderToStaticMarkup(createElement(SentMacroInputs, {
    data: data as unknown as SentMacroResponse, loading: false, error: null,
  }));
  expect(html).toContain("No data");
  expect(html).not.toContain("SENT macro source observations");
});
