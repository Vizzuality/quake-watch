import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { usePlaybackClock } from '@/containers/map/playback-context';
import { useEarthquakeSearch, useSetPlaybackSearch } from '@/hooks/use-earthquake-search';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import type { PlaybackWindow } from '@/lib/earthquakes/search-schema';
import {
  getHistogramBins,
  getHistogramUnit,
  getPlaybackRange,
  getTimelineRange,
} from '@/lib/earthquakes/timeline';
import {
  getEffectiveWindow,
  getIsSpaceToggleTarget,
  getQuantisedTime,
  getSearchKey,
  getShouldRefreshValueText,
  getSliderStepMs,
  getWindowEnd,
} from '@/lib/earthquakes/timeline-view';
import type { WindowEndOverride } from '@/lib/earthquakes/timeline-view';
import { getDateTimeFormat } from '@/lib/i18n/timeline-format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { Histogram } from './histogram';
import { PlaybackControls } from './playback-controls';
import { WindowSelect } from './window-select';

function getIsoTime(time: number): string {
  return new Date(time).toISOString();
}

export function Timeline() {
  const search = useEarthquakeSearch();
  const setPlayback = useSetPlaybackSearch();
  const clock = usePlaybackClock();
  const { data, isPending, isError } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const locale = getLocale();
  const earthquakes = data?.earthquakes;
  const { period, from, to } = search;
  const fetchedAt = data?.fetchedAt;
  const loaded = useMemo(
    () =>
      earthquakes && fetchedAt !== undefined
        ? getTimelineRange({ earthquakes, search: { period, from, to }, nowMs: fetchedAt })
        : null,
    [earthquakes, period, from, to, fetchedAt],
  );
  const searchKey = getSearchKey(search);
  const playbackWindow = getEffectiveWindow(search.period, search.window);
  const unit = getHistogramUnit(search.period);
  const dateTimeFormat = useMemo(() => getDateTimeFormat(locale), [locale]);

  const [override, setOverride] = useState<WindowEndOverride | null>(null);
  const windowEnd = getWindowEnd({ loaded, t: search.t, override, key: searchKey });
  const range =
    loaded && windowEnd !== null
      ? getPlaybackRange({ loaded, window: playbackWindow, t: windowEnd })
      : null;
  const rangeStart = range?.start;
  const rangeEnd = range?.end;
  const bins = useMemo(
    () => (earthquakes && loaded ? getHistogramBins(earthquakes, loaded, unit) : []),
    [earthquakes, loaded, unit],
  );
  const subscribe = useCallback(
    (onChange: () => void) => clock.subscribe(() => onChange()),
    [clock],
  );
  const isPlaying = useSyncExternalStore(subscribe, clock.isPlaying, clock.isPlaying);
  const sliderRef = useRef<HTMLInputElement>(null);
  const showEmpty = !isPending && !isError && !loaded;

  function pinWindowEnd(end: number | null) {
    if (end !== null) setOverride({ end, key: searchKey });
  }

  const writeT = useCallback((time: number) => setPlayback({ t: getIsoTime(time) }), [setPlayback]);

  function togglePlay() {
    if (clock.isPlaying()) {
      clock.pause();
      return;
    }
    if (!range) return;
    pinWindowEnd(windowEnd);
    clock.play(range);
  }

  function handleWindowEndChange(end: number) {
    clock.pause();
    pinWindowEnd(end);
  }

  function handleWindowEndCommit(end: number) {
    pinWindowEnd(end);
    writeT(end);
  }

  function handleWindowChange(next: PlaybackWindow) {
    clock.pause();
    pinWindowEnd(windowEnd);
    setPlayback(windowEnd === null ? { window: next } : { window: next, t: getIsoTime(windowEnd) });
  }

  function handleSliderChange(value: number) {
    if (!range) return;
    pinWindowEnd(windowEnd);
    clock.setT(getQuantisedTime(value, getSliderStepMs(playbackWindow), range));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const { target } = event;
    if (event.key !== ' ' || !(target instanceof Element)) return;
    if (
      !getIsSpaceToggleTarget({ tagName: target.tagName, type: (target as HTMLInputElement).type })
    ) {
      return;
    }
    event.preventDefault();
    togglePlay();
  }

  useEffect(() => {
    if (rangeStart === undefined || rangeEnd === undefined || windowEnd === null) return;
    if (clock.isPlaying()) return;
    clock.setRange({ start: rangeStart, end: rangeEnd });
    clock.setT(windowEnd);
  }, [clock, rangeStart, rangeEnd, windowEnd]);

  useEffect(() => {
    const input = sliderRef.current;
    if (!input) return undefined;
    let lastValueTextMs: number | null = null;
    const sync = (t: number, playing: boolean) => {
      input.value = String(t);
      const nowMs = performance.now();
      if (!getShouldRefreshValueText({ lastMs: lastValueTextMs, nowMs, isPlaying: playing })) {
        return;
      }
      lastValueTextMs = nowMs;
      input.setAttribute('aria-valuetext', dateTimeFormat.format(t));
    };
    sync(clock.getT(), clock.isPlaying());
    return clock.subscribe(sync);
  }, [clock, dateTimeFormat, rangeStart, rangeEnd]);

  useEffect(() => {
    let wasPlaying = clock.isPlaying();
    return clock.subscribe((t, playing) => {
      if (wasPlaying && !playing) writeT(t);
      wasPlaying = playing;
    });
  }, [clock, writeT]);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Space must toggle playback from any control inside the timeline region
    <section
      aria-label={m.timeline_label()}
      onKeyDown={handleKeyDown}
      className="absolute inset-x-3 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4rem))] rounded-lg bg-ink/70 px-3 py-2 text-xs text-muted backdrop-blur sm:inset-x-auto sm:bottom-8 sm:left-1/2 sm:w-full sm:max-w-3xl sm:-translate-x-1/2"
    >
      {isPending && <Skeleton className="h-28" />}
      {showEmpty && (
        <output className="flex h-[72px] items-center justify-center">{m.timeline_empty()}</output>
      )}
      {loaded && range && windowEnd !== null && (
        <Histogram
          bins={bins}
          unit={unit}
          loaded={loaded}
          windowRange={range}
          windowEnd={windowEnd}
          onWindowEndChange={handleWindowEndChange}
          onWindowEndCommit={handleWindowEndCommit}
        />
      )}
      {!isPending && (
        <div className="mt-2 flex items-center gap-2">
          <PlaybackControls
            isPlaying={isPlaying}
            disabled={!range}
            range={range}
            sliderRef={sliderRef}
            onToggle={togglePlay}
            onSliderChange={handleSliderChange}
            onSliderCommit={() => writeT(clock.getT())}
          />
          {search.period !== '24h' && (
            <WindowSelect value={playbackWindow} onValueChange={handleWindowChange} />
          )}
        </div>
      )}
    </section>
  );
}
