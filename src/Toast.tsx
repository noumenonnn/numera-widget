import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
  notice: Notice;
  setNotice: React.Dispatch<React.SetStateAction<Notice | null>>;
  undoLabel: string;
  dismissLabel: string;
}) {
  const toastRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastGesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    dx: number;
    axis: "x" | "y" | null;
  } | null>(null);
  const [toastOffset, setToastOffset] = useState(0);
  const [toastDragging, setToastDragging] = useState(false);
  const dismiss = useCallback(
    () => setNotice((current) => (current === notice ? null : current)),
    [notice, setNotice],
  );
  const pause = () => clearTimeout(timer.current);
  const resume = useCallback(() => {
    pause();
    if (
      toastGesture.current ||
      toastRef.current?.matches(":hover") ||
      toastRef.current?.contains(document.activeElement)
    )
      return;
    timer.current = setTimeout(dismiss, 6000);
  }, [dismiss]);
  useEffect(() => {
    setToastOffset(0);
    setToastDragging(false);
    toastGesture.current = null;
    resume();
    return pause;
  }, [notice, resume]);
  return (
    <>
      {notice && (
        <div
          ref={toastRef}
          className={"toast" + (toastDragging ? " dragging" : "")}
          role="status"
          style={{ transform: `translateX(${toastOffset}px)` }}
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest("button"))
              return;
            if (e.pointerType === "mouse") e.preventDefault();
            pause();
            toastGesture.current = {
              pointerId: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              dx: 0,
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
              Math.abs(g.dx) >= Math.min(80, e.currentTarget.clientWidth * 0.25)
            ) {
              setToastOffset(Math.sign(g.dx) * window.innerWidth);
              window.setTimeout(
                () => dismiss(),
                matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? 0
                  : 180,
              );
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
          onFocus={pause}
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
          <span>{notice.text}</span>
          {notice.undo && (
            <button
              onClick={() => {
                if (notice.undo?.() !== false) dismiss();
              }}
            >
              {notice.actionLabel || undoLabel}
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
