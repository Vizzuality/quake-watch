import { type ComponentType, type LazyExoticComponent, useState } from 'react';

export function useLazyComponent<P extends object>(
  getComponent: () => LazyExoticComponent<ComponentType<P>>,
) {
  const [LazyComponent, setLazyComponent] = useState(getComponent);

  function reload() {
    setLazyComponent(getComponent);
  }

  return [LazyComponent, reload] as const;
}
