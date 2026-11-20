import {
  type MouseEvent,
  type PointerEventHandler,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

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
import { getGlobeFrame } from '@/lib/globe/frame';
import { PHONE_MAX_WIDTH, getPhoneLayout } from '@/lib/layout/phone';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

export type QuakeTooltipVariant = 'full' | 'compact';
type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Band = { top: number; bottom: number };

type QuakeTooltipProps = {
  id: string;
  earthquake: Earthquake;
  now: number;
  variant: QuakeTooltipVariant;
  isPinned?: boolean;
  anchor: Point;
  containerSize: Size;
  onOpen: () => void;
  getWheelTarget: () => HTMLElement | null | undefined;
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
const PINNED = {
  width: 270,
  edgePx: 12,
  chromeGapPx: 8,
  pointGapPx: 12,
  belowPx: 22,
  abovePx: 214,
} as const;
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

function getPinnedLeft(x: number, containerWidth: number): number {
  const centred = x - PINNED.width / 2;
  return Math.max(PINNED.edgePx, Math.min(centred, containerWidth - PINNED.edgePx - PINNED.width));
}

function getPinnedBand({ width, height }: Size): Band {
  if (width >= PHONE_MAX_WIDTH) return { top: PINNED.edgePx, bottom: height - PINNED.edgePx };
  const { headerBottom, homeSheetTop } = getPhoneLayout(width, height);
  return {
    top: headerBottom + PINNED.chromeGapPx,
    bottom: homeSheetTop - PINNED.chromeGapPx,
  };
}

function getBelowTop(y: number, height: number, band: Band): number | null {
  const top = Math.min(y + PINNED.belowPx, band.bottom - height);
  return top >= y + PINNED.pointGapPx ? top : null;
}

function getAboveTop(y: number, height: number, band: Band): number | null {
  const preferred = Math.min(y - PINNED.abovePx, y - PINNED.pointGapPx - height);
  const top = Math.max(preferred, band.top);
  return top + height <= y - PINNED.pointGapPx ? top : null;
}

function getFallbackTop(y: number, height: number, band: Band): number {
  return band.bottom - y >= y - band.top ? band.bottom - height : band.top;
}

function getPinnedTop(y: number, height: number, containerSize: Size): number {
  const { cy } = getGlobeFrame(containerSize.width, containerSize.height);
  const band = getPinnedBand(containerSize);
  const below = getBelowTop(y, height, band);
  const above = getAboveTop(y, height, band);
  const [first, second] = y < cy ? [below, above] : [above, below];
  return first ?? second ?? getFallbackTop(y, height, band);
}

function getPosition(
  anchor: Point,
  size: Size,
  variant: QuakeTooltipVariant,
  containerSize: Size,
  isPinned: boolean,
): Point {
  if (isPinned) {
    return {
      x: getPinnedLeft(anchor.x, containerSize.width),
      y: getPinnedTop(anchor.y, size.height, containerSize),
    };
  }
  return {
    x: getTooltipLeft(anchor.x, size.width, containerSize.width),
    y: getTooltipTop(anchor.y, size.height, variant, containerSize.height),
  };
}

function getVariantClassName(variant: QuakeTooltipVariant, isPinned: boolean): string {
  return isPinned ? 'w-[270px] gap-2 p-4' : VARIANT_CLASS_NAME[variant];
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

function PinnedOpenButton({ onOpen }: { onOpen: () => void }) {
  const isPressedRef = useRef(false);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // The click of the tap that pinned the card lands here when the card covers the quake.
    const isPressed = isPressedRef.current;
    isPressedRef.current = false;
    if (event.detail > 0 && !isPressed) return;
    onOpen();
  }

  return (
    <button
      type="button"
      onPointerDown={() => {
        isPressedRef.current = true;
      }}
      onClick={handleClick}
      className="-my-[13px] flex min-h-11 cursor-pointer items-center gap-1.5 self-start pt-0.5 text-label uppercase after:absolute after:inset-0"
    >
      {m.tooltip_open_details()}
      <ArrowRightIcon />
    </button>
  );
}

function OpenButton({ isPinned, onOpen }: { isPinned: boolean; onOpen: () => void }) {
  if (isPinned) return <PinnedOpenButton onOpen={onOpen} />;
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-1.5 self-start pt-0.5 text-label uppercase"
    >
      {m.tooltip_click_to_open()}
      <ArrowRightIcon />
    </button>
  );
}

function FullContent({
  earthquake,
  now,
  locale,
  isPinned,
  onOpen,
}: {
  earthquake: Earthquake;
  now: number;
  locale: Locale;
  isPinned: boolean;
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
      <OpenButton isPinned={isPinned} onOpen={onOpen} />
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
  isPinned = false,
  anchor,
  containerSize,
  onOpen,
  getWheelTarget,
  onPointerEnter,
  onPointerLeave,
}: QuakeTooltipProps) {
  const locale = getLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [measuredSize, setMeasuredSize] = useState<Size | null>(null);
  const size = measuredSize ?? ESTIMATED_SIZE[variant];
  const position = getPosition(anchor, size, variant, containerSize, isPinned);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setMeasuredSize((current) => getMeasuredSize(current, element));
  }, [earthquake, variant, isPinned, locale]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    function handleWheel(event: WheelEvent) {
      const target = getWheelTarget();
      if (target && !target.dispatchEvent(new WheelEvent(event.type, event))) {
        event.preventDefault();
      }
    }
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [getWheelTarget]);

  return (
    <div
      ref={ref}
      id={id}
      role={isPinned ? undefined : 'tooltip'}
      className={`absolute flex flex-col border border-line glass-tooltip text-foreground ${getVariantClassName(variant, isPinned)}`}
      style={{ left: position.x, top: position.y }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {variant === 'full' ? (
        <FullContent
          earthquake={earthquake}
          now={now}
          locale={locale}
          isPinned={isPinned}
          onOpen={onOpen}
        />
      ) : (
        <CompactContent earthquake={earthquake} locale={locale} />
      )}
    </div>
  );
}
