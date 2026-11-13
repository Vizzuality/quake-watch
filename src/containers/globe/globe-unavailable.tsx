import { Component, type ReactNode } from 'react';

import { m } from '@/paraglide/messages';

export function GlobeUnavailable() {
  return (
    <div className="grid h-full place-items-center">
      <output className="text-body text-muted">{m.globe_unavailable()}</output>
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
    if (this.state.hasError) return fallback === undefined ? <GlobeUnavailable /> : fallback;
    return this.props.children;
  }
}
