import { Pause, Play } from 'lucide-react';
import { type ChangeEvent, type KeyboardEvent, useId } from 'react';

import { Button } from '@/components/ui/button';
import { getDecimalLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { getPlayLabel } from './shaking-labels';

const SLIDER_STEP_SECONDS = 1;

function PlayIcon({ playing }: { playing: boolean }) {
  const Icon = playing ? Pause : Play;
  return <Icon aria-hidden className="size-4" />;
}

export function WavePlayer({
  seconds,
  durationSeconds,
  playing,
  onToggle,
  onSeek,
}: {
  seconds: number;
  durationSeconds: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}) {
  const sliderId = useId();
  const locale = getLocale();
  const wholeSeconds = Math.round(seconds);
  const secondsLabel = getDecimalLabel(wholeSeconds, locale);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onSeek(Number(event.target.value));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== ' ') return;
    event.preventDefault();
    onToggle();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button size="icon" aria-label={getPlayLabel(playing)} onClick={onToggle}>
        <PlayIcon playing={playing} />
      </Button>
      <label htmlFor={sliderId} className="text-sm text-muted">
        {m.detail_shakemap_slider_label()}
      </label>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={durationSeconds}
        step={SLIDER_STEP_SECONDS}
        value={wholeSeconds}
        aria-valuetext={m.detail_shakemap_slider_value({
          seconds: secondsLabel,
          total: getDecimalLabel(durationSeconds, locale),
        })}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="h-8 min-w-40 flex-1 cursor-pointer accent-paper"
      />
      <span aria-hidden="true" className="flex items-baseline gap-1.5">
        <span className="min-w-14 text-right text-base font-semibold text-paper tabular-nums">
          {m.detail_shakemap_clock({ seconds: secondsLabel })}
        </span>
        <span className="text-xs text-muted">{m.detail_shakemap_clock_caption()}</span>
      </span>
    </div>
  );
}
