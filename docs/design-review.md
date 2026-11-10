# Kotoba design review

> Historical design review. The later account migration makes every trainer page public, replaces owner GitHub OAuth with optional Clerk accounts, and keeps account data private. See README.md for the current authentication and API behavior.

Direction approved by the user: a personal Japanese study notebook, with public statistics and private practice under `/hn`.

This review and its nine-pass process are informed by **unslop**, created by **Damir Sokolovsky ([@heydamir](https://x.com/heydamir))**, licensed **CC BY 4.0**. [Original skill](https://heydamir.design/unslop). The user's requirements for Material 3 Expressive, `@m3e/web`, and a gradient on the main learning surface take precedence over the skill's general preference against hue gradients.

## Direction

- **Product:** A personal Japanese study notebook with progress that visitors can follow.
- **Character:** Calm, attentive, approachable.
- **World:** Neutral paper, dark ink, and Kotoba's existing green accent.
- **Moments:** Real Japanese content and the seven-day activity chart; gradients are confined to the public introduction and private lesson introduction.
- **Signature:** Japanese → reading → Thai meaning, presented as real selectable text.

## Audit findings addressed

- Stat labels previously had approximately 2.95:1 contrast and explanatory captions 2.88:1.
- Mobile labels reached 6.5px, with many 7–10px captions elsewhere.
- Styles used 45 distinct font sizes and nine font weights.
- Uppercase English slogans, trailing periods, repeated motivational copy, and exclamation marks distracted from the task.
- Hero decoration competed with statistics: tilted translucent plaques, leaves, sparkles, and colored shadows.
- The main chart and supporting progress summary lacked a clear size hierarchy.
- A single comparison used multiple bar colors without an explanatory series distinction.
- Missing statistics were partly represented as zero and an assumed current N5 level.
- Spacing values and card padding had accumulated unrelated overrides.
- Numerical figures did not use tabular numerals.
- Progress bars animated their width instead of a transform.

## Pass 1 — Spacing

Replaced the accumulated CSS overrides with grouped, readable rules. Page padding, gaps, cards, and sections use a 4px rhythm. Private navigation is 36px on desktop, with 44px rows on the mobile drawer. Touch actions retain Material button heights. Dense mobile cards stack or simplify rather than shrinking their text.

## Pass 2 — Color

Introduced shared tokens for primary ink `#26332b`, secondary text `#4f5d53`, muted text `#667267`, and the existing accent `#196c58`. Surfaces are near-neutral paper and white; category cards no longer spread four pastel palettes across the interface. Removed the login radial wash and colored object shadows.

Gradients remain on the two main introductions as requested. The activity chart's repeating neutral gradient is only its horizontal reference grid, not a colored decorative surface.

Measured contrast for the selected role/surface pairs:

| Text and surface | Ratio |
| --- | --- |
| Secondary `#4f5d53` on white | 6.95:1 |
| Muted `#667267` on white | 5.04:1 |
| Muted `#667267` on paper `#f8f9f6` | 4.77:1 |
| Intro caption `#42634b` on `#deeaeb` | 5.48:1 |
| Intro body `#465e49` on `#e6eedf` | 5.97:1 |
| White on primary `#196c58` | 6.31:1 |

These are specific measured text/surface pairs, not a claim that every possible component state has undergone a formal accessibility audit.

## Pass 3 — Icons

Kept Lucide and standardized interface icons to 18px and stroke 1.5, with explicit exceptions for the existing logo. Removed ornamental stat icons and the private introduction's sparkle/orbits. Icons remain where they identify an action or destination, including audio, bookmarks, and navigation.

## Pass 4 — Copy

Changed the public heading to “สถิติการเรียนภาษาญี่ปุ่น” and the private heading to “การเรียนวันนี้”. The private hero now names the actual next lesson. Replaced uppercase English slogans with concise Thai context. Removed headline periods and exclamation marks from feedback. Book titles, learning content, audio, flashcards, and OAuth behavior remain intact.

## Pass 5 — Type

Kept DM Sans with Noto Sans Thai and Noto Sans JP for the scripts the product needs. Limited weights to 400/500, with 600 reserved for the wordmark. Text sizes begin at 12px; Japanese teaching characters use a separate display scale. Set tabular numerals globally and removed negative tracking and italic emphasis.

## Pass 6 — Layout

Kept the original section sequence. The public introduction is shorter on desktop. Summary statistics are compact. The level comparison remains first, as a narrow supporting panel; seven-day activity receives the wider panel. On mobile, sections preserve reading order and content stacks without scaling down the interface.

The private app keeps a fluid shell, a 240–256px desktop sidebar, and a 280px mobile drawer. The mobile breakpoint moves early enough to preserve readable content.

## Pass 7 — Details

Replaced arbitrary card radii with a small set; retained purposeful expressive corners on reading cards and the login panel. Stats have labels, numbers, and units rather than decorative filler. Missing progress displays “—” and an explicit empty state, without claiming a current JLPT level. Counts use the same numeric formatting.

## Pass 8 — Visuals

Replaced the floating plaque with an actual existing lesson: 学, がく・まなぶ, เรียน. The private introduction displays the next lesson from the real catalog. The seven-day chart uses one accent for the current day and neutral bars for earlier days, with its range based on the actual maximum and daily goal.

No generated image or image prompt was needed: these are study and statistics screens, and the learning content itself is the visual.

## Pass 9 — Motion

One easing curve, short feedback durations, explicit transition properties. Removed card lift/rotation and animated progress width. Progress uses `scaleX`, daily bars use `scaleY`, and reduced-motion preferences remain supported. No looping decoration or entrance animation was added.

## Verification

- Production build passes.
- TypeScript and all 16 existing tests pass.
- The isolated production access checks pass: public root/API, owner access, rejection of unauthenticated/other/forged sessions, same-origin writes, and private no-store behavior.
- Public statistics visually reviewed on desktop and mobile. Mobile root and login have no horizontal overflow at the inspected viewport.
- Browser inspection confirmed 12px introduction context, 13px stat labels, readable explanatory text, and unknown progress shown as “— / 10”.
- Login copy, configuration notice, and the return-to-statistics link were checked in the browser.
- Real GitHub OAuth still requires the owner's client credentials. Private pages were checked through their source and authorized server-rendered access checks; this pass did not claim a real OAuth browser login or alter the authorization boundary.

No sample progress was published. No authentication or data-storage configuration was changed by this design pass.
