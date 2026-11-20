import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { getLiveSnapshot, playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import {
  RING_OBSTACLE_SELECTOR,
  type RingTick,
  TIME_RING_LOOK,
  getActiveRingTicks,
  getNeedleEarthquake,
  getPastWedgePath,
  getRingAngle,
  getRingBarPath,
  getRingBarsPath,
  getRingFraction,
  getRingFractionAt,
  getRingMarks,
  getRingPoint,
  getRingTicks,
  getScrubStepMs,
  isRingLabelBlocked,
} from '@/lib/earthquakes/time-ring';
import type { TimeRange } from '@/lib/earthquakes/timeline';
import { getTooltipDate, getTooltipMagnitude } from '@/lib/earthquakes/tooltip';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getGlobeFrame } from '@/lib/globe/frame';
import { PHONE_QUERY } from '@/lib/layout/phone';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

type Size = { width: number; height: number };

const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const homeRoute = getRouteApi('/');
const R0 = TIME_RING_LOOK.radius;
const PAST_CLIP_RADIUS = R0 + TIME_RING_LOOK.barInset + TIME_RING_LOOK.barMax + 4;
const HIT_RADIUS = R0 + (TIME_RING_LOOK.hitOuter - TIME_RING_LOOK.hitInner) / 2;
const HIT_WIDTH = TIME_RING_LOOK.hitOuter + TIME_RING_LOOK.hitInner;
const PAGE_STEPS = 6;
const SVG_NS = 'http://www.w3.org/2000/svg';
const ACTIVE_BAR_OPACITY = '0.95';

function getDegrees(fraction: number): number {
  return (getRingAngle(fraction) * 180) / Math.PI + 90;
}

function getPlayheadFraction(range: TimeRange): number {
  const playhead = playbackClock.getPlayhead();
  if (playhead === null) return 1;
  return getRingFraction(playhead, range);
}

function getActiveBarElement(tick: RingTick): SVGPathElement {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', getRingBarPath(tick));
  path.setAttribute('stroke', tick.color);
  path.setAttribute('stroke-opacity', ACTIVE_BAR_OPACITY);
  path.setAttribute('stroke-width', String(TIME_RING_LOOK.activeBarWidth));
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  return path;
}

function syncActiveBars(group: SVGGElement | null, active: readonly RingTick[]) {
  if (!group) return;
  const ids = active.map(({ id }) => id).join(' ');
  if (group.dataset.ids === ids) return;
  group.dataset.ids = ids;
  group.replaceChildren(...active.map(getActiveBarElement));
}

function getKeyTarget(key: string, current: number, range: TimeRange): number | null {
  const step = getScrubStepMs(range);
  const targets: Record<string, number> = {
    ArrowRight: current + step,
    ArrowUp: current + step,
    ArrowLeft: current - step,
    ArrowDown: current - step,
    PageUp: current + step * PAGE_STEPS,
    PageDown: current - step * PAGE_STEPS,
    Home: range.start,
    End: range.end,
  };
  return targets[key] ?? null;
}

function getWheelTarget(event: WheelEvent, svg: SVGSVGElement): Element | undefined {
  return document
    .elementsFromPoint(event.clientX, event.clientY)
    .find((element) => !svg.contains(element));
}

function getNeedleTitle(earthquake: Earthquake, locale: Locale): string {
  const place = earthquake.place ?? m.place_unknown({}, { locale });
  return `${getTooltipMagnitude(earthquake.magnitude, locale)} · ${place}`;
}

function getNeedleDate(time: number, locale: Locale): string {
  return getTooltipDate(time, locale).replace(/ UTC$/, '');
}

function getObstacles(): Element[] {
  if (window.matchMedia(PHONE_QUERY).matches) return [];
  return [...document.querySelectorAll(RING_OBSTACLE_SELECTOR)];
}

function getLabelVisibility(isBlocked: boolean): 'hidden' | 'visible' {
  return isBlocked ? 'hidden' : 'visible';
}

function syncLabelVisibility(group: SVGGElement, obstacles: readonly Element[]) {
  const boxes = obstacles
    .map((obstacle) => obstacle.getBoundingClientRect())
    .filter(({ width, height }) => width > 0 && height > 0);
  for (const label of group.querySelectorAll('text')) {
    const isBlocked = isRingLabelBlocked(label.getBoundingClientRect(), boxes);
    label.setAttribute('visibility', getLabelVisibility(isBlocked));
  }
}

function getTextAnchor(isRight: boolean): 'start' | 'end' {
  return isRight ? 'start' : 'end';
}

