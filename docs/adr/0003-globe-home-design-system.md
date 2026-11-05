# A three.js globe home with the Visual language board's dark design system

Supersedes [0002](0002-seismograph-design-system.md).

The app is rebuilt as one page: a full-screen globe with glass overlays, following the "Design" page of the [Quake Watch — Visual language](https://claude.ai/artifact/9to4jj5c7d7QzPowNUcFR4) board.

## Globe

- The globe is drawn with three.js through React Three Fiber. The board's key idea is that each Earthquake sits at its Depth inside a see-through Earth, and MapLibre's globe projection can't show anything below the surface.
- three.js leaves room for the Depth explorations still in design (globe cut open, tilted area). It was removed with the old UI in [#80](https://github.com/Vizzuality/quake-watch/issues/80) and comes back with the globe.
- MapLibre and react-map-gl are removed.

## Design system

- **Theme:** dark only for now.
- **Fonts:** Inter Tight for text, Geist Mono for codes and numbers.
- **Colour roles:**
  - background `#05050B`;
  - white text, with four muted steps from `#C9CAE6` to `#7C7FA6`;
  - borders `#23253F`;
  - focus `#6D72C9`.
- **Surfaces:** glass, a translucent fill with `backdrop-filter: blur(16px)`.
- **Radius:** 1000 px pills, 24 px cards.
- **Encoding:**
  - Colour encodes Depth: `#FF9A4D` at 0 km, `#FF5E6C` at 70 km, `#C04FD8` at 300 km, `#4F7BFF` at 700 km.
  - Size and Shaking-wave strength encode Magnitude, so Magnitude never depends on colour.
  - Felt reach is a filled ring, and an Earthquake that wasn't felt at the surface is a hollow ring.
- **Light theme later:** tokens are named by role (background, muted, border, glass), so a light theme can redefine them without touching components ([#101](https://github.com/Vizzuality/quake-watch/issues/101)).

## Considered Options

- **Port the board's hand-made 2D canvas renderer.** Closest to the board pixel for pixel, but it runs on the CPU and is a dead end for the Depth explorations.
- **MapLibre globe projection.** Reuses the old map stack and basemap, but drops the Earthquakes-at-Depth idea.
- **Keep the Seismograph system from 0002.** Light and dark, IBM Plex and a magenta Magnitude scale. It conflicts with the board, where colour carries Depth instead of Magnitude.
