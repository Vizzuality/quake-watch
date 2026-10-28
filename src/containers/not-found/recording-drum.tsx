import { Pause, Play } from 'lucide-react';
import { useId, useState } from 'react';
import type { CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import { DRUM_TILE_WIDTH, getRowPoints, getSeededRandom } from '@/lib/not-found/drum';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

const ROW_COUNT = 12;
const ROW_GAP = 10;
const PAPER_MARGIN = 20;
const DRUM_HEIGHT = PAPER_MARGIN * 2 + (ROW_COUNT - 1) * ROW_GAP;
const PEN_X = DRUM_TILE_WIDTH * 0.85;
const SEED = 1906;
const OLDEST_ROW_OPACITY = 0.25;
const NEWEST_ROW_OPACITY = 0.7;
const TILE_OFFSETS = [0, DRUM_TILE_WIDTH];
const PAPER_FADE_CLASS_NAME =
  '[mask-image:linear-gradient(to_bottom,transparent,#000_15%,#000_85%,transparent)]';

function getPastRowOpacity(index: number): number {
  const age = index / (ROW_COUNT - 2);
  return OLDEST_ROW_OPACITY + age * (NEWEST_ROW_OPACITY - OLDEST_ROW_OPACITY);
}

const ROWS = Array.from({ length: ROW_COUNT }, (_, index) => {
  const y = PAPER_MARGIN + index * ROW_GAP;
  return { y, points: getRowPoints({ y, random: getSeededRandom(SEED + index) }) };
});
const LIVE_ROW = ROWS.at(-1)!;
const PAST_ROWS = ROWS.slice(0, -1).map((row, index) => ({
  ...row,
  opacity: getPastRowOpacity(index),
}));
const LIVE_ROW_PERCENT = (LIVE_ROW.y / DRUM_HEIGHT) * 100;
const PEN_PERCENT = (PEN_X / DRUM_TILE_WIDTH) * 100;

const SCROLL_CLASS_NAME = 'motion-safe:animate-drum-scroll';

function getScrollStyle(isPaused: boolean): CSSProperties {
  return { animationPlayState: isPaused ? 'paused' : 'running' };
}

function DrumRow({
  points,
  opacity,
  className,
}: {
  points: string;
  opacity?: number;
  className: string;
}) {
  return (
    <g opacity={opacity}>
      {TILE_OFFSETS.map((offset) => (
        <polyline
          key={offset}
          transform={`translate(${offset} 0)`}
          points={points}
          fill="none"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={className}
        />
      ))}
    </g>
  );
}

export function RecordingDrum() {
  const clipId = useId();
  const [isPaused, setIsPaused] = useState(false);
  const Icon = isPaused ? Play : Pause;
  const scrollStyle = getScrollStyle(isPaused);

  return (
    <div className="relative">
      <div
        data-drum
        aria-hidden="true"
        className="relative h-32 w-full overflow-hidden rounded-sm border border-line bg-surface sm:h-40"
      >
        <svg
          viewBox={`0 0 ${DRUM_TILE_WIDTH} ${DRUM_HEIGHT}`}
          preserveAspectRatio="none"
          className={cn('absolute inset-0 h-full w-full', PAPER_FADE_CLASS_NAME)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect width={PEN_X} height={DRUM_HEIGHT} />
            </clipPath>
          </defs>
          <g data-scroll className={SCROLL_CLASS_NAME} style={scrollStyle}>
            {PAST_ROWS.map(({ y, points, opacity }) => (
              <DrumRow
                key={y}
                points={points}
                opacity={opacity}
                className="stroke-line-strong stroke-1"
              />
            ))}
          </g>
          <g clipPath={`url(#${clipId})`} data-live-row>
            <g data-scroll className={SCROLL_CLASS_NAME} style={scrollStyle}>
              <DrumRow points={LIVE_ROW.points} className="stroke-mag-4 stroke-[1.5]" />
            </g>
          </g>
        </svg>
        <span
          className="absolute top-0 w-px -translate-x-1/2 bg-line-strong"
          style={{ left: `${PEN_PERCENT}%`, height: `${LIVE_ROW_PERCENT}%` }}
        />
        <span
          data-pen
          className="absolute size-2 -translate-1/2 rounded-full bg-mag-4"
          style={{ left: `${PEN_PERCENT}%`, top: `${LIVE_ROW_PERCENT}%` }}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.not_found_drum_pause()}
        aria-pressed={isPaused}
        onClick={() => setIsPaused((current) => !current)}
        className="absolute top-1 left-1 motion-reduce:hidden"
      >
        <Icon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
