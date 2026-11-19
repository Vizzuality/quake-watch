import { Component, type ReactNode } from 'react';

import { m } from '@/paraglide/messages';

export function GlobeUnavailable() {
  return (
    <div className="grid h-full place-items-center">
      <output className="text-body text-muted">{m.globe_unavailable()}</output>
    </div>
  );
}

export function GlobeFailed() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-4">
        <p role="alert" className="text-body text-muted">
          {m.globe_failed()}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="pointer-events-auto rounded-full border border-muted px-4 py-2.5 text-label text-foreground uppercase"
        >
          {m.globe_reload()}
        </button>
      </div>
    </div>
  );
}

type GlobeErrorBoundaryProps = { children: ReactNode; fallback?: ReactNode };

export class GlobeErrorBoundary extends Component<GlobeErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    const { fallback } = this.props;
    if (this.state.hasError) return fallback === undefined ? <GlobeFailed /> : fallback;
    return this.props.children;
  }
}
