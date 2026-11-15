import { extensionApi } from "./browser-api";
import type { SelectionQuote } from "./selection-conversion";

const media = matchMedia("(prefers-color-scheme: dark)");
let host: HTMLDivElement | undefined;
let source: HTMLSpanElement;
let target: HTMLSpanElement;
let arrow: HTMLImageElement;
let theme: SelectionQuote["theme"] = "system";
let generation = 0;
let timer: ReturnType<typeof setTimeout>;
let pointerDown = false;
let anchor: DOMRect | undefined;
let font: Promise<FontFace> | undefined;

function hide() {
  generation++;
  clearTimeout(timer);
  anchor = undefined;
  if (host?.matches(":popover-open")) host.hidePopover();
  // all:initial!important overrides the browser's normal closed-popover display.
  // Explicitly hide the host so closing also removes its shadow content from paint.
  host?.style.setProperty("display", "none", "important");
}

function applyTheme() {
  if (!host) return;
  const dark = theme === "dark" || (theme === "system" && media.matches);
  host.dataset.theme = dark ? "dark" : "light";
  arrow.src = extensionApi.runtime.getURL(
    `tooltip/arrow-${dark ? "dark" : "light"}.svg`,
  );
}

function createTooltip() {
  host = document.createElement("div");
  host.id = "numera-selection-tooltip";
  host.popover = "manual";
  // Inline !important defeats page selectors; the top layer escapes clipping and stacking.
  host.style.cssText =
    "all:initial!important;display:none!important;position:fixed!important;inset:auto!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;pointer-events:none!important;max-width:calc(100vw - 16px)!important;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { color-scheme: light dark; }
    .tooltip { box-sizing:border-box; display:flex; align-items:center; justify-content:center;
      gap:6px; height:34px; padding:4px 12px; position:relative;
      --border-start:rgba(23,23,23,.0448); --border-end:rgba(23,23,23,.0192);
      border-radius:100px; background:rgba(255,255,255,.95); color:#000;
      box-shadow:0 2px 6px rgba(0,0,0,.06),0 10px 24px -8px rgba(0,0,0,.08);
      backdrop-filter:blur(25px); max-width:calc(100vw - 16px);
      font:600 14px/26px "Numera Selection Geist",sans-serif; letter-spacing:normal;
      direction:ltr; user-select:none; }
    :host([data-theme="dark"]) .tooltip { background:rgba(23,23,23,.88); color:#fff;
      --border-start:rgba(255,255,255,.16); --border-end:rgba(255,255,255,.0128);
      box-shadow:0 7px 10px rgba(0,0,0,.09),0 40px 80px rgba(0,0,0,.3); }
    span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .tooltip::before { content:""; position:absolute; inset:0; border-radius:inherit;
      padding:.5px; background:linear-gradient(to bottom,var(--border-start),var(--border-end));
      mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); mask-composite:exclude;
      pointer-events:none; }
    .target { color:#d7a147; }
    :host([data-theme="dark"]) .target { color:#e0b46a; }
    img { width:18px; height:18px; flex:none; display:block; }
  `;
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("aria-live", "polite");
  source = document.createElement("span");
  arrow = document.createElement("img");
  arrow.alt = "→";
  target = document.createElement("span");
  target.className = "target";
  tooltip.append(source, arrow, target);
  root.append(style, tooltip);
  document.documentElement.append(host);
  const face = new FontFace(
    "Numera Selection Geist",
    `url("${extensionApi.runtime.getURL("tooltip/geist-latin.woff2")}")`,
    { weight: "100 900" },
  );
  document.fonts.add(face);
  font = face.load();
  void font.catch(() => {});
}

function position() {
  if (!host || !anchor) return;
  const box = host.getBoundingClientRect();
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? innerWidth;
  const height = viewport?.height ?? innerHeight;
  const x = Math.max(
    left + 8,
    Math.min(
      anchor.left + anchor.width / 2 - box.width / 2,
      left + width - box.width - 8,
    ),
  );
  const above = anchor.top - box.height - 8;
  const y = Math.max(
    top + 8,
    Math.min(
      above >= top + 8 ? above : anchor.bottom + 8,
      top + height - box.height - 8,
    ),
  );
  host.style.setProperty("left", `${x}px`, "important");
  host.style.setProperty("top", `${y}px`, "important");
}

function selected() {
  const selection = getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1)
    return null;
  const editable = (node: Node | null) => {
    const element = node instanceof Element ? node : node?.parentElement;
    return element?.closest(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
    );
  };
  if (
    editable(selection.anchorNode) ||
    editable(selection.focusNode) ||
    editable(document.activeElement)
  )
    return null;
  const text = selection.toString().trim();
  if (
    !text ||
    text.length > 128 ||
    !/\d/.test(text) ||
    !/[^\d\s.,+−\-]/u.test(text)
  )
    return null;
  const rects = selection.getRangeAt(0).getClientRects();
  const rect = rects[rects.length - 1];
  if (!rect || (!rect.width && !rect.height)) return null;
  return { text, rect };
}

async function update() {
  hide();
  if (pointerDown || document.hidden || !document.hasFocus()) return;
  const selection = selected();
  if (!selection) return;
  const request = generation;
  try {
    const quote: SelectionQuote | null = await extensionApi.runtime.sendMessage(
      { type: "selection-convert", text: selection.text },
    );
    if (!quote || request !== generation || selected()?.text !== selection.text)
      return;
    if (!host) createTooltip();
    // Ensure the exact Figma font is ready before positioning the floating element.
    await font?.catch(() => {});
    if (request !== generation || selected()?.text !== selection.text) return;
    source.textContent = quote.source;
    target.textContent = quote.target;
    theme = quote.theme;
    applyTheme();
    anchor = selection.rect;
    host!.style.setProperty("display", "block", "important");
    host!.showPopover();
    position();
  } catch {
    // Extension updates, revoked site access, or unavailable quotes leave the page alone.
  }
}

function queue() {
  hide();
  if (!pointerDown) timer = setTimeout(() => void update(), 160);
}
document.addEventListener("selectionchange", queue);
document.addEventListener(
  "pointerdown",
  () => {
    pointerDown = true;
    hide();
  },
  true,
);
document.addEventListener(
  "pointerup",
  () => {
    pointerDown = false;
    queue();
  },
  true,
);
document.addEventListener(
  "pointercancel",
  () => {
    pointerDown = false;
    hide();
  },
  true,
);
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape") hide();
  },
  true,
);
document.addEventListener("scroll", hide, true);
document.addEventListener("visibilitychange", hide);
document.addEventListener(
  "toggle",
  (event) => {
    if (
      !(event instanceof ToggleEvent) ||
      event.newState !== "open" ||
      event.target === host ||
      !(event.target instanceof HTMLElement) ||
      !event.target.matches("[popover],dialog") ||
      !host?.matches(":popover-open")
    )
      return;
    if (!selected()) {
      hide();
      return;
    }
    // Top-layer order follows opening order, regardless of z-index. A site's
    // newly opened popover/dialog must not cover an already visible conversion.
    host.hidePopover();
    host.showPopover();
    position();
  },
  true,
);
window.addEventListener("resize", hide);
window.addEventListener("blur", () => {
  pointerDown = false;
  hide();
});
window.addEventListener("pagehide", hide);
window.visualViewport?.addEventListener("resize", hide);
window.visualViewport?.addEventListener("scroll", hide);
media.addEventListener("change", applyTheme);
extensionApi.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state && selected()) queue();
});
// The user may already have selected a price before document_idle injection.
queue();
