import { expect, it } from "vitest";
import {
  FetchError,
  isRateIssue,
  migrateRateIssue,
  visibleRateProblems,
} from "../src/rate-errors";
it("migrates old cache details at the boundary while filtering the selected tab", () => {
  expect(
    visibleRateProblems(
      { error: "Binance: HTTP 451; Frankfurter: timeout" },
      "fiat",
    ),
  ).toEqual([
    { provider: "Frankfurter", issue: { kind: "timeout", detail: "timeout" } },
  ]);
  expect(
    visibleRateProblems(
      { issues: { Kraken: { kind: "http", status: 451, detail: "blocked" } } },
      "fiat",
    ),
  ).toEqual([]);
});
it("rejects corrupt structured failures", () => {
  expect(isRateIssue({ kind: "internal", detail: "Refresh failed" })).toBe(true);
  expect(isRateIssue({ kind: "http", detail: "x", status: "451" })).toBe(false);
  expect(isRateIssue({ kind: "offline", detail: "x", retryAt: Infinity })).toBe(
    false,
  );
  expect(isRateIssue({ kind: "storage-write", detail: "disk" })).toBe(true);
});
it("keeps malformed HTTP metadata from invalidating the whole rate snapshot", () => {
  expect(new FetchError("HTTP 0", NaN, "http", 0).status).toBeUndefined();
  expect(new FetchError("HTTP 0", NaN).retryAfter).toBe(0);
  expect(isRateIssue(migrateRateIssue("HTTP 999"))).toBe(true);
});
