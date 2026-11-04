export type RateIssueKind =
  | "internal"
  | "offline"
  | "timeout"
  | "http"
  | "permission-denied"
  | "invalid-payload"
  | "invalid-cache"
  | "storage-read"
  | "storage-write";
export type RateIssue = {
  kind: RateIssueKind;
  detail: string;
  status?: number;
  retryAt?: number;
};
export class FetchError extends Error {
  public status?: number;
  constructor(
    message: string,
    public retryAfter = 0,
    public reason:
      "http" | "permission-denied" | "timeout" | "offline" = "http",
    status?: number,
  ) {
    super(message);
    this.retryAfter =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0;
    // Compatibility for callers/cache that predate the explicit HTTP status.
    const candidate =
      status ??
      (reason === "http"
        ? Number(message.match(/^HTTP (\d{3})$/)?.[1]) || undefined
        : undefined);
    this.status =
      Number.isInteger(candidate) && candidate! >= 100 && candidate! <= 599
        ? candidate
        : undefined;
  }
}
export class PayloadError extends Error {}
export function isRateIssue(raw: unknown): raw is RateIssue {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  return (
    typeof value.kind === "string" &&
    [
      "internal",
      "offline",
      "timeout",
      "http",
      "permission-denied",
      "invalid-payload",
      "invalid-cache",
      "storage-read",
      "storage-write",
    ].includes(value.kind) &&
    typeof value.detail === "string" &&
    value.detail.length <= 4096 &&
    (value.status === undefined ||
      (Number.isInteger(value.status) &&
        Number(value.status) >= 100 &&
        Number(value.status) <= 599)) &&
    (value.retryAt === undefined ||
      (typeof value.retryAt === "number" &&
        Number.isFinite(value.retryAt) &&
        value.retryAt >= 0 &&
        value.retryAt <= 8640000000000000))
  );
}
export function issueFromError(error: unknown): RateIssue {
  const detail = String(error).slice(0, 4096);
  if (error instanceof FetchError)
    return { kind: error.reason, detail, status: error.status };
  return {
    kind:
      error instanceof PayloadError || error instanceof SyntaxError
        ? "invalid-payload"
        : "offline",
    detail,
  };
}
/** Decode old cache records once at the boundary; the UI consumes typed issues. */
export function migrateRateIssue(detail: string): RateIssue {
  const candidate = Number(detail.match(/HTTP (\d{3})/)?.[1]);
  const status = candidate >= 100 && candidate <= 599 ? candidate : undefined;
  const kind: RateIssueKind = detail.includes("permission-denied")
    ? "permission-denied"
    : detail.includes("storage-read") || detail.includes("read rate cache")
      ? "storage-read"
      : detail.includes("storage-write") || detail.includes("save rate cache")
        ? "storage-write"
        : status
          ? "http"
          : /timeout|AbortError/.test(detail)
            ? "timeout"
            : /invalid|empty|SyntaxError/.test(detail)
              ? "invalid-payload"
              : "offline";
  return { kind, detail: detail.slice(0, 4096), ...(status ? { status } : {}) };
}
export function visibleRateProblems(
  rates: {
    issues?: Record<string, RateIssue>;
    errors?: Record<string, string>;
    error?: string;
  },
  kind: "fiat" | "crypto",
) {
  const names =
    kind === "fiat"
      ? ["Frankfurter", "Storage", "Internal"]
      : ["Frankfurter", "Binance", "Kraken", "Storage", "Internal"];
  const legacy =
    rates.errors ||
    Object.fromEntries(
      (rates.error || "")
        .split("; ")
        .filter(Boolean)
        .map((message) => {
          const separator = message.indexOf(": ");
          const provider = message.slice(0, separator);
          return names.includes(provider) ||
            ["Binance", "Kraken"].includes(provider)
            ? [provider, message.slice(separator + 2)]
            : ["Internal", message];
        }),
    );
  const issues =
    rates.issues ||
    Object.fromEntries(
      Object.entries(legacy).map(([provider, detail]) => [
        provider,
        migrateRateIssue(detail),
      ]),
    );
  return Object.entries(issues)
    .filter(([provider]) => names.includes(provider))
    .map(([provider, issue]) => ({ provider, issue }));
}
