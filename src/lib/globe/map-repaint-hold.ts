type Repaintable = {
  triggerRepaint: () => void;
  redraw: () => unknown;
};

// MapLibre has no API to pause rendering, so the instance shadows the two entry points every frame goes through: https://github.com/maplibre/maplibre-gl-js/blob/v6.18.0/src/ui/map.ts#L4639-L4720
export function holdMapRepaints(map: Repaintable): () => void {
  let isPending = false;
  function defer() {
    isPending = true;
    return map;
  }
  Object.assign(map, { triggerRepaint: defer, redraw: defer });
  return () => {
    Reflect.deleteProperty(map, 'triggerRepaint');
    Reflect.deleteProperty(map, 'redraw');
    if (isPending) map.triggerRepaint();
  };
}
