# Seismograph design system with light and dark themes

The interface had one dark palette of six colors, the system font and a yellow-to-red Magnitude scale. Its two strongest classes were nearly identical (M7 and M8 shared one color), and on the dark map they had the least contrast. We adopt the Seismograph direction: IBM Plex Sans for text, IBM Plex Mono for Magnitude and other short codes, and tabular figures for every other number, cool neutrals, and a single magenta hue for Magnitude.

The interface ships a light and a dark theme. It follows the device setting until the person picks one with the theme switch; the choice is kept in `localStorage` and applied by an inline script before first paint, so the page never flashes the wrong theme. Every color is a token in `src/styles.css`, redefined per theme. MapLibre can't read CSS variables, so `getMapPalette` reads the resolved token values for map layers.

Magnitude is shown in six classes (below 3, 3, 4, 5, 6, 7 and above), each a step of one hue whose lightness changes by at least 0.06 (OKLCH) per class. Color-blind readers therefore tell classes apart by lightness, and dot size still grows with Magnitude. On the light theme the scale gets darker as Magnitude grows; on the dark theme it gets lighter, so the strongest Earthquakes always have the most contrast against the basemap. Both ramps pass an ordinal palette check against the real OpenFreeMap backgrounds (Positron for light, Dark for dark). Text on a Magnitude badge uses a color paired with each class so it stays at least 4.5:1.

Basemap labels use the name in the interface language when OpenStreetMap has one.

## Considered Options

- An editorial light-only direction (Schibsted Grotesk and Public Sans on a cartographic grey, vermilion scale): calm and printable, but a red-orange scale competes with warnings and the product would lose the dark live view.
- Dark only: closest to the live 24-hour use, but hard to read in daylight and for people who find dark screens tiring.
- An interpolated color scale, as before: smoother on the map, but table badges and the legend can't name the class a color stands for.
