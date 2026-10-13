import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { MapMouseEvent } from 'maplibre-gl';
import { useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { CORE_LAYER } from '@/components/map/layers';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getDistanceKm } from '@/lib/earthquakes/distance';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getSearchCenter } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import { getPlaceLabel } from '@/lib/i18n/labels';
import { getDateTimeLabel, getNumberLabel } from '@/lib/i18n/tooltip-labels';
import { getIsEpicenterVisible, getVisibleEpicenterId } from '@/lib/map/epicenter-hit';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

import { MapTooltip } from './map-tooltip';
import { usePlaybackClock } from './playback-context';

export type PlaceOfInterestDistance = { label: string; distanceKm: number };

function getMagnitudeLine(earthquake: Earthquake, locale: Locale): string {
  const magnitude = getNumberLabel(earthquake.magnitude, locale);
  if (!earthquake.magnitudeType) return m.epicenter_tooltip_magnitude({ magnitude }, { locale });
  return m.epicenter_tooltip_magnitude_type(
    { magnitude, type: earthquake.magnitudeType },
    { locale },
  );
}

export function EpicenterTooltipContent({
  earthquake,
  placeOfInterest,
  locale,
}: {
  earthquake: Earthquake;
  placeOfInterest: PlaceOfInterestDistance | null;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-medium">{earthquake.place ?? m.place_unknown({}, { locale })}</p>
      <p>{getMagnitudeLine(earthquake, locale)}</p>
      <p>{getDateTimeLabel(earthquake.time, locale)}</p>
      <p>
        {m.epicenter_tooltip_depth(
          { depth: getKmLabel(earthquake.depthKm, locale, 1) },
          { locale },
        )}
      </p>
      {placeOfInterest && (
        <p className="text-muted">
          {m.epicenter_tooltip_place_distance(
            {
              distance: getKmLabel(placeOfInterest.distanceKm, locale),
              place: placeOfInterest.label,
            },
            { locale },
          )}
        </p>
      )}
    </div>
  );
}

export function EpicenterTooltip() {
  const { current: map } = useMap();
  const clock = usePlaybackClock();
  const search = useEarthquakeSearch();
  const { data } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const locale = getLocale();
  const earthquakesById = useMemo(
    () => new Map((data?.earthquakes ?? []).map((earthquake) => [earthquake.id, earthquake])),
    [data],
  );
  const center = getSearchCenter(search);
  const [hovered, setHovered] = useState<Earthquake | null>(null);

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();

    const show = ({ point }: MapMouseEvent) => {
      const id = getVisibleEpicenterId(instance, point, clock);
      setHovered((id && earthquakesById.get(id)) || null);
    };
    const clear = () => setHovered(null);

    instance.on('mousemove', CORE_LAYER.id, show);
    instance.on('mouseleave', CORE_LAYER.id, clear);
    instance.on('click', show);
    const unsubscribe = clock.subscribe(() =>
      setHovered((previous) =>
        previous && getIsEpicenterVisible(previous.time, clock) ? previous : null,
      ),
    );
    return () => {
      instance.off('mousemove', CORE_LAYER.id, show);
      instance.off('mouseleave', CORE_LAYER.id, clear);
      instance.off('click', show);
      unsubscribe();
      clear();
    };
  }, [map, clock, earthquakesById]);

  if (!hovered) return null;
  const placeOfInterest = center
    ? { label: getPlaceLabel(search, locale), distanceKm: getDistanceKm(center, hovered) }
    : null;

  return (
    <MapTooltip latitude={hovered.latitude} longitude={hovered.longitude} offset={14}>
      <EpicenterTooltipContent
        earthquake={hovered}
        placeOfInterest={placeOfInterest}
        locale={locale}
      />
    </MapTooltip>
  );
}
