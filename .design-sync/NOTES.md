# design-sync notes — five-star-frontend

## What this repo actually syncs

This app has **no component library**. All 17 React exports under `frontend/src/components/` are
API-bound page screens (auth, dashboard, marketing, demo) — there is no `dist/`, no lib build
target, no Storybook. Syncing them would put unbuildable screens in the design project.

So the design system here is **the CSS plus the brand mark**: 51 tokens in `theme.css`, the class
vocabulary in `styles.css`, and `BrandName`/`BrandedText` — the only genuinely reusable React in
the repo. `frontend/src/design-system.js` is the public surface and exists solely for this sync;
adding a component to the design system means exporting it there.

The user chose this scope explicitly on the first run (2026-07-25): tokens + CSS + brand mark, no
page components.

## Repo-specific gotchas

- **`--entry` must be `frontend/src/design-system.js`, not `./src/…`.** PKG_DIR is derived by
  walking up from `dirname(resolve(--entry))` looking for a `package.json` with a `name`. A
  root-relative `./src/...` resolves against the repo root, finds the wrong package, and fails with
  `ENOENT <root>/src/package.json`. The tell that it picked the wrong package: the build banner
  reports `five-star-frontend@0.0.0` instead of `@0.1.0`.
- **`cssEntry` is copied verbatim, so relative `@import`s inside it will not resolve** from the
  output dir. The app loads `theme.css` and `styles.css` as two separate imports; they have to be
  **concatenated**, which is what `frontend/scripts/build-ds-css.mjs` (wired as `buildCmd`) does.
  Order is load-bearing twice: theme first because `styles.css` reads its custom properties, and
  theme's webfont `@import` must stay the very first statement or CSS drops it.
- **Root-relative asset urls must be inlined.** `.brand-name-mark` masks
  `url("/brand/five-star-asterisk.svg")`, which resolves against `public/` in the app but against
  *nothing* in a design project — the asterisk would render invisible in every design built with
  the system, with no error anywhere. `build-ds-css.mjs` rewrites any `url("/…")` that resolves
  under `frontend/public/` into a base64 data URI (2 assets today). If a new brand asset is
  referenced from CSS, it is handled automatically; if it lives outside `public/`, it is left alone
  and will break silently.
- **`@types/react` is not in `frontend/node_modules`**, so the build prints `[DTS_REACT]`. It is
  non-blocking here only because `cfg.dtsPropsFor` hand-supplies both prop bodies. Adding a third
  component means either installing `@types/react` or adding its props by hand too.
- **`typescript` is not in the repo's node_modules either**, so validate skips the `.d.ts` parse
  check. Installing `typescript` into `.ds-sync/` (alongside `playwright`) turns it back on.
- Both components are `cardMode: "column"` — every cell is a full-width copy block, and in the
  default multi-column grid the text clipped mid-word.

## Known render warns

- `[FONT_REMOTE] "Manrope", "Newsreader"` — **expected, leave it.** `theme.css` opens with a Google
  Fonts `@import`, so the families load at runtime and nothing needs shipping. There *are* locally
  vendored woff2 files at `marketing/social/shared/fonts/`, but that set deliberately omits
  Newsreader's italic axis (the social kit wants the browser-synthesized italic), so wiring them via
  `extraFonts` would be a downgrade, not a fix. Do not "resolve" this warn.

## Re-sync risks

- **The conventions doc is hand-written and will rot.** `.design-sync/conventions.md` enumerates
  token names and class families read off `styles.css` on 2026-07-25. Tokens added or renamed in
  `theme.css`, or a new primitive family in `styles.css`, will not show up there on their own —
  re-read both files against the doc on any re-sync that follows real CSS churn.
- **The page-scoped/primitive split is a judgement call, not a rule the code enforces.** The doc
  lists `demo-*`, `marketing-*`, `auth-*` etc. as app screens and everything else as reusable. A new
  class family lands on neither list until someone decides.
- **Preview copy is transcribed from `MarketingPage.jsx`**, not imported from it. If the marketing
  copy changes, the preview cells keep quoting the old wording — harmless, but they stop being
  examples of live copy.
- **The render check needs playwright + chromium**, installed into the gitignored `.ds-sync/`. A
  fresh clone has neither: re-run `npm i playwright typescript` in `.ds-sync/` and
  `npx playwright install chromium`, or validate fails `[RENDER_SKIPPED]`.
- The webfonts are fetched from Google at render time, so the render check assumes network. Offline,
  cards render in fallback faces and a font regression would not be visible.
