import { Component, type ComponentType, type ReactNode, Suspense } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAfterFirstPaint } from '@/hooks/use-after-first-paint';
import { isChunkLoadError } from '@/lib/chunk-load-error';
import { reloadPage } from '@/lib/reload-page';
import { m } from '@/paraglide/messages';

export type MapPlaceholderProps = { children?: ReactNode };

type ChunkErrorBoundaryProps = {
  children: ReactNode;
  placeholder: ComponentType<MapPlaceholderProps>;
};

class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleRetry = () => {
    reloadPage();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (!isChunkLoadError(error)) throw error;
    const Placeholder = this.props.placeholder;
    return (
      <Placeholder>
        <Alert
          action={
            <Button size="sm" onClick={this.handleRetry}>
              {m.retry()}
            </Button>
          }
        >
          {m.map_load_error()}
        </Alert>
      </Placeholder>
    );
  }
}

export function LazyMapBoundary({ children, placeholder: Placeholder }: ChunkErrorBoundaryProps) {
  const painted = useAfterFirstPaint();

  if (!painted) return <Placeholder />;
  return (
    <ChunkErrorBoundary placeholder={Placeholder}>
      <Suspense fallback={<Placeholder />}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}
