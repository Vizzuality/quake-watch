import { Pause, Play } from 'lucide-react';
import { type ChangeEvent, type KeyboardEvent, useId } from 'react';

import { Button } from '@/components/ui/button';
import { getKmLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { getPlayLabel } from './shakemap-labels';

const PROGRESS_STEP = 0.01;

function PlayIcon({ playing }: { playing: boolean }) {
  const Icon = playing ? Pause : Play;
  return <Icon aria-hidden className="size-4" />;
}

export function ShakemapPlayer({
  progress,
  playing,
  radiusKm,
  maxReachKm,
  onToggle,
  onSeek,
}: {
  progress: number;
  playing: boolean;
  radiusKm: number;
  maxReachKm: number;
  onToggle: () => void;
  onSeek: (progress: number) => void;
}) {
  const sliderId = useId();
  const locale = getLocale();
  const distance = getKmLabel(radiusKm, locale);
  const total = getKmLabel(maxReachKm, locale);

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
        max={1}
        step={PROGRESS_STEP}
        value={progress}
        aria-valuetext={m.detail_shakemap_slider_value({ distance, total })}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="h-8 min-w-40 flex-1 cursor-pointer accent-paper"
      />
      <span aria-hidden="true" className="text-sm text-paper tabular-nums">
        {m.detail_shakemap_slider_value({ distance, total })}
      </span>
    </div>
  );
}
