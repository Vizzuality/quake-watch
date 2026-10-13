import type { EarthquakeSearch, Period, PlaybackWindow } from './search-schema';
import type { HistogramBin, HistogramUnit, TimeRange } from './timeline';

export type WindowEndOverride = { end: number; key: string };

const MINUTE_MS = 60_000;
const SLIDER_STEP_MS: Record<PlaybackWindow, number> = {
  '24h': MINUTE_MS,
  '7d': 10 * MINUTE_MS,
};
const DAY_MS = 24 * 60 * MINUTE_MS;
const PAGE_STEP_MS: Record<HistogramUnit, number> = { hour: DAY_MS, day: 7 * DAY_MS };
const BAR_MIN_HEIGHT = 2;
const BAR_TOP_PADDING = 4;
export const VALUE_TEXT_INTERVAL_MS = 1000;
const NON_TOGGLING_TAGS = new Set(['BUTTON', 'SELECT', 'TEXTAREA']);

export function getSearchKey(search: EarthquakeSearch): string {
  const { source, place, lat, lon, radius, period, from, to, minmag } = search;
  return JSON.stringify([source, place, lat, lon, radius, period, from, to, minmag]);
}

export function getEffectiveWindow(period: Period, window: PlaybackWindow): PlaybackWindow {
  return period === '24h' ? '24h' : window;
}

export function getSliderStepMs(window: PlaybackWindow): number {
  return SLIDER_STEP_MS[window];
}

export function getClampedTime(time: number, loaded: TimeRange): number {
  return Math.min(loaded.end, Math.max(loaded.start, time));
}

export function getWindowEnd(input: {
  loaded: TimeRange | null;
  t: string | undefined;
  override: WindowEndOverride | null;
  key: string;
}): number | null {
  const { loaded, t, override, key } = input;
  if (!loaded) return null;
  if (override?.key === key) return getClampedTime(override.end, loaded);
  const parsed = t === undefined ? Number.NaN : Date.parse(t);
  return Number.isNaN(parsed) ? loaded.end : getClampedTime(parsed, loaded);
}

export function getTimeAtFraction(loaded: TimeRange, fraction: number): number {
  return getClampedTime(loaded.start + fraction * (loaded.end - loaded.start), loaded);
}

export function getBinIndexAtFraction(binCount: number, fraction: number): number {
  return Math.min(binCount - 1, Math.max(0, Math.floor(fraction * binCount)));
}

export function getSteppedWindowEnd(input: {
  bins: HistogramBin[];
  loaded: TimeRange;
  current: number;
  direction: 1 | -1;
}): number {
  const { bins, loaded, current, direction } = input;
  const bin = bins.find(({ start, end }) => current >= start && current < end) ?? bins.at(-1);
  const step = bin ? bin.end - bin.start : MINUTE_MS;
  return getClampedTime(current + direction * step, loaded);
}

export function getQuantisedTime(time: number, stepMs: number, range: TimeRange): number {
  return getClampedTime(Math.round(time / stepMs) * stepMs, range);
}

export function getKeyedWindowEnd(input: {
  key: string;
  bins: HistogramBin[];
  loaded: TimeRange;
  current: number;
  unit: HistogramUnit;
}): number | null {
  const { key, bins, loaded, current, unit } = input;
  if (key === 'Home') return loaded.start;
  if (key === 'End') return loaded.end;
  if (key === 'ArrowLeft') return getSteppedWindowEnd({ bins, loaded, current, direction: -1 });
  if (key === 'ArrowRight') return getSteppedWindowEnd({ bins, loaded, current, direction: 1 });
  if (key === 'PageUp') return getClampedTime(current + PAGE_STEP_MS[unit], loaded);
  if (key === 'PageDown') return getClampedTime(current - PAGE_STEP_MS[unit], loaded);
  return null;
}

export function getBarHeight(count: number, maxCount: number, plotHeight: number): number {
  if (count === 0) return 0;
  return Math.max(BAR_MIN_HEIGHT, (count / maxCount) * (plotHeight - BAR_TOP_PADDING));
}

export function getBarClassName(isHovered: boolean): string {
  return isHovered ? 'fill-paper' : 'fill-muted';
}

export function getShouldRefreshValueText(input: {
  lastMs: number | null;
  nowMs: number;
  isPlaying: boolean;
}): boolean {
  const { lastMs, nowMs, isPlaying } = input;
  if (!isPlaying || lastMs === null) return true;
  return nowMs - lastMs >= VALUE_TEXT_INTERVAL_MS;
}

export function getBarPath(input: {
  x: number;
  width: number;
  height: number;
  baseline: number;
  radius: number;
}): string {
  const { x, width, height, baseline, radius } = input;
  const r = Math.min(radius, height, width / 2);
  const top = baseline - height;
  return [
    `M${x} ${baseline}`,
    `V${top + r}`,
    `Q${x} ${top} ${x + r} ${top}`,
    `H${x + width - r}`,
    `Q${x + width} ${top} ${x + width} ${top + r}`,
    `V${baseline}`,
    'Z',
  ].join('');
}

export function getIsSpaceToggleTarget(element: { tagName: string; type?: string }): boolean {
  if (NON_TOGGLING_TAGS.has(element.tagName)) return false;
  return element.tagName !== 'INPUT' || element.type === 'range';
}
