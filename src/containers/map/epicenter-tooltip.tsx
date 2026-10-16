import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { MapMouseEvent } from 'maplibre-gl';
import { useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { MAGNITUDE_FILL_CLASS_NAMES } from '@/components/magnitude-classes';
import { CORE_LAYER_ID } from '@/components/map/layers';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getEarthquakeDetailLinkOptions } from '@/lib/earthquakes/detail-link';
import { getDistanceKm } from '@/lib/earthquakes/distance';
import { getMagnitudeClass } from '@/lib/earthquakes/magnitude';
import { getEarthquakeMeaning } from '@/lib/earthquakes/meaning';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getSearchCenter } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import { getPlaceLabel } from '@/lib/i18n/labels';
import { getEarthquakeMeaningLabel } from '@/lib/i18n/meaning-labels';
import { getDateTimeLabel, getNumberLabel } from '@/lib/i18n/tooltip-labels';
import { getIsEpicenterVisible, getVisibleEpicenterId } from '@/lib/map/epicenter-hit';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

import { MapTooltip } from './map-tooltip';
import { usePlaybackClock } from './playback-context';

export type PlaceOfInterestDistance = { label: string; name?: string; distanceKm: number };

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
  isPinned = false,
}: {
  earthquake: Earthquake;
  placeOfInterest: PlaceOfInterestDistance | null;
  locale: Locale;
  isPinned?: boolean;
}) {
  const meaning = getEarthquakeMeaning({
    magnitude: earthquake.magnitude,
    depthKm: earthquake.depthKm,
    distanceKm: placeOfInterest?.distanceKm ?? null,
  });

  return (
    <div className="flex max-w-64 flex-col gap-0.5 tabular-nums">
      <p className="text-sm font-medium text-pretty">
        {earthquake.place ?? m.place_unknown({}, { locale })}
      </p>
      <p className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-2.5 shrink-0 rounded-full ring-1 ring-fg/50',
            MAGNITUDE_FILL_CLASS_NAMES[getMagnitudeClass(earthquake.magnitude)],
          )}
        />
        {getMagnitudeLine(earthquake, locale)}
      </p>
      <p className="font-medium">
        {getEarthquakeMeaningLabel(meaning, placeOfInterest?.name, locale)}
      </p>
      <p className="text-muted">{getDateTimeLabel(earthquake.time, locale)}</p>
      <p className="text-muted">
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
      {isPinned && (
        <Link
          {...getEarthquakeDetailLinkOptions(earthquake)}
          className="mt-1 inline-flex min-h-8 items-center self-start rounded-xs font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          {m.epicenter_tooltip_view_details({}, { locale })}
        </Link>
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
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const pinned = (pinnedId && earthquakesById.get(pinnedId)) || null;
  const shown = pinned ?? hovered;

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();

    const show = ({ point }: MapMouseEvent) => {
      const id = getVisibleEpicenterId(instance, point, clock);
      setHovered((id && earthquakesById.get(id)) || null);
    };
    const clear = () => setHovered(null);
    const pin = (event: MapMouseEvent) => {
      show(event);
      setPinnedId(getVisibleEpicenterId(instance, event.point, clock));
    };

    instance.on('mousemove', CORE_LAYER_ID, show);
    instance.on('mouseleave', CORE_LAYER_ID, clear);
    instance.on('click', pin);
    const unsubscribe = clock.subscribe(() => {
      setHovered((previous) =>
        previous && getIsEpicenterVisible(previous.time, clock) ? previous : null,
      );
      setPinnedId((previous) => {
        const earthquake = previous && earthquakesById.get(previous);
        return earthquake && getIsEpicenterVisible(earthquake.time, clock) ? previous : null;
      });
    });
    return () => {
      instance.off('mousemove', CORE_LAYER_ID, show);
      instance.off('mouseleave', CORE_LAYER_ID, clear);
      instance.off('click', pin);
      unsubscribe();
      clear();
    };
  }, [map, clock, earthquakesById]);

  useEffect(() => {
    if (!pinnedId) return;
    const unpin = ({ key }: KeyboardEvent) => {
      if (key === 'Escape') setPinnedId(null);
    };
    window.addEventListener('keydown', unpin);
    return () => window.removeEventListener('keydown', unpin);
  }, [pinnedId]);

  if (!shown) return null;
  const placeOfInterest = center
    ? {
        label: getPlaceLabel(search, locale),
        name: search.place,
        distanceKm: getDistanceKm(center, shown),
      }
    : null;

  return (
    <MapTooltip
      latitude={shown.latitude}
      longitude={shown.longitude}
      offset={14}
      interactive={pinned !== null}
    >
      <EpicenterTooltipContent
        earthquake={shown}
        isPinned={pinned !== null}
        placeOfInterest={placeOfInterest}
        locale={locale}
      />
    </MapTooltip>
  );
}
