import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RateNotice } from "../src/RateNotice";
import { emptyRates } from "../src/engine";
import type { RateIssue } from "../src/rate-errors";

const render = (issue: RateIssue) =>
  renderToStaticMarkup(
    createElement(RateNotice, {
      rates: { ...emptyRates, issues: { Frankfurter: issue } },
      kind: "fiat",
      locale: "en",
      onRetry() {},
      onDenied() {},
    }),
  );
it.each(["offline", "timeout", "http", "invalid-payload"] as const)(
  "does not show a provider failure notification for %s",
  (kind) => {
    expect(render({ kind, detail: "provider failure" })).toBe("");
  },
);
it("keeps access restoration and cache problems actionable", () => {
  expect(render({ kind: "permission-denied", detail: "denied" })).toContain(
    "Allow access",
  );
  expect(render({ kind: "storage-write", detail: "disk error" })).toContain(
    "Could not read or save the rate cache",
  );
});
