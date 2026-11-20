# Adaptive Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Preserve premium 3D while providing measured adaptation, genuine image viewing, and persistent manual mode selection.

**Architecture:** A pure performance governor controls rendering budgets. An image tour shares the real tour's content and scroll positions. A small museum coordinator owns preference persistence, lazy 3D initialization, fallback, and async cancellation; existing interface controls remain shared.

**Tech Stack:** Buildless ES modules, Three.js, Canvas2D workshop, node:test.

**Spec:** docs/superpowers/specs/2026-11-20-adaptive-gallery-design.md

## Global Constraints
- Preserve premium geometry/materials and current exhibition identity.
- Modes: auto, 3d, images. Storage failures cannot prevent viewing.
- Manual selections override pending initialization and automatic fallback.
- No Three.js fetch or initialization for a saved image preference.
- Preserve the current tour position across mode switches.

## Review Focus
- Selecting images or text during pending 3D initialization must stay selected.
- Hidden/idle time and deliberate water animation pacing must not downgrade quality.
- Context failure must preserve an image tour and allow retry.
- Blocked storage and failed image requests must have usable alternatives.
- Mobile header and mode menu must remain reachable with keyboard and enlarged text.

### Task 1: Assets and measured quality policy
Files: dist/assets/gallery/*, dist/adaptive-quality.js, tests/adaptive-quality.test.mjs, dist/gallery.js, dist/environment.js.
Interfaces: createPerformanceGovernor({onChange,onFallback}) exposes sample(frameMs), reset(), profile; profiles retain geometry and textures while varying pixel/reflection budgets.
- [x] Write failing behavioral tests for sustained slowdown, healthy frames, ignored pauses and tier reset; run and observe RED.
- [x] Implement governor and integrate real post-render rAF timing, excluding initialization/idle/hidden intervals; run tests GREEN.
- [x] Generate authentic desktop/portrait images and visually verify water and opening scenes.

### Task 2: Image tour and mode coordinator
Files: dist/image-tour.js, dist/viewing-mode.js, dist/interface.js, dist/index.html, dist/style.css, tests/viewing-mode.test.mjs, tests/interface.test.mjs, tests/dom-fixture.mjs.
Interfaces: createImageTour provides the existing controller API plus getProgress/seek; startViewing orchestrates injected loadGallery and UI lifecycle for tests.
- [x] Write failing tests for stored image mode (no 3D load), fallback, switching while pending, preference persistence and position; observe RED.
- [x] Implement image navigation, persistent mode menu, lazy 3D and recovery. Preserve the existing text/workshop interactions.
- [x] Run the new and existing tests; fix behavioral regressions.

### Task 3: Verify and publish
Files: build-standalone.mjs, docs/superpowers/plans/2026-11-20-adaptive-gallery.md.
- [x] Include new modules and inline image assets in standalone packaging.
- [x] Run syntax, complete tests, standalone build and Impeccable detector.
- [x] Inspect desktop/mobile rendering and exercise automatic/manual modes, failure and reload behavior in an owned browser.
- [x] Obtain an independent whole-change code review; address material findings with regression tests.
- [ ] Commit verified source, publish existing Site through Sites source workflow, synchronize GitHub, and report verified deployment.

## Verification evidence

- `npm test`: 62 passed, 0 failed. `npm run check` and standalone build passed.
- Owned headless Chrome integration checks: remembered images do not request Three.js; desktop and portrait water imagery; 360px header/menu/content bounds; current room retained on switching; context loss and reinitialization; sustained 100ms presentation cost triggers adaptive fallback; preference survives reload; no unhandled exceptions.
- Separate Chrome run with WebGL disabled: automatic image fallback and usable explanation, no unhandled exceptions.
- Independent review fixes: reset scene references and size caches on retry; prevent hidden shader preparation from overwriting image captions; dispose partial initialization resources on exceptions; show fallback announcements outside the closed menu. Regression tests passed RED then GREEN.
- Impeccable's full-bleed workshop canvas padding warning is intentional: it is a drawing surface with instructions outside. Removed the obsolete loading eyebrow flagged by the detector.
- Thresholds were verified with controlled browser workload, not a physical device performance certification.
