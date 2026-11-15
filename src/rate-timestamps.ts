import type { Rates } from "./engine";

/** Fixed local-time display, independent of the browser's locale preferences. */
export function formatCheckTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Most recent successful receipt of rate data; failed checks do not change it. */
export function latestDataUpdate(rates: Rates): number | undefined {
  const timestamps = [
    rates.fxAt,
    rates.cryptoAt,
    rates.qAt,
    ...Object.values(rates.fx).map((quote) => quote.fetchedAt),
    ...Object.values(rates.cryptoFetchedAt ?? {}),
  ].filter(
    (at): at is number =>
      typeof at === "number" && Number.isFinite(at) && at > 0,
  );
  return timestamps.length ? Math.max(...timestamps) : undefined;
}
