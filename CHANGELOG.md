# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CI uploads the unit test coverage (lcov) to Codecov; coverage and CI badges in the README.

## [2.0.0] - 2026-11-25

Complete rewrite in TypeScript. Retroizing is about 150 times faster and no longer freezes the
page. Live at https://fionapreroll.github.io/retroizer/.

### Added

- "Phosphor Deck" UI: numbered hardware-style panels (source, parameters, process, output,
  palette), a CRT viewport, keycaps and LCD readouts. The status LED, the LCD status line and the
  progress bar (now made of LED segments) stay.
- Themes Phosphor, Amber and Cyan, remembered across visits and applied before the first paint.
  The scanlines toggle is remembered too.
- About dialog with contact, version, source and licence links, build information (commit,
  branch, build time, CI run) and the third-party components with their licences; the full
  licence texts ship as `third-party-licenses.txt`.
- Compare the original with the retro image.
- History counter.
- Drag and drop an image onto the viewport.
- Copy a swatch's hex value, copy the whole palette, and export the palette as a GIMP palette
  (`.gpl`).
- Phone layout: the panels follow the workflow (Source, viewport, Parameters, Output, Palette)
  and the Process keys are docked at the bottom. Source becomes three keys (Load, Paste, Sample),
  so loading an image is the first thing on screen.
- "Load image" key in the empty viewport on every screen size.
- Floating preview on phones: while the viewport is scrolled out of sight, a thumbnail of the
  canvas floats above the dock. It animates while rendering, glows when the result is ready and
  scrolls back to the viewport when tapped.
- Favicon.
- Unit tests and property-based fuzz tests (fast-check), a Playwright soak test and a benchmark
  (`pnpm test`, `pnpm test:fuzz`, `pnpm soak`, `pnpm bench`).
- GitHub Actions: CI (lint, typecheck, tests, fuzz, soak, benchmark), nightly long fuzz and soak
  runs, and Dependabot.
- Every build of `main` is deployed to GitHub Pages, together with showcase screenshots that CI
  takes of the built app.

### Changed

- Rendering runs in a Web Worker, so the page stays responsive while an image is processed.
  Measured in headless Chromium with 16 colours and pixel size 4:
    - 1920×1080: 54.9 s → 0.36 s; the longest main-thread block went from 835 ms to 0 ms.
    - 640×427: 8.96 s → 0.09 s.
    - 256 colours at 640×427: 75 s → 0.39 s.
- k-means clusters a weighted 32768-bin colour histogram instead of every pixel, palette mapping
  is exact and cached, and pixelize runs in a single pass. Image quality (PSNR) is the same or
  slightly better.
- The palette is seeded with k-means++ instead of the first k pixels, so the same image and
  settings can give a different palette than version 1.0.
- Images with at most n colours keep exactly their own colours.
- Rewritten in strict TypeScript, built with Vite and pnpm. The code is split into DOM-free core
  algorithms, the worker and renderer, and UI modules. Linted with ESLint (typescript-eslint
  strict) and formatted with Prettier.
- Fonts are self-hosted instead of loaded from Google Fonts.

### Fixed

- Retroize re-enabled its button before pixelize had finished.
- Pixelize could not be undone, and undo across images of different sizes broke.
- Empty k-means clusters turned black.
- Pasting an image never left the BUSY state.
- "Copy Original Image" did nothing.
- A broken CSS comment dropped the shadow colour.

### Removed

- The Makefile, which needed `../Makefile.base` from outside this repository.

## [1.0.0] - 2024-08-28

"Image Retroizer v1", developed in the previous repository.

### Added

- Sample cat image ("Import Cat Image").
- Feedback display.
- Status indicators and status messages.
- Colour palette display.
- Live palette preview.
- Fancier palette display.
- ESLint configuration, and Makefile targets for ESLint and licence headers.

### Changed

- Reworked when rendering is triggered.
- k-means is parallelized.
- The palette is applied immediately instead of only together with the pixelize step.
- JavaScript refactored: turned into ES modules split across files, then merged back into a
  single file without exports.
- Reworked styling and refactored the CSS.

### Fixed

- Colour palette fixes.
- Progress bar proportions.
- Errors are handled gracefully.
- Imports after the switch to ES modules.
- Style issues found by ESLint.
- Fixes after the UI rework.

## [0.1.0] - 2024-08-27

### Added

- First version of Retroizer.

[Unreleased]: https://github.com/FionaPreroll/retroizer/compare/9c45eda...HEAD
[2.0.0]: https://github.com/FionaPreroll/retroizer/compare/0521a4a...9c45eda
