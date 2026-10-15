import 'maplibre-gl/dist/maplibre-gl.css';
import type { ReactNode } from 'react';
import { AttributionControl, Map as MapGL, type MapProps } from 'react-map-gl/maplibre';

import { useResolvedTheme } from '@/hooks/use-theme';
import { getBasemapStyleUrl } from '@/lib/theme/map-palette';
import { getLocale } from '@/paraglide/runtime';

import { BasemapLabels } from './basemap-labels';
import './maplibre-worker';

const INITIAL_VIEW_STATE = { longitude: 0, latitude: 20, zoom: 1.4 };

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
      style={{ position: 'absolute', inset: 0 }}
    >
      <AttributionControl compact customAttribution={attribution} />
      <BasemapLabels locale={getLocale()} />
      {children}
    </MapGL>
  );
}
