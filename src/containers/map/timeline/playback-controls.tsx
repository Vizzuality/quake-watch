import { Pause, Play } from 'lucide-react';
import type { KeyboardEvent, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import type { TimeRange } from '@/lib/earthquakes/timeline';
import { m } from '@/paraglide/messages';

const SLIDER_COMMIT_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function PlaybackControls({
  isPlaying,
  disabled,
  range,
  sliderRef,
  onToggle,
  onSliderChange,
  onSliderCommit,
}: {
  isPlaying: boolean;
  disabled: boolean;
  range: TimeRange | null;
  sliderRef: RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onSliderChange: (value: number) => void;
  onSliderCommit: () => void;
}) {
  const Icon = isPlaying ? Pause : Play;

  function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (SLIDER_COMMIT_KEYS.has(event.key)) onSliderCommit();
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={m.timeline_play()}
        aria-pressed={isPlaying}
        disabled={disabled}
        onClick={onToggle}
      >
        <Icon aria-hidden="true" className="size-4" />
      </Button>
      <input
        ref={sliderRef}
        type="range"
        aria-label={m.timeline_slider_label()}
        disabled={disabled}
        min={range?.start}
        max={range?.end}
        step="any"
        onChange={(event) => onSliderChange(event.currentTarget.valueAsNumber)}
        onPointerUp={onSliderCommit}
        onKeyUp={handleKeyUp}
        className="h-8 min-w-0 flex-1 cursor-pointer accent-fg disabled:cursor-not-allowed disabled:opacity-50"
      />
    </>
  );
}
