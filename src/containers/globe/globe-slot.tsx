import { ClientOnly } from '@tanstack/react-router';
import { type ReactNode, Suspense } from 'react';

import { GlobeErrorBoundary } from './globe-unavailable';

export function GlobeSlot({ children }: { children: ReactNode }) {
  return (
    <ClientOnly>
      <GlobeErrorBoundary>
        <Suspense fallback={null}>{children}</Suspense>
      </GlobeErrorBoundary>
    </ClientOnly>
  );
}
