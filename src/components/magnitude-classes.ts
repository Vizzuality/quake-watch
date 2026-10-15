import type { MagnitudeClass } from '@/lib/earthquakes/magnitude';

export const MAGNITUDE_FILL_CLASS_NAMES: Record<MagnitudeClass, string> = {
  1: 'bg-mag-1',
  2: 'bg-mag-2',
  3: 'bg-mag-3',
  4: 'bg-mag-4',
  5: 'bg-mag-5',
  6: 'bg-mag-6',
};

export const MAGNITUDE_BADGE_CLASS_NAMES: Record<MagnitudeClass, string> = {
  1: 'bg-mag-1 text-on-mag-1',
  2: 'bg-mag-2 text-on-mag-2',
  3: 'bg-mag-3 text-on-mag-3',
  4: 'bg-mag-4 text-on-mag-4',
  5: 'bg-mag-5 text-on-mag-5',
  6: 'bg-mag-6 text-on-mag-6',
};
