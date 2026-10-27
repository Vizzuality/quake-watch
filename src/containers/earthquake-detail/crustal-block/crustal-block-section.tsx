import { useQuery } from '@tanstack/react-query';
import {
  Component,
  lazy,
  Suspense,
  type ReactNode,
  useId,
  useState,
  useSyncExternalStore,
} from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SectionExplainer } from '@/components/ui/explainer';
import { Skeleton } from '@/components/ui/skeleton';
import { useAfterFirstPaint } from '@/hooks/use-after-first-paint';
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

function CrustalBlockBody(props: CrustalBlockProps) {
  const { status, refetch } = useQuery(getCrustalBlockQueryOptions(props));

  if (status === 'pending') {
    return (
      <div className="flex flex-col gap-3" data-testid="crustal-block-skeleton">
        <SceneSkeleton />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
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
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <CrustalBlockVisual {...props} />
        <CrustalBlockLegend {...props} />
      </div>
      <CrustLayerList {...props} />
    </div>
  );
}

export function CrustalBlockSection(props: CrustalBlockProps) {
  const headingId = useId();

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
      <CrustalBlockBody {...props} />
    </section>
  );
}
