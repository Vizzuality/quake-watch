import { type PointerEventHandler, useLayoutEffect, useRef, useState } from 'react';

import { getDepthColor } from '@/lib/earthquakes/depth-color';
import {
  getTooltipAge,
  getTooltipCompactMeta,
  getTooltipDate,
  getTooltipFelt,
  getTooltipMagnitude,
} from '@/lib/earthquakes/tooltip';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

export type QuakeTooltipVariant = 'full' | 'compact';
type Point = { x: number; y: number };
type Size = { width: number; height: number };

type QuakeTooltipProps = {
  id: string;
  earthquake: Earthquake;
  now: number;
  variant: QuakeTooltipVariant;
  anchor: Point;
  containerSize: Size;
  onOpen: () => void;
  onPointerEnter: PointerEventHandler<HTMLDivElement>;
  onPointerLeave: PointerEventHandler<HTMLDivElement>;
};

const ANCHOR_GAP_PX = 26;
const EDGE_PX = 16;
const ESTIMATED_SIZE: Record<QuakeTooltipVariant, Size> = {
  full: { width: 248, height: 200 },
  compact: { width: 260, height: 56 },
};
const TOOLTIP_RISE_PX: Record<QuakeTooltipVariant, number> = { full: 54, compact: 26 };
const VARIANT_CLASS_NAME: Record<QuakeTooltipVariant, string> = {
  full: 'w-62 gap-2 p-4',
  compact: 'gap-1 p-3 whitespace-nowrap',
};

function getClampedToEdges(value: number, size: number, containerSize: number): number {
  return Math.max(EDGE_PX, Math.min(value, containerSize - EDGE_PX - size));
}

function getTooltipLeft(x: number, width: number, containerWidth: number): number {
  const right = x + ANCHOR_GAP_PX;
  const left = right + width > containerWidth - EDGE_PX ? x - ANCHOR_GAP_PX - width : right;
  return getClampedToEdges(left, width, containerWidth);
}

function getTooltipTop(
  y: number,
  height: number,
  variant: QuakeTooltipVariant,
  containerHeight: number,
): number {
  return getClampedToEdges(y - TOOLTIP_RISE_PX[variant], height, containerHeight);
}

function getMeasuredSize(current: Size | null, element: HTMLElement): Size | null {
  const { width, height } = element.getBoundingClientRect();
  if (current?.width === width && current.height === height) return current;
  return { width, height };
}

function DepthDot({ depthKm, className }: { depthKm: number; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: getDepthColor(depthKm) }}
    />
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor" className="size-3.5">
      <path d="M220.24,132.24l-72,72a6,6,0,0,1-8.48-8.48L201.51,134H40a6,6,0,0,1,0-12H201.51L139.76,60.24a6,6,0,0,1,8.48-8.48l72,72A6,6,0,0,1,220.24,132.24Z" />
    </svg>
  );
}

function FullContent({
  earthquake,
  now,
  locale,
  onOpen,
}: {
  earthquake: Earthquake;
  now: number;
  locale: Locale;
  onOpen: () => void;
}) {
  const { magnitude, depthKm, time, place } = earthquake;

  return (
    <>
      <div className="flex items-center gap-2.5">
        <DepthDot depthKm={depthKm} className="size-2" />
        <span className="text-tooltip-value">{getTooltipMagnitude(magnitude, locale)}</span>
        <span className="ml-auto text-label-s text-muted uppercase">
          {getTooltipAge(time, now, locale)}
        </span>
      </div>
      <p className="text-body-s">{place ?? m.place_unknown()}</p>
      <p className="text-label-s text-muted uppercase">{getTooltipDate(time, locale)}</p>
      <div aria-hidden="true" className="h-px bg-line" />
      <dl className="flex gap-6">
        <div className="flex flex-col gap-0.5">
          <dt className="text-label-s text-muted uppercase">{m.col_depth()}</dt>
          <dd className="text-body-s">{getKmLabel(depthKm, locale)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-label-s text-muted uppercase">{m.tooltip_likely_felt()}</dt>
          <dd className="text-body-s">{getTooltipFelt(magnitude, depthKm, locale)}</dd>
        </div>
      </dl>
      <button
        type="button"
        tabIndex={-1}
        onClick={onOpen}
        className="flex cursor-pointer items-center gap-1.5 self-start pt-0.5 text-label uppercase"
      >
        {m.tooltip_click_to_open()}
        <ArrowRightIcon />
      </button>
    </>
  );
}

function CompactContent({ earthquake, locale }: { earthquake: Earthquake; locale: Locale }) {
  const { magnitude, depthKm, time, place } = earthquake;

  return (
    <>
      <div className="flex items-center gap-2">
        <DepthDot depthKm={depthKm} className="size-1.5" />
        <span className="text-body-s font-medium">{getTooltipMagnitude(magnitude, locale)}</span>
        <span className="text-label-s text-muted uppercase">
          {getTooltipCompactMeta(time, depthKm, locale)}
        </span>
      </div>
      <p className="text-place text-muted">{place ?? m.place_unknown()}</p>
    </>
  );
}

export function QuakeTooltip({
  id,
  earthquake,
  now,
  variant,
  anchor,
  containerSize,
  onOpen,
  onPointerEnter,
  onPointerLeave,
}: QuakeTooltipProps) {
  const locale = getLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [measuredSize, setMeasuredSize] = useState<Size | null>(null);
  const size = measuredSize ?? ESTIMATED_SIZE[variant];
  const left = getTooltipLeft(anchor.x, size.width, containerSize.width);
  const top = getTooltipTop(anchor.y, size.height, variant, containerSize.height);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setMeasuredSize((current) => getMeasuredSize(current, element));
  }, [earthquake, variant, locale]);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={`absolute flex flex-col border border-line glass-tooltip text-foreground ${VARIANT_CLASS_NAME[variant]}`}
      style={{ left, top }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {variant === 'full' ? (
        <FullContent earthquake={earthquake} now={now} locale={locale} onOpen={onOpen} />
      ) : (
        <CompactContent earthquake={earthquake} locale={locale} />
      )}
    </div>
  );
}
