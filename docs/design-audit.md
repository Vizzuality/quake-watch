# Design audit

State of the UI on 2026-10-15, before the redesign. Issues are ordered by impact on the audience: people who are not seismologists and want to know where an Earthquake happened, how big it was and what it meant for the places they care about.

## Method

- Screenshots of every view with Playwright at 1440 × 900 and 390 × 844, in English and Spanish: table and map (default, a Place of interest with filters, custom dates on USGS, empty, loading, error), the EMSC and USGS detail pages, the detail page for an unknown ID, the 404 page and, at 390 px, the filters sheet. That is 66 captures. Loading and error states were forced by delaying or aborting requests to the FDSN `query` endpoint.
- [Impeccable](https://github.com/pbakaus/impeccable) `audit`. Its mechanical detector (`impeccable detect`) found nothing in `src/components`, `src/containers` or `src/styles.css`, so every finding below comes from screenshots, measurements and reading the code.
- [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines), checked against the components, with `file:line` references.
- Measurements: WCAG contrast ratios, CIELAB ΔE between magnitude colours (normal vision, and deuteranopia and protanopia simulated with Machado et al. 2009), and hit-target sizes from `getBoundingClientRect` at 390 px.

## Score (Impeccable audit)

| #   | Dimension                | Score       | Key finding                                                                                   |
| --- | ------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| 1   | Accessibility            | 3           | Touch targets of 16–32 px on mobile; no skip link                                             |
| 2   | Performance              | 3           | No issues worth acting on; tables are paginated to 50 rows                                    |
| 3   | Theming                  | 2           | Six colour tokens; type, spacing, radii and every data palette are hard-coded                 |
| 4   | Responsive               | 2           | At 390 px the map overlays cover about 43 % of the screen, and the map has no filters         |
| 5   | Implementation integrity | 2           | Coherent but generic: system font, one weight, no hierarchy, nothing specific to this product |
|     | **Total**                | **12 / 20** | **Acceptable: a lot of work needed**                                                          |

**Integrity verdict: fail on character, pass on correctness.** The code is clean, labelled and consistent. The look could belong to any dark-mode admin table, and none of the domain knowledge already in the code (Intensity levels, Felt reach, the Shaking wave) shows up on the two main screens.

## P0: the core question isn't answered at a glance

### 1. Nothing tells you what a Magnitude means

The table and the cards show a bare number (`3.4`) and a magnitude type (`mb`, `ml`) that a non-expert can't interpret. The detail page goes into great depth (Crustal block, Location details), but the list never answers "is this one a big deal?". The domain logic is already there: `getFeltReachKm` (`src/lib/earthquakes/intensity.ts:71`) and the Intensity level names in `messages/` (`intensity_level_light`, `…_moderate`, `…_strong`). Neither is used in the table, the cards or the map tooltip.

- Where: `src/containers/search/columns.tsx`, `src/containers/search/cards.tsx`, `src/containers/map/epicenter-tooltip.tsx`
- Watch out: CONTEXT.md separates Magnitude (one per Earthquake) from Intensity (per place). A plain-language line has to be about Felt reach or the estimated Intensity at the Place of interest. It must not say a Magnitude is "strong".

### 2. The magnitude colour scale fails exactly where it matters

`MAGNITUDE_COLOR_STOPS` (`src/lib/earthquakes/magnitude.ts:14-21`) runs from light yellow to rose on a dark map.

| Step      | ΔE normal        | ΔE deuteranopia | ΔE protanopia |
| --------- | ---------------- | --------------- | ------------- |
| M2.5 → M4 | 34               | 30              | 32            |
| M4 → M5   | 43               | **16**          | 27            |
| M5 → M6   | 35               | 25              | 38            |
| M6 → M7   | **14**           | **11**          | **16**        |
| M7 → M8   | **0** (same hex) | 0               | 0             |

- The biggest Earthquakes are the hardest to tell apart. M7 and M8 are identical.
- Lightness goes _down_ as Magnitude goes up (L\* 91 → 49), so on the dark basemap the most important dots have the _lowest_ contrast: 15.6:1 for M2.5 against 4.1:1 for M7. On a light basemap the M2.5 yellow (L\* 91) would disappear.
- In the table, M2.5–M3.9 all share one swatch (`getMagnitudeColor` uses step stops), so 36 of the first 50 rows on the default view (72 %) look the same.

### 3. The map view can't be filtered

`MapLayout` (`src/containers/map/layout.tsx`) has no filters. To change the place, period, minimum Magnitude or catalogue you have to switch to Table, change it there and switch back. The URL is shared, but the controls aren't. This hits mobile hardest, where the map is the more natural view.

## P1: hierarchy, legibility and mobile

### 4. The map's count and its dots disagree

With `period=30d`, the header says "24 earthquakes", but the playback starts at the end of a 24-hour Playback window, so one dot is visible (`1440-en-map-filters`). Nothing explains that the timeline is filtering what you see. The window selector ("Last 24 hours / Last 7 days") sits next to the slider with no label that ties it to the dots.

### 5. The magnitude legend covers only part of the scale

`SAMPLES = [4, 5, 6]` (`src/containers/map/legend.tsx:4`). The default minimum is M2.5 and the scale runs to M8, so the most common and the most serious dots have no key. The legend shows colour and size but not what they mean.

### 6. Mobile map: overlays eat the map

At 390 × 844 the header (~100 px), legend, timeline and attribution stack up to about 364 px of 844 (43 %). The legend floats on its own row between the map and the timeline. The attribution wraps to two lines.

### 7. No typographic hierarchy

- `font-sans` is the system UI stack (`src/styles.css:10`). The page title is `text-lg` and the map title is `text-base`. Body, place names and numbers all use the same weight and family.
- Place names from EMSC arrive in mechanical title case ("Off E. Coast Of N. Island, N.z.", "Myanmar-india Border Region"). That's a data-formatting issue, flagged here and out of scope for the visual redesign.
- Number columns (Depth, Distance) don't use `tabular-nums` (`src/containers/search/columns.tsx:59`, `:64`), so the digits don't line up.

### 8. Touch targets below 44 px on mobile (measured at 390 px)

| Control                         | Size             | Where                                                                     |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| EN / ES                         | 16 × 16          | `src/containers/shell/language-switch.tsx:15`                             |
| Table / Map tabs                | 51 × 24, 45 × 24 | `src/containers/shell/view-tabs.tsx:11`                                   |
| Filters, Play, buttons, selects | 32 px tall       | `src/components/ui/button.tsx:16`, `src/components/ui/select.tsx:9`       |
| Playback slider                 | 32 px tall       | `src/containers/map/timeline/playback-controls.tsx:65`                    |
| Place link in a card            | 280 × 20         | `src/containers/search/cards.tsx` (the card around it isn't the hit area) |

### 9. Loading, empty and error states are bare

- **Table loading**: eight identical grey bars, and the summary line is missing (`src/containers/search/summary.tsx:39` returns `null`), so the layout jumps when the data arrives.
- **Table error**: a red line, "Couldn't reach EMSC.", and an empty table header below it. It doesn't suggest switching to USGS, though the catalogue is one click away.
- **Map error**: red text in the header and an empty slider with its thumb at mid-track. There's no retry and no catalogue switch (`src/containers/map/header.tsx:51`).
- **Map empty**: "No earthquakes to play". The table's "Widen radius / Widen to last 7 days" suggestions don't exist on the map.
- **Map loading (mobile)**: a 112 px empty skeleton block where the timeline goes.
- **404**: one line and a button, centred in an empty viewport. There's no header and no way to switch language.

## P2: system and guidelines

### 10. Tokens cover colour only, and partly

`@theme` defines six colours. There are no tokens for type scale, spacing, radii, shadows or motion. Data palettes are hex literals in TypeScript:

- Magnitude: `src/lib/earthquakes/magnitude.ts:15-20`
- Shaking wave: `src/lib/map/shaking-waves.ts:29-33`
- Map layers: `src/components/map/layers.ts:50`, `:62`, `:75`, `:77`
- Crustal block: `src/containers/earthquake-detail/crustal-block/crustal-block-scene.tsx:58-60`, `crust-palette.ts`
- Wave fronts: `src/containers/earthquake-detail/shared/shaking/wave-fronts.tsx:8-9`
- Felt reports: `src/lib/felt-reports/bubbles.ts:35`

Arbitrary values: `text-[10px]` (`src/containers/map/timeline/histogram.tsx:185`), `text-[11px]` (`crustal-block-scene.tsx:218`, `:245`), `h-[72px]` (`timeline.tsx:173`), `h-[3px]` (`shaking-legend.tsx:58`).

### 11. Web Interface Guidelines

```text
## src/routes/__root.tsx
src/routes/__root.tsx:44 - dark UI without `color-scheme: dark` on <html>; native date inputs and scrollbars render light
src/routes/__root.tsx:16 - no <meta name="theme-color">
src/routes/__root.tsx:48 - no skip link to main content

## src/containers/search/place-search.tsx
src/containers/search/place-search.tsx:102 - placeholder doesn't end with "…" or show an example
src/containers/search/place-search.tsx:102 - search input without autocomplete="off" / name / spellCheck={false}

## src/containers/search/columns.tsx
src/containers/search/columns.tsx:59 - distance column without tabular-nums
src/containers/search/columns.tsx:64 - depth column without tabular-nums

## src/components/ui/sheet.tsx
src/components/ui/sheet.tsx:13 - scrollable sheet without overscroll-behavior: contain

## src/containers/map/timeline/histogram.tsx
src/containers/map/timeline/histogram.tsx:185 - 10px axis labels (below a legible minimum on mobile)

## EMSC / USGS labels (filters, summary, detail header)
- brand names without translate="no"

## Headings (detail sections, empty / not found)
- no text-wrap: balance on headings
```

Passes: no `transition: all`, no `outline-none` without a replacement, icon buttons have `aria-label` (`place-search.tsx:130`, `:136`), URL holds every filter, the Shaking wave honours `prefers-reduced-motion` (`src/containers/map/shaking-waves.tsx:62`), no horizontal scroll at 390 px, loading copy uses `…`.

### 12. Basemap

`MAP_STYLE_URL` is OpenFreeMap `dark` (`src/components/map/basemap.ts:1`). Labels show English and local names ("RUSSIA / РОССИЯ") in both UI languages, so the Spanish UI gets English country names. The basemap is about as loud as the data: country borders and labels compete with M2.5 dots.

## P3: polish

- The detail-page minimap frames the Epicenter so tightly that ocean Earthquakes show no land for context (`detail-minimap.tsx`).
- The detail header puts "Your time", "UTC", Depth and Epicenter at equal weight. Place and Magnitude need to dominate.
- "What does this mean?" disclosures repeat under every section with the same visual weight as the headings.
- The favicon is a plain off-white dot (`src/routes/__root.tsx:11`).

## What works

- Every visible string goes through Paraglide, and EN and ES are at parity (`src/lib/i18n/messages-parity.test.ts`).
- Detail pages explain things carefully, and separate what is real from what is recreated.
- `prefers-reduced-motion` is wired into the Shaking wave and ShakeMap playback.
- Contrast for body text passes AA: muted on ink is 5.99:1, muted on surface 5.32:1, danger on ink 7.03:1.
- No horizontal overflow at 390 px. The filters sheet works and shows the number of active filters.
- The table and the map share the URL state, as specified.

## Recommended order

1. `$impeccable shape`: decide what "what it meant" looks like in a row, a card and a map tooltip, using Felt reach and Intensity (P0 #1).
2. `$impeccable colorize`: a magnitude scale whose lightness rises with Magnitude and stays distinct under CVD, on both a light and a dark basemap (P0 #2, P2 #12).
3. `$impeccable adapt`: filters on the map, and the mobile overlay budget (P0 #3, P1 #6, #8).
4. `$impeccable typeset` and `$impeccable layout`: type with character, hierarchy, density (P1 #7).
5. `$impeccable clarify` and `$impeccable harden`: loading, empty and error states, plus the Playback window's relation to the count (P1 #4, #9).
6. `$impeccable extract`: move every palette and arbitrary value into tokens (P2 #10).
7. `$impeccable polish`.
