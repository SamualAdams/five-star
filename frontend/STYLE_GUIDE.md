# five* visual system

The source of truth for the product's visual tokens is [`src/theme.css`](src/theme.css). Change palette, typography, shape, and elevation values there; components and `styles.css` should consume tokens instead of defining colors directly.

## Palette

| Role | Token | Current use |
| --- | --- | --- |
| Primary | `--color-primary` | Main actions, links, focus states, active controls |
| Ink | `--color-ink` | Headlines, browser chrome, high-emphasis UI |
| Text | `--color-text` | Standard body and interface copy |
| Muted | `--color-muted` | Supporting copy and metadata |
| Canvas | `--color-bg` | Page background |
| Surface | `--color-surface` | Cards, panels, inputs, menus |
| Alternate surfaces | `--color-surface-alt` through `--color-surface-tint` | Subtle hierarchy without colored page washes |
| Status | `--color-success-*`, `--color-warning-*`, `--color-danger-*` | Semantic feedback only |

Use `color-mix(in srgb, var(--color-primary) 14%, transparent)` when an alpha variant is needed. This keeps every tint connected to its base token.

## Typography

- `--font-sans`: interface controls and body copy.
- `--font-serif`: editorial headlines and digest summaries.
- Keep dashboard and settings headings compact; reserve the largest serif sizes for marketing sections.

## Shape and elevation

- Controls use `--radius-control`; cards use `--radius-card` or `--radius-panel`; major marketing sections use `--radius-section`.
- Use the shared shadow tokens. Operational app screens should favor borders and `--shadow-card`; `--shadow-soft` is reserved for major marketing surfaces.
- Pills are for statuses, compact modes, and clear actions, using `--radius-pill`.

## Guardrail

Run `npm run check:theme` to verify that colors remain centralized. The check rejects raw hex, RGB, and HSL values anywhere in `src` except `theme.css`.
