# Selection conversion tooltip implementation plan

> **For agentic workers:** Execute inline using superpowers:executing-plans. Preserve existing uncommitted Chrome support changes. No commit or publication requested.

**Goal:** Automatically convert selected amounts with an explicit currency into the main currency from settings, with the popup closed, in Chrome and Firefox.

**Architecture:** A standalone isolated content script observes completed selections. A one-shot background message parses the selection using the existing catalog and engine, restores settings and cached rates, refreshes only when needed, and returns a conversion. A Shadow DOM tooltip in the top layer follows the extension theme and exact Figma styling.

**Tech Stack:** TypeScript, Vite, WebExtensions, existing decimal.js rate engine.

**Spec:** User-approved behavior in this chat, Figma 72:6451 and 72:6458. Format: source amount/code, 18px arrow, converted amount/code. Geist 600 14px/26px; 6px gaps; 8px horizontal padding; 34px height; 10px corners; exact theme fills, borders, shadows and orange #d99a43.

## Global constraints

- Main currency is state.converter.rows[0].code; theme is state.theme.
- Only HTTP(S) pages; browser-internal and store pages remain subject to browser restrictions.
- Selection is processed locally, never persisted or sent to rate providers.
- Plain numbers, malformed selections, input fields, editable content and ambiguous currencies do not trigger conversion. Bare $ means USD; bare ¥ defaults to JPY.
- Hide on deselection, replacement, Escape, scroll, resize, page hide and loss of focus. Discard late replies.
- No continuous content-script port, idle polling, or scheduled refresh while popup is closed.

## Review focus

- Numeric grouping, comma/period decimals, names and symbols.
- New selection/deselection while a previous conversion is pending.
- Main currency and theme changes without reloading a page.
- Closed popup and restarted background worker.
- Edge-of-viewport and hostile page CSS.

### Task 1: Parse and convert

- [x] Add tests for explicit currency detection, invalid selections, exact conversion and unavailable rates.
- [x] Implement src/selection-conversion.ts using parseInput, convert and rateStatus; integrate a validated one-shot listener in background.ts.
- [x] Verify tests, including background restore without popup connections.

### Task 2: Render and package

- [x] Implement src/selection-tooltip.ts with selection lifecycle, Shadow DOM, local Figma icons/font, settings updates and viewport positioning.
- [x] Build a standalone IIFE content script for both targets; declare HTTP(S) content scripts and narrowly scoped web-accessible assets.
- [x] Update privacy docs to describe local selection processing and on-demand rate requests.

### Task 3: Verify

- [x] Run lint, type checks, unit tests and both extension builds.
- [x] Run browser fixtures in isolated Chrome and Firefox profiles with deterministic rates, popup closed, both themes and screenshots.
- [x] Review scoped diff and fix regressions; report any verification limits.
