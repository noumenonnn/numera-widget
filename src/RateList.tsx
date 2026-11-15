import { useEffect, type ReactNode, type RefObject } from "react";
import { animate, motion, useIsPresent, useReducedMotion } from "motion/react";
import { easeOut, isKeyboardInteraction } from "./motion";

export function RateList({
  children,
  scrollRef,
}: {
  children: ReactNode;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  const keyboard = isKeyboardInteraction();
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!present || keyboard || reducedMotion || !scroller) return;

    // Start with the reveal and follow its growing scroll range each frame.
    const start = scroller.scrollTop;
    const scrolling = animate(0, 1, {
      duration: 0.25,
      ease: easeOut,
      onUpdate: (progress) => {
        const end = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        scroller.scrollTo({
          top: start + (end - start) * progress,
          behavior: "instant",
        });
      },
    });
    const cancel = () => scrolling.stop();
    scroller.addEventListener("wheel", cancel, { passive: true });
    scroller.addEventListener("pointerdown", cancel, { passive: true });
    scroller.addEventListener("keydown", cancel);
    return () => {
      cancel();
      scroller.removeEventListener("wheel", cancel);
      scroller.removeEventListener("pointerdown", cancel);
      scroller.removeEventListener("keydown", cancel);
    };
  }, [present, keyboard, reducedMotion, scrollRef]);
  return (
    <motion.div
      id="rate-list"
      className="rate-list"
      data-open={present}
      initial={{ height: 0, opacity: 1 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        duration: keyboard || reducedMotion ? 0 : 0.2,
        ease: easeOut,
        opacity: { duration: keyboard ? 0 : 0.16 },
      }}
      inert={!present}
      onAnimationComplete={() => {
        const scroller = scrollRef.current;
        if (present && (keyboard || reducedMotion) && scroller)
          scroller.scrollTo({
            top: scroller.scrollHeight,
            behavior: "instant",
          });
      }}
      style={{ overflow: "hidden" }}
    >
      {children}
    </motion.div>
  );
}
