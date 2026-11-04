import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** Coalesce presentation writes before paint, never calculation or persistence. */
export function usePaintedSnapshot<T>(snapshot: T): T {
  const [painted, setPainted] = useState(snapshot);
  const latest = useRef(snapshot);
  const frame = useRef<number | null>(null);
  useLayoutEffect(() => {
    latest.current = snapshot;
    if (frame.current === null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        // A normal scheduled React update may miss this paint. Publish the last
        // already-calculated snapshot synchronously inside the frame callback.
        flushSync(() => setPainted(latest.current));
      });
  }, [snapshot]);
  useLayoutEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );
  return painted;
}
