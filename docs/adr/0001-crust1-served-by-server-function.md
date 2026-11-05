# Serve CRUST1.0 from a committed binary through a server function

Status: superseded — the Crustal block was removed in the redesign ([#80](https://github.com/Vizzuality/quake-watch/issues/80)); the implementation lives on [archive/v1](https://github.com/Vizzuality/quake-watch/tree/archive/v1).

The Crustal block needs the local Crust layers at any Epicenter. CRUST1.0 (Laske et al., 2013) has no public query API (IRIS has no crust service) and its official site sends no CORS headers, so the browser cannot read it directly. We convert `crust1.bnds` once into a committed Int16 binary and serve only the requested cells from a TanStack Start server function, which keeps the dataset out of the client bundle and off the network on every visit.

## Considered Options

- Static tiles or a single binary under `public/`: no server code, but every visit downloads data the page does not use.
- Downloading the tarball at build time: the build would depend on a university HTTP server.
- A generic oceanic/continental crust model: no dataset to ship, but not local to the Epicenter.
