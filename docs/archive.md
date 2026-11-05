# Archive of the first app

The app before the redesign — table, MapLibre map, per-catalogue detail pages, Crustal block, 404 drum — lives on the branch [`archive/v1`](https://github.com/Vizzuality/quake-watch/tree/archive/v1) and the tag [`v1-archive`](https://github.com/Vizzuality/quake-watch/releases/tag/v1-archive), both at [f3be585](https://github.com/Vizzuality/quake-watch/commit/f3be585a36e774fd5522dea1f497a5bf54818c17). A ruleset blocks deleting or force-pushing the branch.

It runs at [quake-watch-archive.up.railway.app](https://quake-watch-archive.up.railway.app) (Railway environment `archive`). The deploy sleeps when idle, so the first request after a pause is slow. Point Playwright at it for side-by-side checks.

To run it locally:

```sh
git switch archive/v1
pnpm install && pnpm build && pnpm start
```

## Modules kept for the redesign

These modules stay on `main` when the rest of the old app is removed ([#80](https://github.com/Vizzuality/quake-watch/issues/80)); `magnitude.ts` there has already lost its MapLibre style expressions. Links point at the archived versions, so they don't move when the branch does.

| Module                                                                                                                                                         | Reuse   | What it holds                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| [`src/lib/earthquakes/sources`](https://github.com/Vizzuality/quake-watch/tree/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/earthquakes/sources)           | As-is   | EMSC and USGS FDSN clients, normalised to one feature collection                                |
| [`src/lib/earthquakes/intensity.ts`](https://github.com/Vizzuality/quake-watch/blob/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/earthquakes/intensity.ts) | As-is   | Intensity from magnitude and distance (Allen 2012), Felt reach, Intensity levels                |
| [`src/lib/earthquakes/meaning.ts`](https://github.com/Vizzuality/quake-watch/blob/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/earthquakes/meaning.ts)     | As-is   | Plain-language meaning of an Earthquake, rounded reach                                          |
| [`src/lib/earthquakes/magnitude.ts`](https://github.com/Vizzuality/quake-watch/blob/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/earthquakes/magnitude.ts) | Adapted | Magnitude classes and radius stops; the MapLibre style expressions don't apply to the globe     |
| [`src/lib/earthquakes/arrivals.ts`](https://github.com/Vizzuality/quake-watch/blob/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/earthquakes/arrivals.ts)   | As-is   | IDs that arrived since the previous poll                                                        |
| [`src/lib/places`](https://github.com/Vizzuality/quake-watch/tree/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/places)                                     | As-is   | Photon geocoder client, coordinate parsing, query options                                       |
| [`src/lib/i18n`](https://github.com/Vizzuality/quake-watch/tree/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/i18n)                                         | Adapted | Label, count, timeline and tooltip formatters, message parity test; labels follow the new views |
| [`src/server/og`](https://github.com/Vizzuality/quake-watch/tree/f3be585a36e774fd5522dea1f497a5bf54818c17/src/server/og)                                       | Adapted | Share-card renderer, fonts, land path; the card layout follows the redesign                     |
| [`src/lib/seo`](https://github.com/Vizzuality/quake-watch/tree/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/seo)                                           | Adapted | Alternate links, page titles, Open Graph, indexing, sitemap; routes follow the new URL schema   |
| [`src/lib/http`](https://github.com/Vizzuality/quake-watch/tree/f3be585a36e774fd5522dea1f497a5bf54818c17/src/lib/http)                                         | As-is   | Gzip compression of SSR HTML                                                                    |
