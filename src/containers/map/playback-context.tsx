import { createContext, use, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { getPlaybackClock } from '@/lib/map/playback-clock';
import type { PlaybackClock } from '@/lib/map/playback-clock';

const PlaybackClockContext = createContext<PlaybackClock | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [clock] = useState(getPlaybackClock);

  useEffect(() => () => clock.pause(), [clock]);

  return <PlaybackClockContext value={clock}>{children}</PlaybackClockContext>;
}

export function usePlaybackClock(): PlaybackClock {
  const clock = use(PlaybackClockContext);
  if (!clock) throw new Error('usePlaybackClock must be used inside PlaybackProvider');
  return clock;
}
