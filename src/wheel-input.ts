/** Accumulate fine input, but a coarse mouse event advances just one item. */
export function createWheelInput() {
  let remainder = 0,
    lastAt = -Infinity;
  return (delta: number, mode: number, now: number) => {
    if (!Number.isFinite(delta)) return 0;
    if (now - lastAt > 250 || Math.sign(delta) !== Math.sign(remainder))
      remainder = 0;
    lastAt = now;
    const pixels = delta * (mode === 1 ? 16 : mode === 2 ? 252 : 1);
    remainder += Math.max(-42, Math.min(42, pixels));
    const steps = Math.trunc(remainder / 42);
    remainder -= steps * 42;
    return steps;
  };
}
