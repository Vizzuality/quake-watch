# A three.js globe home with the Visual language board's dark design system

Supersedes [0002](0002-seismograph-design-system.md).

The app is rebuilt as one page: a full-screen globe with glass overlays, following the "Design" page of the [Quake Watch — Visual language](https://claude.ai/artifact/9to4jj5c7d7QzPowNUcFR4) board.

## Globe

- The globe is drawn with three.js through React Three Fiber. The board's key idea is that each Earthquake sits at its Depth inside a see-through Earth, and MapLibre's globe projection can't show anything below the surface.
- three.js leaves room for the Depth explorations still in design (globe cut open, tilted area). It was removed with the old UI in [#80](https://github.com/Vizzuality/quake-watch/issues/80) and comes back with the globe.
- MapLibre and react-map-gl are removed.

## Design system

Follows the [QW · Handoff](https://www.figma.com/design/8eNSPpbMBnR6bGNEdO9CGc/Vizz-lab-%F0%9F%A5%BC?node-id=1397-673) section of the Figma file. It is still a work in progress, so each change re-reads it at implementation time. The tokens live in `src/styles.css`.

- **Theme:** dark only for now.
- **Font:** Space Grotesk (300, 400, 500, 700), self-hosted. No monospace on the web. The OG share cards keep Inter Tight and Geist Mono until [#98](https://github.com/Vizzuality/quake-watch/issues/98).
- **Type roles:** one token per QW/* text style, 23 in all (size px / weight / line-height / tracking). Label, Label S, Caption, Caption Bold, Button, Country and Sea are uppercase.
  - label 10/700/1.2/0.15em · label-s 9/500/1.2/0.18em · caption 10/500/1.3/0.2em · caption-bold 10/700/1.3/0.2em · button 11/500/1.2/0.2em · country 10/500/1.2/0.32em · sea 10/300/1.2/0.3em;
  - body-s 12/400/1.4 · body 14/400/1.5 · lead 15/300/1.25 · place 11/400/1.2 · place-l 17/400/1.25;
  - title 28/300/1.15 · title-m 30/300/1.1 · value 26/300/1.2 · value-m 30/300/1 · value-s 22/300/1.25 · tooltip-value 28/300/1;
  - stat 42/300/1/−0.02em · display 38/300/1.05/−0.02em · numeral-m 72/300/0.95/−0.04em · numeral-l 52/300/1/−0.02em · numeral-xl 250/300/1/−0.05em.
- **Colour roles:**

  | Role                                   | Value                    |
  | -------------------------------------- | ------------------------ |
  | background (under the gradient)        | `#171A33`                |
  | text                                   | `#E6E4F5`                |
  | muted                                  | `#A09DC1`                |
  | accent, focus ring (2 px, 3 px offset) | `#EB598E`                |
  | hairline                               | `rgba(185,182,224,0.16)` |
  | tick                                   | `rgba(230,228,245,0.3)`  |
  | control line                           | `rgba(185,182,224,0.25)` |
  | sheet line                             | `rgba(185,182,224,0.2)`  |
  | toast line                             | `rgba(235,89,142,0.7)`   |
  | handle                                 | `rgba(230,228,245,0.35)` |
  | selected fill / text on it             | `#E6E4F5` / `#171A33`    |

  Figma's muted is `#8A87B0`, which reaches only 3.5:1 on the plum corner of the gradient; `#A09DC1` is the same hue mixed 24% towards the text colour and passes 4.5:1 everywhere.

- **Surfaces:** a translucent `#171A33` fill with `backdrop-filter: blur()`:
  - panel 0.2 with 14 px blur;
  - tooltip 0.2 with 100 px blur;
  - toast 0.6 with 24 px blur;
  - sheet 0.62 with 24 px blur;
  - modal 0.55 with 100 px blur;
  - scrim `rgba(12,13,30,0.45)` with 6 px blur.
- **Radius:** 999 px pills, 6 px modals, 18 px sheets (top corners), 2 px handles.
- **Background:** one navy-to-plum gradient over `#171A33` for every width.
- **Encoding:**
  - Colour encodes Depth: `#FF9A4D` at 0 km, `#FF5E6C` at 70 km, `#C04FD8` at 300 km, `#4F7BFF` at 700 km.
  - Size and Shaking-wave strength encode Magnitude, so Magnitude never depends on colour.
  - Felt reach is a filled ring, and an Earthquake that wasn't felt at the surface is a hollow ring.
- **Light theme later:** tokens are named by role (background, muted, line, glass), so a light theme can redefine them without touching components ([#101](https://github.com/Vizzuality/quake-watch/issues/101)).

## Considered Options

- **Port the board's hand-made 2D canvas renderer.** Closest to the board pixel for pixel, but it runs on the CPU and is a dead end for the Depth explorations.
- **MapLibre globe projection.** Reuses the old map stack and basemap, but drops the Earthquakes-at-Depth idea.
- **Keep the Seismograph system from 0002.** Light and dark, IBM Plex and a magenta Magnitude scale. It conflicts with the board, where colour carries Depth instead of Magnitude.
