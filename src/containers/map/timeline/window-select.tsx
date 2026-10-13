import { SegmentedControl } from '@/components/ui/segmented-control';
import { PLAYBACK_WINDOWS } from '@/lib/earthquakes/search-schema';
import type { PlaybackWindow } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

function getWindowLabel(window: PlaybackWindow): string {
  const labels: Record<PlaybackWindow, () => string> = {
    '24h': m.timeline_window_24h,
    '7d': m.timeline_window_7d,
  };
  return labels[window]();
}

export function WindowSelect({
  value,
  onValueChange,
}: {
  value: PlaybackWindow;
  onValueChange: (value: PlaybackWindow) => void;
}) {
  return (
    <SegmentedControl
      label={m.timeline_window_label()}
      value={value}
      options={PLAYBACK_WINDOWS.map((window) => ({ value: window, label: getWindowLabel(window) }))}
      onValueChange={onValueChange}
    />
  );
}
