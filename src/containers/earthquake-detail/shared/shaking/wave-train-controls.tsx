import { Info, Pause, Play } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

import { getPlayLabel } from './shaking-labels';

function PlayIcon({ playing }: { playing: boolean }) {
  const Icon = playing ? Pause : Play;
  return <Icon aria-hidden className="size-4" />;
}

export function WaveTrainControls({
  playing,
  onToggle,
  legend,
}: {
  playing: boolean;
  onToggle: () => void;
  legend: ReactNode;
}) {
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const legendButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) return;
      setOpen(false);
      legendButton.current?.focus();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div ref={root} className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          aria-label={getPlayLabel(playing)}
          onClick={onToggle}
          className="touch-manipulation"
        >
          <PlayIcon playing={playing} />
        </Button>
        <Button
          ref={legendButton}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="touch-manipulation"
        >
          <Info aria-hidden className="size-4" />
          {m.detail_map_legend()}
        </Button>
      </div>
      <div
        id={panelId}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- no native element labels a non-form group without adding a region landmark per map
        role="group"
        aria-label={m.detail_map_legend()}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the panel scrolls and may hold only text; WCAG 2.1.1 needs it focusable so keyboard users can scroll it (axe scrollable-region-focusable)
        tabIndex={0}
        hidden={!open}
        className="flex max-h-[9.5rem] w-[min(20rem,calc(100vw-3rem))] [scrollbar-width:thin] flex-col gap-3 overflow-y-auto overscroll-contain rounded-md border border-line bg-canvas/90 p-3 text-xs/relaxed text-fg backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg sm:max-h-[13.5rem]"
      >
        {legend}
      </div>
    </div>
  );
}
