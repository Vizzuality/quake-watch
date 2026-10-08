import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// maplibre-gl 6 resolves its worker next to its own module URL, which Vite's
// bundle doesn't emit. Let Vite bundle the worker and point maplibre at it.
setWorkerUrl(workerUrl);
