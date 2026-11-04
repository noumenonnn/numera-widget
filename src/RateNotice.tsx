import type { Kind } from "./catalog";
import type { Rates } from "./engine";
import type { State } from "./state";
import { visibleRateProblems } from "./rate-errors";
import { providerOrigins } from "./provider-origins";
import { tr } from "./i18n";
export function RateNotice({
  rates,
  kind,
  locale,
  nextWakeAt,
  onRetry,
  onDenied,
}: {
  rates: Rates;
  kind: Kind;
  locale: State["locale"];
  nextWakeAt: number;
  onRetry: () => void;
  onDenied: () => void;
}) {
  const problems = visibleRateProblems(rates, kind);
  if (!problems.length) return null;
  const t = tr[locale];
  const origins = problems
    .filter(({ issue }) => issue.kind === "permission-denied")
    .map(({ provider }) => providerOrigins[provider])
    .filter(Boolean);
  const restricted = problems.some(
    ({ issue }) =>
      issue.kind === "http" && (issue.status === 403 || issue.status === 451),
  );
  const storage = problems.some(
    ({ issue }) =>
      issue.kind === "storage-read" ||
      issue.kind === "storage-write" ||
      issue.kind === "invalid-cache",
  );
  const timeout = problems.some(({ issue }) => issue.kind === "timeout");
  const invalid = problems.some(
    ({ issue }) => issue.kind === "invalid-payload",
  );
  const internal = problems.some(({ issue }) => issue.kind === "internal");
  return (
    <p className="network">
      {origins.length
        ? t.permissionDenied
        : restricted
          ? t.restricted
          : storage
            ? t.cacheUnavailable
            : timeout
              ? t.timeout
              : invalid
                ? t.invalidPayload
                : internal
                  ? t.refreshFailed
                  : t.offline}
      {!!nextWakeAt &&
        nextWakeAt > Date.now() &&
        !origins.length &&
        ` · ${t.nextCheck}: ${new Date(nextWakeAt).toLocaleTimeString(locale)}`}{" "}
      <button
        onClick={() => {
          if (origins.length)
            void browser.permissions
              .request({ origins })
              .then((granted) => {
                if (granted) onRetry();
              })
              .catch(onDenied);
          else onRetry();
        }}
      >
        {origins.length ? t.restoreAccess : t.retry}
      </button>
    </p>
  );
}
