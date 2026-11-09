import { Component, type ReactNode } from 'react';

import { m } from '@/paraglide/messages';

export function GlobeUnavailable() {
  return (
    <div className="grid h-full place-items-center">
      <output className="text-body text-muted">{m.globe_unavailable()}</output>
    </div>
  );
}

export class GlobeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return <GlobeUnavailable />;
    return this.props.children;
  }
}
