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

type ViewportVisibilityOptions = { rootMargin?: string };

// The implicit root is the top-level viewport, so inside a frame the frame's own clip ignores the
// margin (https://w3c.github.io/IntersectionObserver/#dom-intersectionobserver-rootmargin).
function getObserverInit(rootMargin: string | undefined): IntersectionObserverInit | undefined {
  return rootMargin === undefined ? undefined : { root: document, rootMargin };
}

export function useViewportVisibility(
  ref: RefObject<Element | null>,
  { rootMargin }: ViewportVisibilityOptions = {},
) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      const isIntersecting = entries.at(-1)?.isIntersecting ?? false;
      setIsVisible(isIntersecting);
      if (isIntersecting) setHasBeenVisible(true);
    }, getObserverInit(rootMargin));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return { isVisible, hasBeenVisible };
}
