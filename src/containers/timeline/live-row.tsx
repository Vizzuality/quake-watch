import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { getLiveSnapshot, playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { getTooltipDate } from '@/lib/earthquakes/tooltip';
import { getShortElapsedLabel } from '@/lib/format';
import { PHONE_QUERY } from '@/lib/layout/phone';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

import { PauseIcon, PlayIcon } from './playback-control';

const homeRoute = getRouteApi('/');
const CLOCK_TICK_MS = 1000;
let clockNow: number | null = null;

function subscribeClock(listener: () => void): () => void {
  const phone = window.matchMedia(PHONE_QUERY);
  let intervalId: number | undefined;
  function tick() {
    clockNow = Date.now();
    listener();
  }
  function sync() {
    window.clearInterval(intervalId);
    intervalId = undefined;
    if (!phone.matches) return;
    tick();
    intervalId = window.setInterval(tick, CLOCK_TICK_MS);
  }
  sync();
  phone.addEventListener('change', sync);
  return () => {
    window.clearInterval(intervalId);
    phone.removeEventListener('change', sync);
  };
}

function getClockSnapshot(): number | null {
  return clockNow;
}

function getServerClockSnapshot(): null {
  return null;
}

function getUpdatedLine(fetchedAt: number | undefined, now: number | null, locale: Locale): string {
  const checks = m.live_row_checks({}, { locale });
  if (fetchedAt === undefined || now === null) return checks;
  const ago = getShortElapsedLabel(Math.max(0, now - fetchedAt), locale);
  return `${m.live_row_updated({ ago }, { locale })} · ${checks}`;
}

function PlayheadDate({ end }: { end: number }) {
  const timeRef = useRef<HTMLParagraphElement>(null);
  const locale = getLocale();

  useLayoutEffect(() => {
    const element = timeRef.current;
    if (!element) return;
    const target = element;
    function update() {
      const text = getTooltipDate(playbackClock.getPlayhead() ?? end, locale);
      if (target.textContent !== text) target.textContent = text;
    }
    update();
    return playbackClock.subscribeFrame(update);
  }, [end, locale]);

  return <p ref={timeRef} className="text-caption-bold text-foreground uppercase" />;
}

export function LiveRow() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const { isPlaying, playhead, range } = useSyncExternalStore(
    playbackClock.subscribe,
    playbackClock.getSnapshot,
    getLiveSnapshot,
  );
  const locale = getLocale();
  const now = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);
  const isLive = playhead === null;

  function handleToggle() {
    if (isPlaying) playbackClock.pause();
    else playbackClock.play();
  }

  return (
    <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3.5 md:hidden">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {isLive || !range ? (
          <>
            <p className="text-caption-bold text-accent uppercase">
              {m.live_row_now({}, { locale })}
            </p>
            <p
              data-testid="live-updated"
              className="line-clamp-2 text-caption text-muted uppercase"
            >
              {getUpdatedLine(data?.fetchedAt, now, locale)}
            </p>
          </>
        ) : (
          <>
            <PlayheadDate end={range.end} />
            <p className="line-clamp-2 text-caption text-muted uppercase">
              {m.timeline_scrub_hint({}, { locale })}
            </p>
          </>
        )}
      </div>
      <button
        type="button"
        aria-label={isPlaying ? m.timeline_pause({}, { locale }) : m.timeline_play({}, { locale })}
        disabled={!range}
        onClick={handleToggle}
        className="group -m-px flex size-11 shrink-0 cursor-pointer items-center justify-center disabled:cursor-default disabled:opacity-50"
      >
        <span className="flex size-[42px] items-center justify-center rounded-pill border border-foreground text-foreground transition-colors group-hover:border-accent group-hover:text-accent">
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </span>
      </button>
    </div>
  );
}
