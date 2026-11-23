import type { Map as MapLibreMap } from 'maplibre-gl';

import { isPhoneViewport } from '@/lib/layout/phone';

const COLLAPSE_DELAY_MS = 5000;
const SHOWN_CLASS = 'maplibregl-compact-show';

// MapLibre has no public collapse API; same as its drag minimize: https://github.com/maplibre/maplibre-gl-js/blob/v6.18.0/src/ui/control/attribution_control.ts#L212-L218
function collapseAttribution(map: MapLibreMap) {
  map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove(SHOWN_CLASS);
}

export function watchAttributionCollapse(map: MapLibreMap) {
  const button = map.getContainer().querySelector('.maplibregl-ctrl-attrib-button');
  let timer: number | undefined;
  let isSettled = false;

  function dispose() {
    isSettled = true;
    window.clearTimeout(timer);
    button?.removeEventListener('click', dispose);
    map.off('drag', dispose);
  }

  function onMapShown() {
    if (isSettled || timer !== undefined) return;
    if (!isPhoneViewport(map.getContainer().clientWidth, map.getContainer().clientHeight)) {
      dispose();
      return;
    }
    timer = window.setTimeout(() => {
      collapseAttribution(map);
      dispose();
    }, COLLAPSE_DELAY_MS);
  }

  button?.addEventListener('click', dispose);
  map.on('drag', dispose);
  return { onMapShown, dispose };
}
