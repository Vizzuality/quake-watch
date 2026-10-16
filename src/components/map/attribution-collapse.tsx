import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

const EXPANDED_ATTRIBUTION_MIN_WIDTH = 640;

function collapseAttributionOnNarrowMap(container: HTMLElement) {
  if (container.clientWidth >= EXPANDED_ATTRIBUTION_MIN_WIDTH) return;
  container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
}

export function AttributionCollapse({ attribution }: { attribution: string }) {
  const { current: map } = useMap();

  useEffect(() => {
    const instance = map?.getMap();
    if (!instance) return;
    const collapse = () => collapseAttributionOnNarrowMap(instance.getContainer());
    const frame = window.requestAnimationFrame(collapse);
    instance.on('load', collapse);
    instance.on('resize', collapse);
    return () => {
      window.cancelAnimationFrame(frame);
      instance.off('load', collapse);
      instance.off('resize', collapse);
    };
  }, [map, attribution]);

  return null;
}
