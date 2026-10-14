import type { Map as MapLibreMap } from 'maplibre-gl';

const BOUNDARY_LAYER_PREFIX = 'boundary';

export function getShakingBeforeId(map: MapLibreMap): string | undefined {
  const order = map.getLayersOrder();
  return (
    order.find((id) => id.startsWith(BOUNDARY_LAYER_PREFIX)) ??
    order.find((id) => map.getLayer(id)?.type === 'symbol')
  );
}

export function placeOnStyle(map: MapLibreMap, place: () => void): () => void {
  const placeWhenLoaded = () => {
    if (map.style?._loaded) place();
  };
  placeWhenLoaded();
  map.on('styledata', placeWhenLoaded);
  return () => map.off('styledata', placeWhenLoaded);
}
