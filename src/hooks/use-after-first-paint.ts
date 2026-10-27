import { useEffect, useState } from 'react';

import { runAfterFirstPaint } from '@/lib/after-first-paint';

export function useAfterFirstPaint(): boolean {
  const [painted, setPainted] = useState(false);

  useEffect(() => runAfterFirstPaint(() => setPainted(true)), []);

  return painted;
}
