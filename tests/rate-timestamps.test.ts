import { expect, it } from "vitest";
import { formatCheckTime, latestDataUpdate } from "../src/rate-timestamps";
import { emptyRates } from "../src/engine";

it("formats check time as dd.mm.yyyy, hh:mm:ss using local time and leading zeros", () => {
  expect(formatCheckTime(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe(
    "02.01.2026, 03:04:05",
  );
  expect(formatCheckTime(new Date(2026, 10, 15, 0, 0, 0).getTime())).toBe(
    "15.11.2026, 00:00:00",
  );
});

it("shows the latest successful update across fiat, crypto and bridge quotes", () => {
  expect(
    latestDataUpdate({ ...emptyRates, fxAt: 100, cryptoAt: 200, qAt: 300 }),
  ).toBe(300);
});
it("includes per-currency timestamps in restored snapshots", () => {
  expect(
    latestDataUpdate({
      ...emptyRates,
      fx: { RUB: { rate: "100", date: "2026-11-15", fetchedAt: 400 } },
      cryptoFetchedAt: { BTC: 500 },
    }),
  ).toBe(500);
});
it("does not display a newer failed check as updated data", () => {
  expect(
    latestDataUpdate({
      ...emptyRates,
      fxAt: 100,
      cryptoAt: 200,
      lastCheckedAt: 900,
    }),
  ).toBe(200);
  expect(
    latestDataUpdate({ ...emptyRates, lastCheckedAt: 900 }),
  ).toBeUndefined();
});
