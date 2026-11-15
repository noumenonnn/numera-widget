import { useEffect, useRef } from "react";
import { RefreshCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";

/** Finish the current turn when the request settles, even for a cached response. */
export function RefreshIcon({
  refreshing,
  requestId,
}: {
  refreshing: boolean;
  requestId: number;
}) {
  const icon = useRef<SVGSVGElement>(null);
  const animation = useRef<Animation | null>(null);
  const lastRequest = useRef(requestId);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const requested = lastRequest.current !== requestId;
    lastRequest.current = requestId;
    if (reducedMotion) {
      animation.current?.cancel();
      animation.current = null;
      return;
    }
    if ((refreshing || requested) && icon.current) {
      if (animation.current?.playState === "running") {
        animation.current.effect?.updateTiming({ iterations: Infinity });
      } else {
        animation.current = icon.current.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(-360deg)" }],
          { duration: 1000, iterations: Infinity, easing: "linear" },
        );
      }
    }
    if (!refreshing && animation.current) {
      const current = animation.current;
      const elapsed = Number(current.currentTime) || 0;
      current.effect?.updateTiming({
        iterations: Math.max(1, Math.floor(elapsed / 1000) + 1),
      });
    }
  }, [refreshing, requestId, reducedMotion]);
  useEffect(() => () => animation.current?.cancel(), []);
  return <RefreshCcw ref={icon} size={18} />;
}
