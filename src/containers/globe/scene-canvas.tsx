import { type ReconcilerRoot, type RenderProps, createRoot, extend } from '@react-three/fiber';
import {
  Component,
  type ReactNode,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { LineSegments, Mesh, Points } from 'three';

// `<Canvas>` registers the whole three.js namespace and defeats tree-shaking:
// https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/packages/fiber/src/web/Canvas.tsx#L65
extend({ LineSegments, Mesh, Points });

type Size = { width: number; height: number; top: number; left: number };

const CONFIG = {
  orthographic: true,
  flat: true,
  frameloop: 'demand',
  dpr: [1, 2],
  gl: { antialias: true },
  camera: { zoom: 1, position: [0, 0, 1000], near: 0.1, far: 5000 },
} satisfies RenderProps<HTMLCanvasElement>;

class SceneErrorBoundary extends Component<
  { onError: (error: unknown) => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function SceneCanvas({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [error, setError] = useState<unknown>();

  if (error !== undefined) throw error;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height, top: 0, left: 0 });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs every render so new children reach the root, as R3F's Canvas does; setError only fires from a rejected configure
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size || size.width === 0 || size.height === 0) return;
    rootRef.current ??= createRoot(canvas);
    const root = rootRef.current;
    root.configure({ ...CONFIG, size }).catch(setError);
    if (root.ready.status === 'fulfilled') {
      root.render(<SceneErrorBoundary onError={setError}>{children}</SceneErrorBoundary>);
    }
  });

  useInsertionEffect(
    () => () => {
      rootRef.current?.unmount();
      rootRef.current = null;
    },
    [],
  );

  return (
    <div ref={containerRef} className="relative size-full overflow-hidden">
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
