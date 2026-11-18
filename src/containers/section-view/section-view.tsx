import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AreaStrip } from '@/containers/detail-map/area-strip';
import { getSelectedEarthquake } from '@/containers/globe/use-hovered-quake';
import {
  earthquakeDetailQueryOptions,
  getDetailEarthquake,
} from '@/lib/earthquakes/details/query-options';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { type CrustGrid, getCrustColumn } from '@/lib/section/crust-layers';
import {
  crustLayersQueryOptions,
  reliefQueryOptions,
  slabGridsQueryOptions,
} from '@/lib/section/query-options';
import { getSectionAlt, getSectionBlurb } from '@/lib/section/section-labels';
import { type SectionModel, getSectionModel } from '@/lib/section/section-model';
import { type SlabGrid, getSlabDepthKm } from '@/lib/section/slab-depth';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

import { SectionFigure } from './section-figure';
import { useSectionWave } from './use-section-wave';

const homeRoute = getRouteApi('/');
const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const EMPTY_SLABS: readonly SlabGrid[] = [];
const FIGURE_BOX_CLASS_NAME = 'absolute top-[200px] right-0 bottom-[170px] left-120';
const STATUS_CLASS_NAME = `${FIGURE_BOX_CLASS_NAME} flex flex-col items-center justify-center gap-4 text-body-s text-muted`;
const RETRY_CLASS_NAME =
  'cursor-pointer rounded-pill border border-muted px-4 py-2.5 text-[9.5px] leading-[1.2] font-medium tracking-[0.2em] text-foreground uppercase hover:border-accent disabled:cursor-default disabled:opacity-40';

type SectionData = {
  earthquake: Earthquake;
  elevationsM: Float32Array[];
  crust: CrustGrid;
  slabs: readonly SlabGrid[];
  others: readonly Earthquake[];
};

function getModel({ earthquake, elevationsM, crust, slabs, others }: SectionData): SectionModel {
  return getSectionModel({
    earthquake,
    elevationsM,
    getCrust: (lon, lat) => getCrustColumn(crust, lat, lon),
    getSlabDepthKm: (lon, lat) => getSlabDepthKm(slabs, lat, lon),
    others,
  });
}

function SectionFigureBlock({
  model,
  earthquake,
  locale,
}: {
  model: SectionModel;
  earthquake: Earthquake;
  locale: Locale;
}) {
  const ringsRef = useRef<SVGGElement>(null);
  const captionId = useId();
  const alt = getSectionAlt(
    {
      depthKm: earthquake.depthKm,
      facts: model.facts,
      hasSlab: model.slab !== null,
      otherCount: model.others.length,
    },
    locale,
  );

  useSectionWave(ringsRef, earthquake.id);

  return (
    <figure aria-labelledby={captionId} className={`${FIGURE_BOX_CLASS_NAME} m-0`}>
      <figcaption id={captionId} className="sr-only">
        {alt}
      </figcaption>
      <SectionFigure model={model} earthquake={earthquake} locale={locale} ringsRef={ringsRef} />
    </figure>
  );
}

export default function SectionView({ quake }: { quake: string }) {
  const search = homeRoute.useSearch();
  const locale = getLocale();
  const { data: list } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const { data: detail } = useQuery(earthquakeDetailQueryOptions(quake));
  const earthquakes = list?.earthquakes ?? EMPTY_EARTHQUAKES;
  const earthquake =
    getSelectedEarthquake(earthquakes, quake) ?? getDetailEarthquake(detail ?? null);
  const relief = useQuery({
    ...reliefQueryOptions(earthquake?.latitude ?? 0, earthquake?.longitude ?? 0),
    enabled: earthquake !== null,
  });
  const crust = useQuery(crustLayersQueryOptions());
  const slabs = useQuery(slabGridsQueryOptions());
  const [host, setHost] = useState<HTMLElement | null>(null);
  const hostRef = useCallback((node: HTMLSpanElement | null) => {
    setHost(node?.closest('main') ?? null);
  }, []);
  const isError = relief.isError || crust.isError;
  const isSlabSettled = slabs.isSuccess || slabs.isError;
  const isFetching = relief.isFetching || crust.isFetching;
  const model = useMemo(() => {
    if (!earthquake || !relief.data || !crust.data || !isSlabSettled) return null;
    return getModel({
      earthquake,
      elevationsM: relief.data,
      crust: crust.data,
      slabs: slabs.data ?? EMPTY_SLABS,
      others: earthquakes,
    });
  }, [earthquake, relief.data, crust.data, slabs.data, isSlabSettled, earthquakes]);

  function retry() {
    if (relief.isError) void relief.refetch();
    if (crust.isError) void crust.refetch();
  }

  const view = (
    <div
      data-testid="section-view"
      className="pointer-events-auto absolute inset-0 z-[5] hidden bg-background bg-page lg:block"
    >
      <div className="absolute top-[158px] left-139 w-[520px]">
        <h3 className="text-caption-bold uppercase">{m.section_heading()}</h3>
        {earthquake && model && (
          <p className="mt-2 text-body-s leading-normal text-muted">
            {getSectionBlurb(earthquake.source, model.slab !== null, locale)}
          </p>
        )}
      </div>
      {earthquake && model && (
        <SectionFigureBlock model={model} earthquake={earthquake} locale={locale} />
      )}
      {isError && (
        <div role="alert" className={STATUS_CLASS_NAME}>
          <p>{m.section_error()}</p>
          <button type="button" disabled={isFetching} onClick={retry} className={RETRY_CLASS_NAME}>
            {m.details_retry()}
          </button>
        </div>
      )}
      {!isError && !model && <output className={STATUS_CLASS_NAME}>{m.section_loading()}</output>}
      <AreaStrip />
    </div>
  );

  return (
    <>
      <span hidden ref={hostRef} />
      {host && createPortal(view, host)}
    </>
  );
}
