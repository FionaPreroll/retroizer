# Image Retroizer

Turns images into retro pixel art in the browser: reduce the image to a
palette of _n_ colours (k-means), then pixelize it into blocks.

Live: https://fionapreroll.github.io/retroizer/ (deployed from `main`).

## Development

Requires Node.js 24 (see `.nvmrc`) and pnpm (`corepack enable` picks the
version from `package.json`).

```sh
pnpm install
pnpm dev            # dev server with hot reload
pnpm build          # production build into dist/
pnpm check          # lint + format check + typecheck + unit tests
```

| Command          | What it does                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `pnpm test`      | unit and (short) fuzz tests with Vitest                             |
| `pnpm test:fuzz` | property-based fuzz tests (fast-check); `FUZZ_RUNS`, `FUZZ_SEED`    |
| `pnpm soak`      | builds, then runs hundreds of operations in headless Chromium       |
| `pnpm bench`     | builds, then benchmarks; `--root <dir>` measures any other checkout |
| `pnpm format`    | format everything with Prettier                                     |

Playwright needs a Chromium: `pnpm exec playwright install chromium` (or set
`CHROMIUM_PATH`).

## How it works

- `src/core/` – DOM-free algorithms, shared by the worker, the main-thread
  fallback and the tests.
    - `quantize.ts` – images with at most _n_ colours keep them exactly;
      otherwise pixels are collapsed into a 32768-bin colour histogram
      (exact bin means, weighted by pixel count) and clustered with weighted
      k-means and deterministic k-means++ seeding. Mapping back to the
      palette is exact, with a small cache for repeated colours.
    - `pixelize.ts` – every block takes its top-left pixel, filled as 32-bit
      words.
    - `pipeline.ts` – palettize / pixelize / retroize with progress reports.
- `src/worker.ts` + `src/renderer.ts` – operations run in a Web Worker, so the
  page never freezes; falls back to the main thread if workers fail.
- `src/ui/` – status display, palette panel, undo/redo history.

## CI

GitHub Actions (`.github/workflows/`):

- **CI** on every push and pull request: lint, format check, typecheck, unit
  tests with coverage, fuzz tests (5000 runs per property), soak test and
  benchmark (results in the job summary). On `main`, a green run deploys
  `dist/` to GitHub Pages.
- **Nightly**: long fuzz run (100 000 runs per property) and a 2000-operation
  soak test at 1920×1080.
- **Dependabot** keeps npm packages and actions up to date (weekly).

## License

GPL-3.0-only, see [LICENSE](LICENSE).