function NeedleLabel({
  centre,
  scale,
  playhead,
  range,
  earthquakes,
  locale,
}: {
  centre: { x: number; y: number };
  scale: number;
  playhead: number;
  range: TimeRange;
  earthquakes: readonly Earthquake[];
  locale: Locale;
}) {
  const angle = getRingAngle(getRingFraction(playhead, range));
  const dot = getRingPoint(angle, (R0 + TIME_RING_LOOK.dotOffset) * scale);
  const isRight = Math.cos(angle) >= -0.05;
  const gap = TIME_RING_LOOK.needleLabelGap * scale;
  const x = centre.x + dot.x + (isRight ? gap : -gap);
  const y = centre.y + dot.y;
  const earthquake = getNeedleEarthquake(earthquakes, playhead, range);
  const dateY = earthquake ? y + TIME_RING_LOOK.needleLabelLine : y;

  return (
    <g
      aria-hidden="true"
      textAnchor={getTextAnchor(isRight)}
      dominantBaseline="middle"
      className="text-caption uppercase"
    >
      {earthquake && (
        <text x={x} y={y} className="fill-accent">
          {getNeedleTitle(earthquake, locale)}
        </text>
      )}
      <text x={x} y={dateY} className="fill-foreground">
        {getNeedleDate(playhead, locale)}
      </text>
    </g>
  );
}

