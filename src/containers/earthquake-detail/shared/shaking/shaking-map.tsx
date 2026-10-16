import type { MapGeoJSONFeature } from 'maplibre-gl';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { QuakeMap } from '@/components/map/quake-map';
import { useClickToActivate } from '@/hooks/use-click-to-activate';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import type { Rgb } from '@/lib/map/shaking-waves';

import { getCssColor, getMapHint } from './shaking-labels';

export type ShakingReadout = { color: Rgb; text: string };
export type ShakingBounds = [number, number, number, number];
type ShakingPointer = { point: SearchCenter; features: readonly MapGeoJSONFeature[] };

const COARSE_POINTER_QUERY = '(pointer: coarse)';
const FIT_PADDING_PX = 16;

export function ShakingMap({
  label,
  attribution,
  bounds,
  getReadout,
  interactiveLayerIds,
  children,
}: {
  label: string;
  attribution: string;
  bounds: ShakingBounds;
  getReadout: (
    point: SearchCenter,
    features: readonly MapGeoJSONFeature[],
  ) => ShakingReadout | null;
  interactiveLayerIds?: string[];
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const coarsePointer = useMediaQuery(COARSE_POINTER_QUERY);
  const { active, activate } = useClickToActivate(containerRef);
  const initialViewState = useMemo(
    () => ({ bounds, fitBoundsOptions: { padding: FIT_PADDING_PX } }),
    [bounds],
  );
  const [pointer, setPointer] = useState<ShakingPointer | null>(null);
  const readout = pointer ? getReadout(pointer.point, pointer.features) : null;
  const gesturesEnabled = !coarsePointer || active;

  function handleMouseMove(event: MapLayerMouseEvent) {
    setPointer({
      point: { latitude: event.lngLat.lat, longitude: event.lngLat.lng },
      features: event.features ?? [],
    });
  }

  function handleClick(event: MapLayerMouseEvent) {
    activate();
    handleMouseMove(event);
  }

  function clearPointer() {
    setPointer(null);
  }

  return (
    <figure ref={containerRef} aria-label={label} className="flex flex-col gap-1">
      <div className="relative h-80 overflow-hidden rounded-lg border border-line sm:h-[28rem]">
        <QuakeMap
          attribution={attribution}
          initialViewState={initialViewState}
          scrollZoom={active}
          dragPan={gesturesEnabled}
          touchZoomRotate={gesturesEnabled}
          cursor="crosshair"
          interactiveLayerIds={interactiveLayerIds}
          onMouseMove={handleMouseMove}
          onMouseOut={clearPointer}
          onMoveStart={clearPointer}
          onClick={handleClick}
        >
          {children}
        </QuakeMap>
        {readout === null ? null : (
          <p className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-md bg-canvas/85 px-2 py-1 text-xs text-fg ring-1 ring-fg/20">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm ring-1 ring-canvas/40"
              style={{ backgroundColor: getCssColor(readout.color) }}
            />
            {readout.text}
          </p>
        )}
      </div>
      <figcaption className="text-xs text-muted">{getMapHint(coarsePointer, active)}</figcaption>
    </figure>
  );
}
