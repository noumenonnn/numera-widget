import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { isKeyboardInteraction } from "./motion";
export type Notice = {
  text: string;
  undo?: () => boolean | void;
  actionLabel?: string;
};
export function Toast({
  notice,
  setNotice,
  undoLabel,
  dismissLabel,
}: {
  notice: Notice | null;
  setNotice: React.Dispatch<React.SetStateAction<Notice | null>>;
  undoLabel: string;
  dismissLabel: string;
}) {
  const toastRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const [displayedNotice, setDisplayedNotice] = useState(notice);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastGesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    dx: number;
    time: number;
    axis: "x" | "y" | null;
  } | null>(null);
  const [toastOffset, setToastOffset] = useState(0);
  const [toastDragging, setToastDragging] = useState(false);
  const dismiss = useCallback(() => {
    if (toastRef.current?.contains(document.activeElement)) {
      const target = returnFocus.current?.isConnected
        ? returnFocus.current
        : document.querySelector<HTMLElement>("[data-input]");
      target?.focus({ preventScroll: true });
    }
    setNotice((current) => (current === notice ? null : current));
  }, [notice, setNotice]);
  const pause = () => clearTimeout(timer.current);
  const resume = useCallback(() => {
    pause();
    if (
      !notice ||
      toastGesture.current ||
      toastRef.current?.matches(":hover") ||
      toastRef.current?.contains(document.activeElement)
    )
      return;
    timer.current = setTimeout(dismiss, 6000);
  }, [dismiss, notice]);
  useEffect(() => {
    if (!notice) {
      pause();
      const exit = setTimeout(
        () => setDisplayedNotice(null),
        isKeyboardInteraction() ? 0 : 200,
      );
      return () => clearTimeout(exit);
    }
    setDisplayedNotice(notice);
    setToastOffset(0);
    setToastDragging(false);
    toastGesture.current = null;
    resume();
    return pause;
  }, [notice, resume]);
  const content = notice || displayedNotice;
  return (
    <>
      {content && (
        <div
          ref={toastRef}
          className={"toast" + (toastDragging ? " dragging" : "")}
          data-open={!!notice}
          role="status"
          inert={!notice}
          style={
            toastOffset && !reducedMotion
              ? { transform: `translateX(${toastOffset}px)` }
              : undefined
          }
          onPointerDown={(e) => {
            if (
              e.button !== 0 ||
              !e.isPrimary ||
              toastGesture.current ||
              (e.target as HTMLElement).closest("button")
            )
              return;
            if (e.pointerType === "mouse") e.preventDefault();
            pause();
            toastGesture.current = {
              pointerId: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              dx: 0,
              time: performance.now(),
              axis: null,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const g = toastGesture.current;
            if (!g || g.pointerId !== e.pointerId) return;
            const dx = e.clientX - g.x,
              dy = e.clientY - g.y;
            if (!g.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8)
              g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (g.axis === "x") {
              g.dx = dx;
              setToastDragging(true);
              setToastOffset(dx);
            }
          }}
          onPointerUp={(e) => {
            const g = toastGesture.current;
            if (!g || g.pointerId !== e.pointerId) return;
            toastGesture.current = null;
            setToastDragging(false);
            if (
              g.axis === "x" &&
              (Math.abs(g.dx) >=
                Math.min(80, e.currentTarget.clientWidth * 0.25) ||
                Math.abs(g.dx) / Math.max(1, performance.now() - g.time) > 0.11)
            ) {
              setToastOffset(Math.sign(g.dx) * window.innerWidth);
              dismiss();
            } else {
              setToastOffset(0);
              resume();
            }
          }}
          onPointerCancel={() => {
            toastGesture.current = null;
            setToastDragging(false);
            setToastOffset(0);
            resume();
          }}
          onLostPointerCapture={() => {
            if (toastGesture.current) {
              toastGesture.current = null;
              setToastDragging(false);
              setToastOffset(0);
              resume();
            }
          }}
          onMouseEnter={pause}
          onMouseLeave={() => {
            if (!toastRef.current?.contains(document.activeElement)) resume();
          }}
          onFocus={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget))
              returnFocus.current =
                e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
            pause();
          }}
          onBlur={() =>
            setTimeout(() => {
              if (
                toastRef.current &&
                !toastRef.current.contains(document.activeElement) &&
                !toastRef.current.matches(":hover")
              )
                resume();
            }, 0)
          }
        >
          <span>{content.text}</span>
          {content.undo && (
            <button
              onClick={() => {
                if (content.undo?.() !== false) dismiss();
              }}
            >
              {content.actionLabel || undoLabel}
            </button>
          )}
          <button
            className="dismiss"
            aria-label={dismissLabel}
            onClick={() => dismiss()}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
