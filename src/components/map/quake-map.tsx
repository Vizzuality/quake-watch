import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapLibreEvent } from 'maplibre-gl';
import type { ReactNode } from 'react';
import { AttributionControl, Map as MapGL, type MapProps } from 'react-map-gl/maplibre';

import { useResolvedTheme } from '@/hooks/use-theme';
import { getBasemapStyleUrl } from '@/lib/theme/map-palette';
import { getLocale } from '@/paraglide/runtime';

import { BasemapLabels } from './basemap-labels';
import './maplibre-worker';

const INITIAL_VIEW_STATE = { longitude: 0, latitude: 20, zoom: 1.4 };
const EXPANDED_ATTRIBUTION_MIN_WIDTH = 640;

function collapseAttributionOnNarrowMaps({ target }: MapLibreEvent) {
  const container = target.getContainer();
  if (container.clientWidth >= EXPANDED_ATTRIBUTION_MIN_WIDTH) return;
  container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
}

type QuakeMapProps = Pick<
  MapProps,
  | 'initialViewState'
  | 'scrollZoom'
  | 'dragPan'
  | 'touchZoomRotate'
  | 'cursor'
  | 'onMouseMove'
  | 'onMouseOut'
  | 'onClick'
  | 'interactiveLayerIds'
  | 'onMoveStart'
> & {
  attribution: string;
  children: ReactNode;
  interactive?: boolean;
};

export function QuakeMap({
  attribution,
  children,
  initialViewState = INITIAL_VIEW_STATE,
  interactive = true,
  ...mapProps
}: QuakeMapProps) {
  const theme = useResolvedTheme();

  return (
    <MapGL
      {...mapProps}
      initialViewState={initialViewState}
      interactive={interactive}
      mapStyle={getBasemapStyleUrl(theme)}
      dragRotate={false}
      touchPitch={false}
      attributionControl={false}
      onLoad={collapseAttributionOnNarrowMaps}
      onResize={collapseAttributionOnNarrowMaps}
      style={{ position: 'absolute', inset: 0 }}
    >
      <AttributionControl key={attribution} compact customAttribution={attribution} />
      <BasemapLabels locale={getLocale()} />
      {children}
    </MapGL>
  );
}
