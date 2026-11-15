// Keep the CSS --ease token in sync with this curve.
export const easeOut = [0.23, 1, 0.32, 1] as const;
export const easeInOut = [0.77, 0, 0.175, 1] as const;

export const isKeyboardInteraction = () =>
  document.documentElement.dataset.inputModality === "keyboard";

export function trackInputModality() {
  const keyboard = () => {
    document.documentElement.dataset.inputModality = "keyboard";
  };
  const pointer = () => {
    document.documentElement.dataset.inputModality = "pointer";
  };
  window.addEventListener("keydown", keyboard, true);
  window.addEventListener("pointerdown", pointer, true);
  return () => {
    window.removeEventListener("keydown", keyboard, true);
    window.removeEventListener("pointerdown", pointer, true);
  };
}
