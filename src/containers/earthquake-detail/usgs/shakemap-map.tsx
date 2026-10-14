import { useMemo, useRef, useState } from 'react';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { QuakeMap } from '@/components/map/quake-map';
import { useClickToActivate } from '@/hooks/use-click-to-activate';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import type { ShakemapContour } from '@/lib/shakemap/contours';
import { getPaletteColor } from '@/lib/shakemap/coverage';
import type { ShakemapGrid } from '@/lib/shakemap/coverage';
import { getRevealedMmi, type ShakemapReveal } from '@/lib/shakemap/readout';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { getCssColor, getIntensityShortLabel, getMapHint } from './shakemap-labels';
import { ShakemapSurface } from './shakemap-surface';

const COARSE_POINTER_QUERY = '(pointer: coarse)';
const FIT_PADDING_PX = 16;
const ATTRIBUTION_SOURCE = 'USGS ShakeMap';

export function ShakemapMap({
  grid,
  contours,
  reveal,
}: {
  grid: ShakemapGrid;
  contours: readonly ShakemapContour[];
  reveal: ShakemapReveal;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const coarsePointer = useMediaQuery(COARSE_POINTER_QUERY);
  const { active, activate } = useClickToActivate(containerRef);
  const initialViewState = useMemo(
    () => ({
      bounds: [grid.west, grid.south, grid.east, grid.north] as [number, number, number, number],
      fitBoundsOptions: { padding: FIT_PADDING_PX },
    }),
    [grid],
  );
  const [pointer, setPointer] = useState<SearchCenter | null>(null);
  const mmi = pointer ? getRevealedMmi(grid, reveal, pointer) : null;
  const gesturesEnabled = !coarsePointer || active;

  function handleMouseMove(event: MapLayerMouseEvent) {
    setPointer({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
  }

  function handleClick(event: MapLayerMouseEvent) {
    activate();
    handleMouseMove(event);
  }

  function handleMouseOut() {
    setPointer(null);
  }

  return (
    <figure
      ref={containerRef}
      aria-label={m.detail_shakemap_map_label()}
      className="flex flex-col gap-1"
    >
      <div className="relative h-80 overflow-hidden rounded-lg border border-line sm:h-[28rem]">
        <QuakeMap
          attribution={m.attribution_data({ source: ATTRIBUTION_SOURCE })}
          initialViewState={initialViewState}
          scrollZoom={active}
          dragPan={gesturesEnabled}
          touchZoomRotate={gesturesEnabled}
          cursor="crosshair"
          onMouseMove={handleMouseMove}
          onMouseOut={handleMouseOut}
          onClick={handleClick}
        >
          <ShakemapSurface grid={grid} contours={contours} reveal={reveal} />
        </QuakeMap>
        {mmi === null ? null : (
          <p className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-md bg-ink/85 px-2 py-1 text-xs text-paper ring-1 ring-paper/20">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm ring-1 ring-ink/40"
              style={{ backgroundColor: getCssColor(getPaletteColor(grid.palette, mmi)) }}
            />
            {m.detail_shakemap_readout({ intensity: getIntensityShortLabel(mmi, getLocale()) })}
          </p>
        )}
      </div>
      <figcaption className="text-xs text-muted">{getMapHint(coarsePointer, active)}</figcaption>
    </figure>
  );
}
