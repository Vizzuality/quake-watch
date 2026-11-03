import { useQuery } from '@tanstack/react-query';
import {
  Component,
  lazy,
  Suspense,
  type ReactNode,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SectionExplainer } from '@/components/ui/explainer';
import { Skeleton } from '@/components/ui/skeleton';
import { useAfterFirstPaint } from '@/hooks/use-after-first-paint';
import { useViewportVisibility } from '@/hooks/use-visibility';
import { reloadPage } from '@/lib/reload-page';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

import { CrustLayerList } from './crust-layer-list';
import { CrustalBlockLegend } from './crustal-block-legend';
import { CRUSTAL_BLOCK_HEIGHT } from './layout';
import { type CrustalBlockProps, getCrustalBlockQueryOptions } from './use-crustal-block';
import { isWebGL2Available } from './webgl-support';

const CHUNK_LOAD_ERROR =
  /dynamically imported module|module script failed|Loading chunk|Unable to preload/i;

function getSceneComponent() {
  return lazy(() => import('./crustal-block-scene'));
}

function subscribeToNothing() {
  return () => undefined;
}

function isWebGL2AvailableOnServer() {
  return false;
}

function isChunkLoadError(error: Error): boolean {
  return CHUNK_LOAD_ERROR.test(error.message);
}

type SceneErrorBoundaryProps = { children: ReactNode };

class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleRetry = () => {
    reloadPage();
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (!isChunkLoadError(this.state.error)) return <NoWebGLNote />;
    return (
      <Alert
        action={
          <Button size="sm" onClick={this.handleRetry}>
            {m.retry()}
          </Button>
        }
      >
        {m.crustal_block_retry_3d()}
      </Alert>
    );
  }
}

function NoWebGLNote() {
  return (
    <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted">
      {m.crustal_block_no_webgl()}
    </p>
  );
}

function SceneSkeleton() {
  return <Skeleton className={cn('w-full rounded-lg', CRUSTAL_BLOCK_HEIGHT)} />;
}

function CrustalBlockVisual(props: CrustalBlockProps) {
  const hasWebGL2 = useSyncExternalStore(
    subscribeToNothing,
    isWebGL2Available,
    isWebGL2AvailableOnServer,
  );
  const painted = useAfterFirstPaint();
  const [CrustalBlockScene] = useState(getSceneComponent);

  if (!hasWebGL2) return <NoWebGLNote />;
  if (!painted) return <SceneSkeleton />;
  return (
    <SceneErrorBoundary>
      <Suspense fallback={<SceneSkeleton />}>
        <CrustalBlockScene {...props} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

const CRUSTAL_BLOCK_ROOT_MARGIN = '400px 0px';

const SKELETON_LEGEND_KINDS = 6;
const SKELETON_LAYER_ROWS = 8;

type CrustalBlockLayoutProps = { visual: ReactNode; legend: ReactNode; list: ReactNode };

function CrustalBlockLayout({ visual, legend, list }: CrustalBlockLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        {visual}
        {legend}
      </div>
      {list}
    </div>
  );
}

function LegendSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="w-12" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 lg:grid-cols-1">
          {Array.from({ length: SKELETON_LEGEND_KINDS }, (_, index) => (
            <Skeleton key={index} className="w-28" />
          ))}
        </div>
      </div>
      <Skeleton className="w-56 max-w-full" />
      <div className="flex flex-col gap-1">
        <Skeleton className="w-14" />
        <Skeleton className="w-full" />
        <div className="flex flex-col gap-1 py-0.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function LayerListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-48" />
      <div className="flex flex-col divide-y divide-line">
        {Array.from({ length: SKELETON_LAYER_ROWS }, (_, index) => (
          <div key={index} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
            <Skeleton className="h-5 w-32 sm:w-48 sm:shrink-0" />
            <div className="flex h-8 items-center sm:flex-1">
              <Skeleton className="w-36" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrustalBlockSkeleton() {
  return (
    <div data-testid="crustal-block-skeleton">
      <CrustalBlockLayout
        visual={<SceneSkeleton />}
        legend={<LegendSkeleton />}
        list={<LayerListSkeleton />}
      />
    </div>
  );
}

function CrustalBlockBody(props: CrustalBlockProps) {
  const { status, refetch } = useQuery(getCrustalBlockQueryOptions(props));

  if (status === 'pending') return <CrustalBlockSkeleton />;
  if (status === 'error') {
    return (
      <Alert
        action={
          <Button size="sm" onClick={() => refetch()}>
            {m.retry()}
          </Button>
        }
      >
        {m.crustal_block_error()}
      </Alert>
    );
  }
  return (
    <CrustalBlockLayout
      visual={<CrustalBlockVisual {...props} />}
      legend={<CrustalBlockLegend {...props} />}
      list={<CrustLayerList {...props} />}
    />
  );
}

export function CrustalBlockSection(props: CrustalBlockProps) {
  const headingId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const { hasBeenVisible } = useViewportVisibility(bodyRef, {
    rootMargin: CRUSTAL_BLOCK_ROOT_MARGIN,
  });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-lg font-semibold text-fg">
          {m.crustal_block_title()}
        </h2>
        <SectionExplainer>
          <p>{m.crustal_block_explainer_what()}</p>
          <p>{m.crustal_block_explainer_crust()}</p>
          <p>{m.crustal_block_explainer_depth()}</p>
          <p>{m.crustal_block_explainer_relief()}</p>
        </SectionExplainer>
      </div>
      <div ref={bodyRef}>
        {hasBeenVisible ? <CrustalBlockBody {...props} /> : <CrustalBlockSkeleton />}
      </div>
    </section>
  );
}
