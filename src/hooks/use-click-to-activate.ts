import { type RefObject, useEffect, useState } from 'react';

export function useClickToActivate(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);

  function activate() {
    setActive(true);
  }

  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;
    const controller = new AbortController();
    const { signal } = controller;
    const deactivate = () => setActive(false);
    element.addEventListener(
      'pointerleave',
      (event) => {
        if (event.pointerType === 'mouse') deactivate();
      },
      { signal },
    );
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!element.contains(event.target as Node)) deactivate();
      },
      { signal },
    );
    window.addEventListener('blur', deactivate, { signal });
    return () => controller.abort();
  }, [ref, active]);

  return { active, activate };
}
