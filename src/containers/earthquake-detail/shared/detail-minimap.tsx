import { Link } from '@tanstack/react-router';
import { type ReactNode, useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import { QuakeMap } from '@/components/map/quake-map';
import { buttonVariants } from '@/components/ui/button';
import { useMapPalette } from '@/hooks/use-theme';
import { getEarthquakesGeoJson, getMagnitudeColorExpression } from '@/lib/earthquakes/magnitude';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import type { Earthquake } from '@/lib/earthquakes/types';
import type { TrainBounds } from '@/lib/shakemap/wave-train';
import { m } from '@/paraglide/messages';

const MINIMAP_SOURCE_ID = 'detail-earthquake';
const MINIMAP_ZOOM = 5;
const MINIMAP_PADDING = 24;

function getMapDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function getInitialViewState(earthquake: Earthquake, bounds: TrainBounds | null | undefined) {
  if (bounds) return { bounds, fitBoundsOptions: { padding: MINIMAP_PADDING } };
  return { longitude: earthquake.longitude, latitude: earthquake.latitude, zoom: MINIMAP_ZOOM };
}

export function DetailMinimap({
  earthquake,
  bounds,
  overlay,
  children,
}: {
  earthquake: Earthquake;
  bounds?: TrainBounds | null;
  overlay?: ReactNode;
  children?: ReactNode;
}) {
  const geojson = useMemo(() => getEarthquakesGeoJson([earthquake]), [earthquake]);
  const palette = useMapPalette();
  const date = getMapDate(earthquake.time);

  return (
    <div className="flex flex-col gap-2">
      <figure
        aria-label={m.detail_minimap_label()}
        className="relative h-64 overflow-hidden rounded-md border border-line sm:h-80"
      >
        <QuakeMap
          attribution={m.attribution_data({ source: SOURCE_ADAPTERS[earthquake.source].label })}
          initialViewState={getInitialViewState(earthquake, bounds)}
          interactive={false}
        >
          {children}
          <Source id={MINIMAP_SOURCE_ID} type="geojson" data={geojson}>
            <Layer
              id="detail-earthquake-halo"
              type="circle"
              paint={{
                'circle-radius': 14,
                'circle-color': getMagnitudeColorExpression(palette.magnitude),
                'circle-blur': 0.6,
                'circle-opacity': 0.3,
              }}
            />
            <Layer
              id="detail-earthquake-core"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': getMagnitudeColorExpression(palette.magnitude),
                'circle-opacity': 1,
                'circle-stroke-width': 2,
                'circle-stroke-color': palette.canvas,
              }}
            />
          </Source>
        </QuakeMap>
        {overlay}
      </figure>
      <Link
        to="/map"
        search={{
          source: earthquake.source,
          lat: earthquake.latitude,
          lon: earthquake.longitude,
          period: 'custom',
          from: date,
          to: date,
          minmag: 0,
        }}
        className={buttonVariants({ className: 'self-start' })}
      >
        {m.detail_see_on_map()}
      </Link>
    </div>
  );
}
