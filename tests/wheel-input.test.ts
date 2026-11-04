import { expect, it } from "vitest";
import { createWheelInput } from "../src/wheel-input";
it("accumulates small deltas and normalizes lines", () => {
  const fine = createWheelInput(),
    coarse = createWheelInput();
  let steps = 0;
  for (let i = 0; i < 84; i++) steps += fine(1, 0, i);
  expect(steps).toBe(2);
  expect(coarse(84, 0, 0)).toBe(1);
  expect(createWheelInput()(3, 1, 0)).toBe(1);
});
it.each([84, 100, 120, -100, -120])(
  "moves one item per mouse notch (%i)",
  (delta) => {
    expect(createWheelInput()(delta, 0, 0)).toBe(Math.sign(delta));
  },
);
it("does not carry residual motion into the opposite direction", () => {
  const wheel = createWheelInput();
  expect(wheel(40, 0, 0)).toBe(0);
  expect(wheel(-42, 0, 10)).toBe(-1);
});
it("discards old residuals after the gesture ends", () => {
  const wheel = createWheelInput();
  expect(wheel(40, 0, 0)).toBe(0);
  expect(wheel(2, 0, 1000)).toBe(0);
});
