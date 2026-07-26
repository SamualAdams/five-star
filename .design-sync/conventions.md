# Building with the five* design system

**This design system is mostly CSS.** It ships two React components; everything else — layout,
buttons, fields, panels, type — is a class vocabulary defined in `styles.css` on top of the tokens
in `:root`. Build screens the way the app does: semantic HTML plus these classes. Reach for a token
or a class before writing a new colour, radius, or shadow.

## Type

Two families, both loaded by `styles.css`:

- `var(--font-sans)` — **Manrope**. Everything interface: body copy, labels, buttons, nav, the
  wordmark. Weights 400/500/600/700/800. The brand leans hard on **800** for anything that carries
  weight; 500–600 for running copy.
- `var(--font-serif)` — **Newsreader**. Display only: page and section titles. Set with tight
  leading and negative tracking (`line-height: 1.02`, `letter-spacing: -0.03em`) — that pairing is
  the brand's whole typographic signature, so keep it when you use the serif.

Never mix the serif into UI chrome, and never set a heading in Manrope where the page already has a
Newsreader title — the contrast between the two is the hierarchy.

## Colour

Ink is the text colour, teal is the brand, and both are quiet. There is no bright accent.

| Token | Use |
|---|---|
| `--color-ink` `#173c45` | headings, emphasised text |
| `--color-ink-soft` `#2a5660` | labels, secondary headings |
| `--color-text` `#304d4f` | body copy |
| `--color-muted` `#6b7978` | supporting copy, captions |
| `--color-primary` `#087c80` | the brand teal — primary actions, kickers, links |
| `--color-primary-hover` / `--color-primary-soft` | hover state / tinted teal wash |
| `--color-bg` `#fdfdfc` | page |
| `--color-surface` `#ffffff`, `--color-surface-alt` / `-subtle` / `-muted` / `-tint` | cards and panels, warm-neutral steps down from white |
| `--color-border` `#dedfdb`, `--color-border-muted` `#eceeeb` | hairlines |
| `--color-on-dark` `#f5fafa` | text on an ink surface |
| `--color-success` / `--color-warning` / `--color-danger` (+ `-bg`, `-hover`) | semantic states only |
| `--color-disabled`, `--color-neutral*`, `--color-star-muted`, `--color-avatar` | supporting neutrals |

`--color-danger` is for genuine problems, not emphasis. Most of the brand's expressive range comes
from ink-on-warm-white with teal used sparingly.

## Shape and elevation

Radii step by role, so pick by what the thing *is* rather than by size:
`--radius-sm` 8 · `--radius-control` 12 (inputs) · `--radius-card` 16 · `--radius-panel` 22 ·
`--radius-section` 28 · `--radius-pill` 999 (buttons are always pills).

Shadows are wide and very soft — `--shadow-control`, `--shadow-card`, `--shadow-soft`,
`--shadow-overlay`. Don't hand-roll a `box-shadow`; the softness is part of the look.

## The class vocabulary

These are the reusable parts. Each is `block` plus `block--modifier`.

- **`.btn`** — pill, Manrope 800, inline-flex with `gap` so an icon just works. Variants
  `--primary` (teal, lifts on hover), `--ghost` (hairline outline), `--outline`, `--danger`; sizes
  `--sm`, `--large`. `:disabled` is styled for you.
- **`.field-label` / `.field-input` / `.field-textarea` / `.field-select`** — full-width controls
  with a teal focus ring. `.inline-form` lays a field and a button out on one row.
- **`.section-shell` / `.section-header` / `.section-kicker` / `.section-title` / `.section-copy`** —
  the standard content block. The kicker is uppercase teal Manrope 800 with wide tracking; the title
  is Newsreader. This trio is how nearly every section on the site opens.
- **`.modal-backdrop` / `.modal-card` / `.modal-title` / `.modal-subtitle` / `.modal-close`** — dialogs.
- **`.menu-wrap` / `.menu-panel(--open)` / `.menu-section` / `.menu-item` / `.menu-divider` /
  `.menu-kicker`** — dropdown menus.
- **`.tabs` / `.tab(--active)`** — tab strip.
- **`.brand-lockup`**, and `.brand-name` / `.brand-name-mark` behind the `BrandName` component below.
- **`.layout(--public)`**, `.message(--error)`, `.url-display` / `.url-input`.

**Page-scoped families are not reusable parts.** `demo-*`, `marketing-*`, `public-*`, `auth-*`,
`home-*`, `dashboard-*`, `comparison-*`, `review-*`, `search-*`, `digest-*`, `settings-*`,
`invite-*`, `members-*`, `feedback-*`, `org-*`, `why-*`, `silent-*`, `problem-*`, `constructive-*`
and `topbar-*` are the app's own screens. They ship in the stylesheet because it ships whole — read
them for reference, but compose new work from the primitives above, not from a marketing-page class.

## Components

Only two, because only two carry brand meaning a class cannot express.

- **`BrandName`** — renders `five*` with the real asterisk mark. It is `color: inherit` and
  `font: inherit`, and the mark is sized in `em`, so it takes on whatever type it's placed in. Use it
  anywhere the product is named in JSX. Never type `five*` as literal text.
- **`BrandedText`** — takes a **plain string** and swaps every literal `five*` for a `BrandName`.
  This is for brand copy that lives in data (content arrays, CMS strings) rather than in JSX. It
  takes a string child, not markup.

## Writing the name

It is `five*`, lowercase, with the asterisk as a raised mark — never "Five Star", "5-star", or a
literal `*` glyph in rendered copy. In prose the brand is a quiet noun: "five\* turns feedback into a
report", not "The Five Star Platform™".
