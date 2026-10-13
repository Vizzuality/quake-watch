import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Map as MaplibreMap, MapMouseEvent, Point } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getDistanceKm } from '@/lib/earthquakes/distance';
import { getIntensityLevel } from '@/lib/earthquakes/intensity';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getWindowMs } from '@/lib/earthquakes/timeline';
import { getKmLabel } from '@/lib/format';
import { getIntensityLevelLabel, getNumberLabel } from '@/lib/i18n/tooltip-labels';
import { getVisibleEpicenterId } from '@/lib/map/epicenter-hit';
import { getRingHits } from '@/lib/map/ring-hits';
import type { RingHit } from '@/lib/map/ring-hits';
import { getPlaybackSpanMs, getWaveSpanMs } from '@/lib/map/shaking-waves';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

import { MapTooltip } from './map-tooltip';
import { usePlaybackClock } from './playback-context';
import { REDUCED_MOTION_QUERY } from './shaking-waves';

type RingHover = { latitude: number; longitude: number; hits: RingHit[] };

export function RingTooltipContent({
  hit,
  moreCount,
  locale,
}: {
  hit: RingHit;
  moreCount: number;
  locale: Locale;
}) {
  const { earthquake, intensity, distanceKm } = hit;
  const { roman, key } = getIntensityLevel(intensity);

  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-medium">
        {m.ring_tooltip_title({ roman, level: getIntensityLevelLabel(key, locale) }, { locale })}
      </p>
      <p>
        {m.ring_tooltip_magnitude(
          { magnitude: getNumberLabel(earthquake.magnitude, locale) },
          { locale },
        )}
      </p>
      <p>{m.ring_tooltip_distance({ distance: getKmLabel(distanceKm, locale) }, { locale })}</p>
      {moreCount > 0 && (
        <p className="text-muted">{m.ring_tooltip_more({ count: moreCount }, { locale })}</p>
      )}
    </div>
  );
}

function getKmPerPx(map: MaplibreMap, point: Point) {
  const from = map.unproject([point.x, point.y]);
  const to = map.unproject([point.x + 1, point.y]);
  return getDistanceKm(
    { latitude: from.lat, longitude: from.lng },
    { latitude: to.lat, longitude: to.lng },
  );
}

export function RingTooltip() {
  const { current: map } = useMap();
  const clock = usePlaybackClock();
  const search = useEarthquakeSearch();
  const { data } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const earthquakes = data?.earthquakes;
  const playbackWindow = search.window;
  const [hover, setHover] = useState<RingHover | null>(null);

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();
    const windowMs = getWindowMs(playbackWindow);

    let last: { cursor: SearchCenter; kmPerPx: number } | null = null;

    const getHits = ({ cursor, kmPerPx }: NonNullable<typeof last>) =>
      getRingHits({
        earthquakes: earthquakes ?? [],
        tMs: clock.getT(),
        waveSpanMs: getWaveSpanMs(getPlaybackSpanMs(clock.getRange(), windowMs)),
        reducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
        cursor,
        kmPerPx,
      });
    const clear = () => {
      last = null;
      setHover(null);
    };
    const update = ({ point, lngLat }: MapMouseEvent) => {
      if (clock.isPlaying() || getVisibleEpicenterId(instance, point, clock)) {
        clear();
        return;
      }
      last = {
        cursor: { latitude: lngLat.lat, longitude: lngLat.lng },
        kmPerPx: getKmPerPx(instance, point),
      };
      const hits = getHits(last);
      setHover(hits.length > 0 ? { ...last.cursor, hits } : null);
    };

    instance.on('mousemove', update);
    instance.on('click', update);
    instance.on('mouseout', clear);
    const unsubscribe = clock.subscribe((_t, playing) => {
      if (playing) {
        clear();
        return;
      }
      if (last && getHits(last).length === 0) clear();
    });
    return () => {
      instance.off('mousemove', update);
      instance.off('click', update);
      instance.off('mouseout', clear);
      unsubscribe();
      clear();
    };
  }, [map, clock, earthquakes, playbackWindow]);

  if (!hover) return null;
  const [top, ...others] = hover.hits;

  return (
    <MapTooltip latitude={hover.latitude} longitude={hover.longitude} offset={12}>
      <RingTooltipContent hit={top} moreCount={others.length} locale={getLocale()} />
    </MapTooltip>
  );
}
