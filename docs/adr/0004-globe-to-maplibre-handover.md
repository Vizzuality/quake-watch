# Close-up zoom hands the globe over to a MapLibre map

Supersedes the line "MapLibre and react-map-gl are removed" in [0003](0003-globe-home-design-system.md). The rest of 0003 stands: the world view is still the three.js globe, with Earthquakes at their Depth.

Past globe zoom 5, a [MapLibre GL JS 6.18.0](https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.18.0) map with [OpenFreeMap](https://openfreemap.org/quick_start/)'s dark style takes over, so a visitor can read roads and place names around an Earthquake. Close up, Depth adds nothing, since the depth line points straight at the screen. Measured on the [spike prototype](https://github.com/Vizzuality/quake-watch/pull/134) for [#114](https://github.com/Vizzuality/quake-watch/issues/114).

## Handover

- **When:** the map mounts hidden once the globe reaches zoom 4 and follows the globe camera on every frame. The globe fades out and the map fades in as the globe zooms from 4.5 to 5. At zoom 5 the next wheel or pinch goes to the map, with no wait. If the map fails to load, an error boundary drops it and the globe stays at zoom 5.
- **Click:** clicking an Earthquake on the globe flies the globe to it at zoom 5, then opens the map framed on its felt ring, or at URL zoom 7 when it has none. A drag or a change of `?quake=` during the flight cancels the switch.
- **Scale:** the map zoom is `log2(2π · R · cos φ / 512)`, where `R` is the globe's radius in screen pixels at zoom 5 and `φ` the centre latitude. MapLibre draws its globe with radius `512 · 2^z / (2π · cos φ)` ([globe_utils.ts](https://github.com/maplibre/maplibre-gl-js/blob/v6.18.0/src/geo/projection/globe_utils.ts#L84-L90)).

  | Viewport | Globe radius at zoom 5 | Map zoom at the equator | Map zoom at 40° | km per px at the centre |
  | -------- | ---------------------- | ----------------------- | --------------- | ----------------------- |
  | 1440×900 | 1650 px                | 4.34                    | 3.96            | 3.9                     |
  | 1440×800 | 1467 px                | 4.17                    | 3.79            | 4.3                     |
  | 390×844  | 447 px                 | 2.46                    | 2.07            | 14.3                    |

  [#114](https://github.com/Vizzuality/quake-watch/issues/114) estimated zoom 5.5 and 3.5 km/px at 1440×800. The measured numbers above replace those estimates.

- **Camera:** the globe is orthographic, while MapLibre's globe is drawn in perspective. A vertical field of view of 0.5° makes the map close enough to orthographic. MapLibre's default camera would be off by up to 129 px in the corners.
- **Centre:** the globe's centre sits slightly below the middle of the screen (`cy = 462/900 · h`). A top padding of `2·cy − h` moves the map's centre onto it.
- **Measured jump:** 9 reference points (the centre and 8 around it, within 8° at 1440×900 and 4° at 390×844):
  - at most 0.08 px between globe and map;
  - centre within 0.000001°.

  Quake markers drawn on the globe land on the right islands on the map: the Azores, the Canaries, Sicily and the Aegean.

- **Projection:** the map starts in `vertical-perspective` and becomes `mercator` by zoom 8, through a `["interpolate", ["linear"], ["zoom"], z₀, "vertical-perspective", 8, "mercator"]` projection, where `z₀` is the handover zoom at the equator. At zoom 7.9 the map is still blending; at 8 it is flat.
- **Crossfade:** the map's opacity is `(zoom − 4.5) / 0.5`, clamped to 0–1, and the globe's is its complement, so the fade follows the zoom gesture instead of a timer. It stays at 0 until the map has drawn its first frame. Measured at zoom 4.5, 4.75 and 5 at 1440×900: at most 0.007 px between globe and map, and opacity exactly linear in zoom. A pinch at 390×844 stayed within 1.14 px.
- **Back to the globe:** zooming out while the map is at its minimum zoom (the handover zoom for the current centre latitude, recomputed after each move) puts the globe back at zoom 5 on the map's centre. Measured on Madrid (at both viewports) and Tokyo, the globe landed at zoom 5 with the centre within 0.000001°.

## Loading

- MapLibre is not in the globe chunk. It loads in its own chunks once the globe reaches zoom 4, and unmounts below 3.5, so a visitor who never zooms in never downloads it. In the browser, nothing from MapLibre or OpenFreeMap was requested below zoom 4.
- Cost when it loads:
  - map chunk: 292 kB gzip;
  - styles: 10 kB gzip;
  - MapLibre's worker: 148 kB gzip.

  The globe chunk stays at 197 kB.

- **Vite:** MapLibre 6 looks for its worker next to its own module, and Vite's dependency optimiser moves that module. Import the worker with `?url` and pass it to `setWorkerUrl`.
- **CSS:** `maplibre-gl.css` sets `.maplibregl-map { position: relative }`, which overrides Tailwind's `absolute inset-0` and leaves the container 0 px tall. Size the container with `size-full` inside a positioned wrapper instead.
- **Tiles:** OpenFreeMap's dark style needs no key. The attribution is "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", shown in the compact attribution control.
- **Fast pans:** a copy of the water layer reads a second source capped at `maxzoom: 0`, so one tile covers the world under every layer and a fast pan shows coarse sea instead of empty tiles. `zoomLevelsToOverscale` must be unset: its default of 4 makes MapLibre fetch tiles past a source's `maxzoom` ([MapOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#zoomlevelstooverscale)).

## Coastline at the handover

- The globe's land is a grid of 30,000 dots, built from Natural Earth 1:110m land plus 1:50m islands. The dots are about 1.2° (130 km) apart. At the handover that is 34 px at 1440×900 and 9 px at 390×844.
- OpenFreeMap's tiles follow the OpenMapTiles schema. Its oceans come from Natural Earth up to tile zoom 5: 1:110m at zooms 0–1, 1:50m at 2–4 and 1:10m at 5. From zoom 6 they come from OpenStreetMap ([Water.java](https://github.com/openmaptiles/planetiler-openmaptiles/blob/a36238832f1ee2547120d1ad86d85dbdd1697b71/src/main/java/org/openmaptiles/layers/Water.java#L104-L110), [water.yaml](https://github.com/openmaptiles/openmaptiles/blob/6c11838d38030148832c039c2ea367274db86a87/layers/water/water.yaml)).
- So at the handover (map zoom 2–4.3) both sides are Natural Earth, at different scales. The visible gap comes from the dot spacing, not from the data: the dotted coast can't follow the map's coast closer than half a dot spacing (about 17 px on desktop). The crossfade hides it.

## Known limits

- A pinch that is still in progress doesn't carry over to the map: the globe holds the pointers, so the visitor has to lift their fingers and pinch again.
- The globe stops at 83° latitude and the map at 85°. Returning to the globe from above 83° moves the centre to 83°.
- Wheel scrolling that is still coming in after the return zooms the globe out further.
- The map draws Earthquakes and their felt rings like the globe does: with an Earthquake selected, both show only its felt ring. It uses OpenFreeMap's dark style recoloured to the app tokens ([#115](https://github.com/Vizzuality/quake-watch/issues/115)). It doesn't draw the globe's dot grid, so the crossfade remains the only bridge between the two looks.
- The globe's look on the [Quake Watch — Visual language](https://claude.ai/artifact/9to4jj5c7d7QzPowNUcFR4) board couldn't be checked during the spike, because the board only rendered "Loading…".

## Considered Options

- **A continuous zoom with no crossfade.** This would need the globe's dots, gradient and markers to match the basemap pixel for pixel. The dot grid can't trace a coastline, so a crossfade is needed whatever the camera does.
- **MapLibre's default perspective camera.** It matches only at the centre: estimated at about 18 px off at the top and bottom, 79 px at the sides and 129 px in the corners at 1440×900.
- **Self-hosted Protomaps PMTiles.** No third-party tile server, but it needs hosting and a build step. OpenFreeMap is free, needs no key, and answers the spike's questions.
