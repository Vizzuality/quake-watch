import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react';

function subscribeToPageVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function getIsPageVisible(): boolean {
  return document.visibilityState === 'visible';
}

function getIsPageVisibleOnServer(): boolean {
  return true;
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeToPageVisibility,
    getIsPageVisible,
    getIsPageVisibleOnServer,
  );
}

export function useViewportVisibility(ref: RefObject<Element | null>) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      const isIntersecting = entries.at(-1)?.isIntersecting ?? false;
      setIsVisible(isIntersecting);
      if (isIntersecting) setHasBeenVisible(true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return { isVisible, hasBeenVisible };
}
