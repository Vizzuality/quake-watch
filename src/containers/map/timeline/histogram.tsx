import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import type { HistogramBin, HistogramUnit, TimeRange } from '@/lib/earthquakes/timeline';
import {
  getBarClassName,
  getBarHeight,
  getBarPath,
  getBinIndexAtFraction,
  getClampedTime,
  getKeyedWindowEnd,
  getTimeAtFraction,
} from '@/lib/earthquakes/timeline-view';
import { getEarthquakeCountLabel } from '@/lib/i18n/earthquake-count';
import { getBinDateFormat, getDateTimeFormat } from '@/lib/i18n/timeline-format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

const PLOT_HEIGHT = 44;
const BAR_GAP = 2;
const BAR_RADIUS = 4;
const TOOLTIP_HALF_WIDTH = 72;

function observeWidth(element: HTMLElement, onWidth: (width: number) => void) {
  const observer = new ResizeObserver(([entry]) => onWidth(entry.contentRect.width));
  observer.observe(element);
  onWidth(element.getBoundingClientRect().width);
  return () => observer.disconnect();
}

function getPointerFraction(event: PointerEvent<SVGSVGElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  return rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
}

export function Histogram({
  bins,
  unit,
  loaded,
  windowRange,
  windowEnd,
  onWindowEndChange,
  onWindowEndCommit,
}: {
  bins: HistogramBin[];
  unit: HistogramUnit;
  loaded: TimeRange;
  windowRange: TimeRange;
  windowEnd: number;
  onWindowEndChange: (time: number) => void;
  onWindowEndCommit: (time: number) => void;
}) {
  const locale = getLocale();
  const hintId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  const binFormat = getBinDateFormat(unit, locale);
  const dateTimeFormat = getDateTimeFormat(locale);
  const axis: TimeRange = { start: bins[0].start, end: bins[bins.length - 1].end };
  const axisSpan = axis.end - axis.start;
  const maxCount = Math.max(1, ...bins.map(({ count }) => count));
  const slotWidth = width / bins.length;
  const getX = (time: number) => ((time - axis.start) / axisSpan) * width;
  const getBinLabel = ({ start, count }: HistogramBin) =>
    m.timeline_bar_tooltip({
      date: binFormat.format(start),
      count: getEarthquakeCountLabel(count, locale),
    });
  const hoveredBin = hovered === null ? null : bins[hovered];

  function getTimeAtPointer(event: PointerEvent<SVGSVGElement>): number {
    return getClampedTime(getTimeAtFraction(axis, getPointerFraction(event)), loaded);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    isDragging.current = true;
    onWindowEndChange(getTimeAtPointer(event));
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    setHovered(getBinIndexAtFraction(bins.length, getPointerFraction(event)));
    if (isDragging.current) onWindowEndChange(getTimeAtPointer(event));
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!isDragging.current) return;
    isDragging.current = false;
    onWindowEndCommit(getTimeAtPointer(event));
  }

  function endDrag() {
    if (!isDragging.current) return;
    isDragging.current = false;
    onWindowEndCommit(windowEnd);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const next = getKeyedWindowEnd({ key: event.key, bins, loaded, current: windowEnd, unit });
    if (next === null) return;
    event.preventDefault();
    onWindowEndChange(next);
    onWindowEndCommit(next);
  }

  useEffect(() => {
    const wrapper = wrapperRef.current;
    return wrapper ? observeWidth(wrapper, setWidth) : undefined;
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      {hoveredBin ? (
        <div
          aria-hidden="true"
          data-testid="timeline-bar-tooltip"
          className="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 rounded-sm border border-line-strong bg-surface px-2 py-1 whitespace-nowrap text-fg tabular-nums"
          style={{
            left: Math.min(
              Math.max(slotWidth * (hovered ?? 0) + slotWidth / 2, TOOLTIP_HALF_WIDTH),
              Math.max(width - TOOLTIP_HALF_WIDTH, TOOLTIP_HALF_WIDTH),
            ),
          }}
        >
          {getBinLabel(hoveredBin)}
        </div>
      ) : null}
      <svg
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- no native input renders a histogram; slider is the ARIA pattern for a draggable position
        role="slider"
        tabIndex={0}
        aria-label={m.timeline_histogram_label()}
        aria-describedby={hintId}
        aria-valuemin={loaded.start}
        aria-valuemax={loaded.end}
        aria-valuenow={windowEnd}
        aria-valuetext={dateTimeFormat.format(windowEnd)}
        width={width}
        height={PLOT_HEIGHT}
        className="block cursor-pointer touch-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerLeave={() => setHovered(null)}
        onKeyDown={handleKeyDown}
      >
        <rect
          data-testid="window-band"
          x={getX(windowRange.start)}
          y={0}
          width={Math.max(1, getX(windowRange.end) - getX(windowRange.start))}
          height={PLOT_HEIGHT}
          className="fill-mag-4/15"
        />
        <line
          x1={0}
          x2={width}
          y1={PLOT_HEIGHT - 0.5}
          y2={PLOT_HEIGHT - 0.5}
          className="stroke-line"
        />
        {width > 0 &&
          bins.map((bin, index) => (
            <path
              key={bin.start}
              data-bar=""
              d={getBarPath({
                x: slotWidth * index + BAR_GAP / 2,
                width: Math.max(1, slotWidth - BAR_GAP),
                height: getBarHeight(bin.count, maxCount, PLOT_HEIGHT),
                baseline: PLOT_HEIGHT,
                radius: BAR_RADIUS,
              })}
              className={getBarClassName(hovered === index)}
            />
          ))}
      </svg>
      <div
        aria-hidden="true"
        className="flex h-4 items-center justify-between text-2xs text-muted tabular-nums"
      >
        <span>{binFormat.format(loaded.start)}</span>
        <span>{binFormat.format(loaded.end)}</span>
      </div>
      <p id={hintId} className="sr-only">
        {m.timeline_histogram_hint()}
      </p>
      <ul className="sr-only">
        {bins.map((bin) => (
          <li key={bin.start}>{getBinLabel(bin)}</li>
        ))}
      </ul>
    </div>
  );
}
