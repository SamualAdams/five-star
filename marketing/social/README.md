# five\* social post kit

Eight posts that read as one campaign. The brand frame is shared and never edited
per-post; only the interior changes. That's the whole trick — see
[shared/frame.css](shared/frame.css) for the contract and
[shared/layouts.css](shared/layouts.css) for the interiors.

## Doing something

```bash
cd marketing/social

node check.mjs           # does everything still fit? run this first, always
node render.mjs          # all 8 posts x 3 formats -> export/
node render.mjs 04       # just post 04
node render.mjs 04 --square
```

`export/` is gitignored — it is always regenerable from source, so nothing is
lost by deleting it.

`check.mjs` exists because `.frame` is `overflow: hidden`: a post whose interior
grew too tall does not error, it just renders **without a footer**. Run it before
every export. It catches three things — footer pushed off canvas, anything wider
than the 888px column, and a hand-broken headline line that silently wrapped.

## The eight posts

The set is a story arc. Colour tracks the arc: red is the problem, teal is what
five\* does about it, which is why posts 5–8 contain no red at all.

| # | File | Arc | Layout | Line |
|---|---|---|---|---|
| 1 | [01-score-not-a-clue](posts/01-score-not-a-clue.html) | Problem | statement | A bad review gives you a score, *not a clue.* |
| 2 | [02-never-say-a-word](posts/02-never-say-a-word.html) | Problem | struck list | Your quietest customers *say nothing at all.* |
| 3 | [03-same-experience](posts/03-same-experience.html) | Why reviews fail | split columns | Same experience. Very different signal. |
| 4 | [04-frozen-moment](posts/04-frozen-moment.html) | Why reviews fail | timeline | A public review is one *frozen moment* in time. |
| 5 | [05-listening-mark](posts/05-listening-mark.html) | How it works | photo | A quiet way to say what *actually happened.* |
| 6 | [06-one-clear-report](posts/06-one-clear-report.html) | How it works | numbered steps | One clear report built from *many submissions.* |
| 7 | [07-two-cents](posts/07-two-cents.html) | Outcome | big figure | That's what it costs to hear the *whole story.* |
| 8 | [08-help-you-improve](posts/08-help-you-improve.html) | Outcome | brand closer | Give customers a way to help you *improve.* |

All copy is drawn from the live marketing page
([MarketingPage.jsx](../../frontend/src/components/MarketingPage.jsx)) so the
posts and the site say the same thing in the same voice. The 2¢ figure on post 7
is the site's own pricing claim — if pricing changes, that post changes.

## Formats

`?f=` picks the canvas. Width is always 1080 so the type scale is identical
everywhere; only vertical distribution changes.

| Format | Size | Where |
|---|---|---|
| `square` | 1080×1080 | Facebook feed, Instagram square |
| `portrait` | 1080×1350 | Instagram feed — **the recommended one** |
| `story` | 1080×1920 | Stories / Reels (300px top+bottom safe inset) |

Square is the tightest canvas — roughly 670px of interior. If a layout fits
square it fits the other two.

## Making a ninth post

1. Copy the closest existing post file. They are ~35 lines: a kicker and an
   interior block, nothing else.
2. Pick a layout class from `layouts.css`. If none fits, add a **new reusable
   module** there — do not add per-post CSS, and do not edit `frame.css`.
3. Break the headline by hand into `.l1` / `.l2`. Never let it auto-wrap, never
   more than two lines.
4. `node check.mjs 09`, then `node render.mjs 09`.

The four rules a layout module must obey are written at the top of
`layouts.css`. The one people break first: **at most one red element per post.**

## Fonts

Manrope and Newsreader are vendored as woff2 in `shared/fonts/` rather than
pulled from Google. Renders are then deterministic and offline-capable, and it
removes the race where a screenshot fires before a webfont arrives.

Note the vendored spec deliberately omits Newsreader's italic axis. The headline
italics are the browser-synthesised oblique, which is what was approved on post 1
— adding the true italic changes the artwork.
