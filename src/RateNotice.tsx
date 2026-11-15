import type { Kind } from "./catalog";
import type { Rates } from "./engine";
import type { State } from "./state";
import { visibleRateProblems } from "./rate-errors";
import { providerOrigins } from "./provider-origins";
import { tr } from "./i18n";
import { extensionApi } from "./browser-api";
export function RateNotice({
  rates,
  kind,
  locale,
  onRetry,
  onDenied,
}: {
  rates: Rates;
  kind: Kind;
  locale: State["locale"];
  onRetry: () => void;
  onDenied: () => void;
}) {
  // Provider failures keep the cached quotes and last-check time without alerts.
  // Keep actionable permission/cache problems so users can restore access.
  const problems = visibleRateProblems(rates, kind).filter(({ issue }) =>
    [
      "permission-denied",
      "storage-read",
      "storage-write",
      "invalid-cache",
    ].includes(issue.kind),
  );
  if (!problems.length) return null;
  const t = tr[locale];
  const origins = problems
    .filter(({ issue }) => issue.kind === "permission-denied")
    .map(({ provider }) => providerOrigins[provider])
    .filter(Boolean);
  return (
    <p className="network">
      {origins.length ? t.permissionDenied : t.cacheUnavailable}{" "}
      <button
        onClick={() => {
          if (origins.length)
            void extensionApi.permissions
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
