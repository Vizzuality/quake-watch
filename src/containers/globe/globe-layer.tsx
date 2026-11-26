import { type ReactNode, useSyncExternalStore } from 'react';

import {
  getIsMapCovered,
  getIsMapCoveredOnServer,
  subscribeSheetCover,
} from '@/lib/layout/sheet-cover-store';

import { GlobeSlot } from './globe-slot';

export function GlobeLayer({ children }: { children: ReactNode }) {
  const isCovered = useSyncExternalStore(
    subscribeSheetCover,
    getIsMapCovered,
    getIsMapCoveredOnServer,
  );

  return (
    <div className="absolute inset-0" inert={isCovered}>
      <GlobeSlot>{children}</GlobeSlot>
    </div>
  );
}
