import type { ComponentType, LazyExoticComponent } from 'react';

import { LazyMapBoundary, type MapPlaceholderProps } from '@/components/map/lazy-map-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useLazyComponent } from '@/hooks/use-lazy-component';

type DetailMapProps = { earthquakeId: string };

function DetailMapPlaceholder({ children }: MapPlaceholderProps) {
  return (
    <div className="flex flex-col gap-2" data-testid="detail-map-placeholder">
      <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-md border border-line p-4 sm:h-80">
        {children ?? <Skeleton className="absolute inset-0 h-auto rounded-none" />}
      </div>
      <Skeleton className="h-10 w-36 rounded-md sm:h-8" />
    </div>
  );
}

export function LazyDetailMap({
  getComponent,
  earthquakeId,
}: DetailMapProps & {
  getComponent: () => LazyExoticComponent<ComponentType<DetailMapProps>>;
}) {
  const [DetailMap, reloadDetailMap] = useLazyComponent(getComponent);

  return (
    <LazyMapBoundary placeholder={DetailMapPlaceholder} onRetry={reloadDetailMap}>
      <DetailMap earthquakeId={earthquakeId} />
    </LazyMapBoundary>
  );
}
