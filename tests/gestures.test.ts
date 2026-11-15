import { describe, it, expect } from "vitest";
import { gestureOutcome } from "../src/gestures";
describe("row gestures", () => {
  it("snaps short horizontal motion back", () =>
    expect(
      gestureOutcome({
        axis: "x",
        dx: -60,
        dy: 0,
        width: 348,
        index: 2,
        count: 4,
      }),
    ).toEqual({ type: "reset" }));
  it("reveals delete past one quarter width", () =>
    expect(
      gestureOutcome({
        axis: "x",
        dx: -90,
        dy: 0,
        width: 348,
        index: 2,
        count: 4,
      }),
    ).toEqual({ type: "reveal" }));
  it("deletes at 70 percent", () =>
    expect(
      gestureOutcome({
        axis: "x",
        dx: -250,
        dy: 0,
        width: 348,
        index: 2,
        count: 4,
      }),
    ).toEqual({ type: "delete" }));
  it("never moves or deletes pinned row", () =>
    expect(
      gestureOutcome({
        axis: "y",
        dx: 0,
        dy: 180,
        width: 348,
        index: 0,
        count: 4,
      }),
    ).toEqual({ type: "reset" }));
  it("moves only among ordinary rows", () =>
    expect(
      gestureOutcome({
        axis: "y",
        dx: 0,
        dy: -180,
        width: 348,
        index: 3,
        count: 4,
      }),
    ).toEqual({ type: "move", targetIndex: 1 }));
});
import { wheelIndex } from "../src/gestures";
it("wheel drag wraps in both directions and snaps to an item step", () => {
  expect(wheelIndex(3, -85, 20)).toBe(5);
  expect(wheelIndex(1, 200, 20)).toBe(16);
  expect(wheelIndex(18, -200, 20)).toBe(3);
  expect(wheelIndex(0, 420, 0)).toBe(0);
  expect(wheelIndex(0, 420, 1)).toBe(0);
});
it("uses actual row height for reorder under enlarged text", () =>
  expect(
    gestureOutcome({
      axis: "y",
      dx: 0,
      dy: 60,
      width: 348,
      index: 1,
      count: 4,
      step: 140,
    }),
  ).toEqual({ type: "reset" }));