export function TimeRing({ opacity }: { opacity: number }) {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const { isPlaying, playhead, range } = useSyncExternalStore(
    playbackClock.subscribe,
    playbackClock.getSnapshot,
    getLiveSnapshot,
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const clipRef = useRef<SVGPathElement>(null);
  const needleRef = useRef<SVGGElement>(null);
  const activeRef = useRef<SVGGElement>(null);
  const hitRef = useRef<SVGCircleElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const isDraggingRef = useRef(false);
  const clipId = useId();
  const [size, setSize] = useState<Size | null>(null);
  const locale = getLocale();
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const ticks = useMemo(
    () => (range ? getRingTicks(earthquakes, range) : []),
    [earthquakes, range],
  );
  const barsPath = useMemo(() => getRingBarsPath(ticks), [ticks]);
  const marks = range ? getRingMarks(range, locale) : [];
  const marksKey = marks.map(({ fraction, label }) => `${fraction}:${label}`).join(' ');
  const isLive = playhead === null;
  const frame = size && getGlobeFrame(size.width, size.height);
  const isInteractive = opacity > 0 && range !== null;
  const value = playhead ?? range?.end ?? 0;

  function seekTo(event: PointerEvent<SVGCircleElement>) {
    const svg = svgRef.current;
    if (!svg || !range || !frame) return;
    const rect = svg.getBoundingClientRect();
    const fraction = getRingFractionAt(
      event.clientX - rect.left - frame.cx,
      event.clientY - rect.top - frame.cy,
    );
    playbackClock.seek(range.start + fraction * (range.end - range.start));
  }

  function handlePointerDown(event: PointerEvent<SVGCircleElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    seekTo(event);
  }

  function handlePointerMove(event: PointerEvent<SVGCircleElement>) {
    if (isDraggingRef.current) seekTo(event);
  }

  function handlePointerUp() {
    isDraggingRef.current = false;
  }

  function handleKeyDown(event: KeyboardEvent<SVGCircleElement>) {
    if (!range) return;
    const current = playbackClock.getPlayhead() ?? range.end;
    const target = getKeyTarget(event.key, current, range);
    if (target === null) return;
    event.preventDefault();
    playbackClock.seek(target);
  }

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: svg.clientWidth, height: svg.clientHeight });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!range) return;
    const ringRange = range;
    if (activeRef.current) delete activeRef.current.dataset.ids;
    function update() {
      const fraction = getPlayheadFraction(ringRange);
      const playhead = playbackClock.getPlayhead() ?? ringRange.end;
      clipRef.current?.setAttribute('d', getPastWedgePath(fraction, PAST_CLIP_RADIUS));
      needleRef.current?.setAttribute('transform', `rotate(${getDegrees(fraction)})`);
      syncActiveBars(activeRef.current, getActiveRingTicks(ticks, playhead));
    }
    update();
    return playbackClock.subscribeFrame(update);
  }, [range, ticks, isLive, size]);

  useLayoutEffect(() => {
    const group = labelsRef.current;
    if (!group || !size) return;
    const labels = group;
    const obstacles = getObstacles();
    let isCurrent = true;
    function update() {
      if (isCurrent) syncLabelVisibility(labels, obstacles);
    }
    update();
    void document.fonts.ready.then(update);
    const observer = new ResizeObserver(update);
    for (const obstacle of obstacles) observer.observe(obstacle);
    return () => {
      isCurrent = false;
      observer.disconnect();
    };
  }, [size, marksKey]);

  useEffect(() => {
    const hit = hitRef.current;
    const svg = svgRef.current;
    if (!hit || !svg) return;
    const ringSvg = svg;
    function handleWheel(event: WheelEvent) {
      const target = getWheelTarget(event, ringSvg);
      if (target && !target.dispatchEvent(new WheelEvent(event.type, event))) {
        event.preventDefault();
      }
    }
    hit.addEventListener('wheel', handleWheel, { passive: false });
    return () => hit.removeEventListener('wheel', handleWheel);
  }, [isInteractive, size]);

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      style={{ opacity }}
      aria-hidden={!isInteractive}
    >
      {frame && range && (
        <>
          <g transform={`translate(${frame.cx} ${frame.cy}) scale(${frame.scale})`}>
            <clipPath id={clipId}>
              <path ref={clipRef} />
            </clipPath>
            <circle r={R0} fill="none" className="stroke-line" />
            <path d={barsPath} vectorEffect="non-scaling-stroke" className="stroke-foreground/9" />
            <path
              d={barsPath}
              clipPath={`url(#${clipId})`}
              vectorEffect="non-scaling-stroke"
              className="stroke-foreground/40"
            />
            <g ref={activeRef} data-testid="time-ring-active" />
            {marks.map(({ fraction }) => {
              const angle = getRingAngle(fraction);
              const from = getRingPoint(angle, R0 - TIME_RING_LOOK.markLength);
              const to = getRingPoint(angle, R0);
              return (
                <line
                  key={fraction}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className="stroke-muted"
                />
              );
            })}
            <line
              x1={0}
              y1={-(R0 - TIME_RING_LOOK.nowInner)}
              x2={0}
              y2={-(R0 + TIME_RING_LOOK.nowOuter)}
              strokeWidth={isLive ? 2 : 1}
              className={isLive ? 'stroke-accent' : 'stroke-foreground'}
            />
            {!isLive && (
              <g ref={needleRef} className="fill-accent stroke-accent">
                <line
                  x1={0}
                  y1={-(R0 + TIME_RING_LOOK.needleInner)}
                  x2={0}
                  y2={-(R0 + TIME_RING_LOOK.needleOuter)}
                  strokeWidth={2}
                />
                <circle
                  cy={-(R0 + TIME_RING_LOOK.dotOffset)}
                  r={TIME_RING_LOOK.dotRadius}
                  stroke="none"
                />
              </g>
            )}
            {isInteractive && (
              <>
                <circle
                  ref={hitRef}
                  r={HIT_RADIUS}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_WIDTH}
                  tabIndex={0}
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an <input type="range"> cannot take the shape of the ring
                  role="slider"
                  aria-label={m.timeline_label({}, { locale })}
                  aria-valuemin={range.start}
                  aria-valuemax={range.end}
                  aria-valuenow={value}
                  aria-valuetext={getTooltipDate(value, locale)}
                  pointerEvents="stroke"
                  className="peer cursor-ew-resize outline-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onKeyDown={handleKeyDown}
                />
                <circle
                  r={R0}
                  fill="none"
                  strokeWidth={2}
                  className="pointer-events-none stroke-foreground opacity-0 peer-focus-visible:opacity-100"
                />
              </>
            )}
          </g>
          <g
            aria-hidden="true"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-label-s uppercase"
          >
            <g ref={labelsRef} data-testid="time-ring-labels">
              {marks.flatMap(({ fraction, label }) => {
                if (label === null) return [];
                const point = getRingPoint(
                  getRingAngle(fraction),
                  (R0 + TIME_RING_LOOK.labelOffset) * frame.scale,
                );
                return (
                  <text
                    key={fraction}
                    x={frame.cx + point.x}
                    y={frame.cy + point.y}
                    className="fill-muted"
                  >
                    {label}
                  </text>
                );
              })}
            </g>
            <text
              x={frame.cx}
              y={frame.cy - (R0 + TIME_RING_LOOK.nowLabelOffset) * frame.scale}
              className={isLive ? 'fill-accent' : 'fill-foreground'}
            >
              {m.timeline_now({}, { locale })}
            </text>
          </g>
          {playhead !== null && !isPlaying && (
            <NeedleLabel
              centre={{ x: frame.cx, y: frame.cy }}
              scale={frame.scale}
              playhead={playhead}
              range={range}
              earthquakes={earthquakes}
              locale={locale}
            />
          )}
        </>
      )}
    </svg>
  );
}
