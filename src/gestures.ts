export type Gesture = {
  axis: "x" | "y" | null;
  dx: number;
  dy: number;
  width: number;
  index: number;
  count: number;
  step?: number;
};
export type Outcome =
  | { type: "reset" | "reveal" | "delete" }
  | { type: "move"; targetIndex: number };
export function gestureOutcome(g: Gesture): Outcome {
  if (g.index < 1) return { type: "reset" };
  if (g.axis === "x") {
    if (-g.dx >= g.width * 0.7) return { type: "delete" };
    if (-g.dx >= g.width * 0.25) return { type: "reveal" };
    return { type: "reset" };
  }
  if (g.axis === "y") {
    const targetIndex = Math.max(
      1,
      Math.min(
        g.count - 1,
        g.index + Math.round(g.dy / (g.step && g.step > 0 ? g.step : 90)),
      ),
    );
    if (targetIndex !== g.index) return { type: "move", targetIndex };
  }
  return { type: "reset" };
}
export function previewOrder<T extends { rowId: string }>(
  rows: T[],
  rowId: string,
  targetIndex: number,
): T[] {
  const i = rows.findIndex((r) => r.rowId === rowId);
  if (
    i < 1 ||
    targetIndex < 1 ||
    targetIndex >= rows.length ||
    i === targetIndex
  )
    return rows;
  const copy = [...rows];
  const [row] = copy.splice(i, 1);
  copy.splice(targetIndex, 0, row);
  return copy;
}
export function wheelIndex(start: number, dy: number, count: number): number {
  if (count <= 0) return 0;
  const next = start - Math.round(dy / 42);
  return ((next % count) + count) % count;
}
export type StickerProgress = {
  distance: number;
  visible: boolean;
  remaining: number;
};
export function advanceSticker(
  previous: StickerProgress,
  steps: number,
  count: number,
): StickerProgress {
  if (count <= 1 || steps === 0 || !Number.isFinite(steps)) return previous;
  const next = { ...previous };
  for (let i = 0; i < Math.floor(Math.abs(steps)); i++) {
    if (next.visible) {
      if (--next.remaining === 0) next.visible = false;
    } else {
      next.distance += Math.sign(steps);
      if (Math.abs(next.distance) >= count * 10) {
        next.distance = 0;
        next.visible = true;
        next.remaining = 10;
      }
    }
  }
  return next;
}
