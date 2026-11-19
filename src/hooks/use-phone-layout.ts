import { useSyncExternalStore } from 'react';

import { type PhoneLayout, getPhoneLayout } from '@/lib/layout/phone';

let cached: { width: number; height: number; layout: PhoneLayout } | null = null;

function subscribe(listener: () => void): () => void {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

function getSnapshot(): PhoneLayout {
  const { innerWidth: width, innerHeight: height } = window;
  if (cached?.width !== width || cached.height !== height) {
    cached = { width, height, layout: getPhoneLayout(width, height) };
  }
  return cached.layout;
}

function getServerSnapshot(): null {
  return null;
}

export function usePhoneLayout(): PhoneLayout | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
