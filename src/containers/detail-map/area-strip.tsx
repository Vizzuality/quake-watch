import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { getSelectedEarthquake } from '@/containers/globe/use-hovered-quake';
import { usePhoneLayout } from '@/hooks/use-phone-layout';
import {
  type AreaStrip as AreaStripLayout,
  getAreaEarthquakes,
  getAreaStrip,
  getStripTicks,
} from '@/lib/earthquakes/area-strip';
import { type EarthquakesResult, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { type Interval, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { getIntervalRange } from '@/lib/earthquakes/timeline';
import { MAP_COLORS } from '@/lib/globe/map-style';
import { getAreaCaption, getStripQuakeLabel, getStripTickLabel } from '@/lib/i18n/map-labels';
import { PHONE_MAX_WIDTH } from '@/lib/layout/phone';
import {
  getPhoneDetailOverlayStyle,
  getPhoneStripLabelLeft,
  getPhoneTickLabelsShown,
} from '@/lib/layout/phone-detail';
import { cn } from '@/lib/utils';
import { getLocale } from '@/paraglide/runtime';

const homeRoute = getRouteApi('/');
const STRIP_LOOK = {
  axisY: 36.55,
  stemTopY: 2.55,
  stemGapPx: 6,
  tickTopY: 58.55,
  tickBottomY: 64.55,
  tickLabelY: 66.5,
  labelGapPx: 6,
  ringGapPx: 5,
} as const;
const LABEL_CLASS_NAME = 'absolute text-label-s whitespace-nowrap uppercase';

type PhonePlacement = { labelLeft: number; ticksShown: boolean[] };

function getPercent(fraction: number): string {
  return `${fraction * 100}%`;
}

function getQuakeLabelStyle({ selected, isLabelAtEnd }: AreaStripLayout) {
  const offset = isLabelAtEnd ? -STRIP_LOOK.labelGapPx : STRIP_LOOK.labelGapPx;
  const transform = isLabelAtEnd ? 'translateX(-100%)' : undefined;
  return { left: `calc(${getPercent(selected.x)} + ${offset}px)`, transform };
}

function getQuakeLabelPlacement(strip: AreaStripLayout, phone: PhonePlacement | null) {
  if (phone === null) return getQuakeLabelStyle(strip);
  return { left: phone.labelLeft };
}

function isTickLabelHidden(phone: PhonePlacement | null, index: number): boolean {
  return phone?.ticksShown[index] === false;
}

function getStripLayout(
  data: EarthquakesResult | undefined,
  quake: string | undefined,
  interval: Interval,
) {
  const selected = getSelectedEarthquake(data?.earthquakes ?? [], quake);
  if (!data || !selected) return null;
  const range = getIntervalRange(interval, data.fetchedAt);
  const area = getAreaEarthquakes(data.earthquakes, selected);
  return {
    selected,
    area,
    strip: getAreaStrip({ earthquakes: area, selected, range }),
    ticks: getStripTicks(range, interval),
  };
}

export function AreaStrip() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const phoneLayout = usePhoneLayout();
  const locale = getLocale();
  const { quake, interval } = search;
  const layout = useMemo(() => getStripLayout(data, quake, interval), [data, quake, interval]);
  const figureRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [phonePlacement, setPhonePlacement] = useState<PhonePlacement | null>(null);

  useLayoutEffect(() => {
    const figure = figureRef.current;
    const label = labelRef.current;
    if (!layout || !figure || !label || window.innerWidth >= PHONE_MAX_WIDTH) {
      setPhonePlacement(null);
      return;
    }
    const measure = () => {
      const width = figure.clientWidth;
      const tickWidths = [...figure.querySelectorAll<HTMLElement>('[data-strip-tick]')].map(
        (tick) => tick.offsetWidth,
      );
      setPhonePlacement({
        labelLeft: getPhoneStripLabelLeft(layout.strip.selected.x, width, label.offsetWidth),
        ticksShown: getPhoneTickLabelsShown(
          layout.ticks.map((tick) => tick.x),
          width,
          tickWidths,
        ),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(figure);
    observer.observe(label);
    return () => observer.disconnect();
  }, [layout, phoneLayout, locale]);

  if (!layout) return null;

  const { selected, area, strip, ticks } = layout;
  const { axisY, ringGapPx, stemGapPx } = STRIP_LOOK;
  const selectedX = getPercent(strip.selected.x);

  return (
    <figure
      ref={figureRef}
      data-testid="area-strip"
      style={getPhoneDetailOverlayStyle(phoneLayout)}
      className="pointer-events-none absolute top-(--area-strip-top) right-[22px] left-[22px] block h-[111px] md:top-auto md:right-14 md:bottom-[57.55px] md:left-140 md:hidden lg:block"
    >
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <line x1="0" x2="100%" y1={axisY} y2={axisY} className="stroke-line-tick" />
        {ticks.map((tick) => (
          <line
            key={tick.time}
            x1={getPercent(tick.x)}
            x2={getPercent(tick.x)}
            y1={STRIP_LOOK.tickTopY}
            y2={STRIP_LOOK.tickBottomY}
            stroke={MAP_COLORS.muted}
          />
        ))}
        {strip.dots.map((dot) => (
          <circle
            key={dot.id}
            data-testid="area-strip-dot"
            cx={getPercent(dot.x)}
            cy={axisY}
            r={dot.radius}
            className="fill-line-tick"
          />
        ))}
        <line
          x1={selectedX}
          x2={selectedX}
          y1={STRIP_LOOK.stemTopY}
          y2={axisY - strip.selected.radius - stemGapPx}
          className="stroke-foreground"
        />
        <circle cx={selectedX} cy={axisY} r={strip.selected.radius} className="fill-accent" />
        <circle
          cx={selectedX}
          cy={axisY}
          r={strip.selected.radius + ringGapPx}
          className="fill-none stroke-foreground"
        />
      </svg>
      <span
        ref={labelRef}
        data-testid="area-strip-quake"
        className={`${LABEL_CLASS_NAME} top-0 text-accent`}
        style={getQuakeLabelPlacement(strip, phonePlacement)}
      >
        {getStripQuakeLabel(selected.time, locale)}
      </span>
      {ticks.map((tick, index) => (
        <span
          key={tick.time}
          data-strip-tick
          className={cn(
            LABEL_CLASS_NAME,
            '-translate-x-1/2 text-muted',
            isTickLabelHidden(phonePlacement, index) && 'invisible',
          )}
          style={{ left: getPercent(tick.x), top: STRIP_LOOK.tickLabelY }}
        >
          {getStripTickLabel(tick, locale)}
        </span>
      ))}
      <figcaption className="absolute right-0 bottom-0 left-0 pr-4 text-label-s text-muted uppercase md:top-[100px] md:right-auto md:bottom-auto md:pr-0 md:whitespace-nowrap">
        {getAreaCaption(interval, area.length, locale)}
      </figcaption>
    </figure>
  );
}
