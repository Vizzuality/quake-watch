import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { PLAYBACK_WINDOWS, earthquakeSearchSchema } from '@/lib/earthquakes/search-schema';
import type { PlaybackWindow } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

const WINDOW_LABELS: Record<PlaybackWindow, () => string> = {
  '24h': m.timeline_window_24h,
  '7d': m.timeline_window_7d,
};

export function WindowSelect({
  value,
  onValueChange,
}: {
  value: PlaybackWindow;
  onValueChange: (value: PlaybackWindow) => void;
}) {
  return (
    <>
      <Select
        aria-label={m.timeline_window_label()}
        value={value}
        onChange={(event) =>
          onValueChange(earthquakeSearchSchema.shape.window.parse(event.target.value))
        }
        className="w-auto sm:hidden"
      >
        {PLAYBACK_WINDOWS.map((window) => (
          <option key={window} value={window}>
            {WINDOW_LABELS[window]()}
          </option>
        ))}
      </Select>
      <div className="hidden items-center gap-2 sm:flex">
        <span aria-hidden="true">{m.timeline_window_visible()}</span>
        <SegmentedControl
          label={m.timeline_window_label()}
          value={value}
          options={PLAYBACK_WINDOWS.map((window) => ({
            value: window,
            label: WINDOW_LABELS[window](),
          }))}
          onValueChange={onValueChange}
        />
      </div>
    </>
  );
}
