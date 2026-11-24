import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { getLiveSnapshot, playbackClock } from '@/lib/earthquakes/playback-clock';
import { getSpeedLabel } from '@/lib/earthquakes/time-ring';
import { getTooltipDate } from '@/lib/earthquakes/tooltip';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export function PlayIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M3 1.5L10 6L3 10.5V1.5Z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M4.9 1.5H2.5V10.5H4.9V1.5Z" />
      <path d="M9.5 1.5H7.1V10.5H9.5V1.5Z" />
    </svg>
  );
}

export function PlaybackControl() {
  const { isPlaying, range } = useSyncExternalStore(
    playbackClock.subscribe,
    playbackClock.getSnapshot,
    getLiveSnapshot,
  );
  const timeRef = useRef<HTMLParagraphElement>(null);
  const locale = getLocale();

  function handleToggle() {
    if (isPlaying) playbackClock.pause();
    else playbackClock.play();
  }

  useLayoutEffect(() => {
    const element = timeRef.current;
    if (!element || !range) return;
    const target = element;
    const end = range.end;
    function update() {
      const text = getTooltipDate(playbackClock.getPlayhead() ?? end, locale);
      if (target.textContent !== text) target.textContent = text;
    }
    update();
    return playbackClock.subscribeFrame(update);
  }, [range, locale]);

  if (!range) return null;
  return (
    <div
      data-label-obstacle
      className="pointer-events-auto absolute right-[65px] bottom-14 hidden items-center gap-4 md:flex"
    >
      <div className="flex flex-col items-end gap-1.5 whitespace-nowrap uppercase">
        <p ref={timeRef} className="text-label text-foreground" />
        <p className="text-label-s text-muted">
          {getSpeedLabel(range, locale)} · {m.timeline_scrub_hint({}, { locale })}
        </p>
      </div>
      <button
        type="button"
        aria-label={isPlaying ? m.timeline_pause({}, { locale }) : m.timeline_play({}, { locale })}
        onClick={handleToggle}
        className="flex size-[46px] shrink-0 cursor-pointer items-center justify-center rounded-pill border border-muted text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
    </div>
  );
}
