# Quake Watch

Earthquakes around the world, as they happen — explained for people who aren't seismologists.

## Why

Most earthquake sites are built for experts. This one shows where an earthquake happened, how big it was and what it meant for the places you care about.

## Status

A searchable earthquake table and a map that share the same filters in the URL: place (with a radius), period or custom dates, minimum magnitude and catalogue (EMSC by default, USGS on request). The last-24-hours view refreshes every minute. The interface is available in English and Spanish.

## Getting started

1. Use the Node version in [`.nvmrc`](.nvmrc): `nvm use`
2. Install dependencies: `pnpm install`
3. Install the browser for integration tests: `pnpm exec playwright install chromium`
4. Start the dev server: `pnpm dev` (http://localhost:3000)

| Script             | What it does                                                                    |
| ------------------ | ------------------------------------------------------------------------------- |
| `dev`              | Run the app locally with hot reload                                             |
| `build`            | Build the app for production                                                    |
| `start`            | Serve the production build                                                      |
| `check`            | Run build, smoke, typecheck, lint, format check, coverage and integration tests |
| `test`             | Run the test suite                                                              |
| `test:coverage`    | Run the test suite with a coverage report                                       |
| `test:integration` | Run browser-mode integration tests (Chromium via Playwright)                    |
| `test:smoke`       | Check the raw HTML of detail pages in the build, with stubbed agencies          |
| `typecheck`        | Type-check the project without emitting files                                   |
| `lint`             | Lint the code with oxlint                                                       |
| `format`           | Format the code with oxfmt                                                      |
| `format:check`     | Check formatting without writing changes                                        |

## Stack

TanStack Start + React, MapLibre via react-map-gl, TanStack Query, Tailwind CSS. Exact versions live in [package.json](package.json).

## Data

- Earthquakes: [EMSC FDSN event service](https://www.seismicportal.eu/fdsnws/event/1/) (default) and [USGS FDSN event service](https://earthquake.usgs.gov/fdsnws/event/1/)
- Place search: [Photon](https://photon.komoot.io) geocoder, data © OpenStreetMap contributors
- Basemap: [OpenFreeMap](https://openfreemap.org). Attribution: OpenFreeMap © OpenMapTiles Data from OpenStreetMap

## Deploy (Railway)

1. In Railway, choose New Project → Deploy from GitHub repo → `Vizzuality/quake-watch`.
2. Railway builds with [Railpack](https://railpack.com/languages/node), which reads `packageManager` and `engines.node` from `package.json`, runs `pnpm build` and starts the app with `pnpm start`. The server listens on Railway's `PORT`.
3. In Settings → Networking, click Generate domain.
4. Enable PR environments in Project Settings → Environments to get a preview per pull request. See [Railway environments](https://docs.railway.com/environments).

## CI

GitHub Actions runs build, raw-HTML smoke tests against the build, typecheck, lint, format check, tests with coverage and browser-mode integration tests on pushes to `main` and on pull requests. Draft pull requests are skipped until they are marked ready for review. The workflow is in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Glossary

Domain terms (Earthquake, Magnitude, Intensity and others) are defined in [CONTEXT.md](CONTEXT.md).

## License

MIT — see [LICENSE](LICENSE).
