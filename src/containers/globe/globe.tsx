import { Canvas } from '@react-three/fiber';
import { useRef, useState } from 'react';

import { m } from '@/paraglide/messages';

import { GlobeScene } from './globe-scene';
import { GlobeErrorBoundary, GlobeUnavailable } from './globe-unavailable';
import { useGlobeControls } from './use-globe-controls';

const CAMERA = { zoom: 1, position: [0, 0, 1000], near: 0.1, far: 5000 } as const;

function isWebGLAvailable(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}

function GlobeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useGlobeControls(containerRef);

  return (
    <div
      ref={containerRef}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an <img> element cannot host the WebGL canvas
      role="img"
      aria-label={m.globe_label()}
      className="absolute inset-0 cursor-grab touch-none select-none"
    >
      <Canvas orthographic flat dpr={[1, 2]} gl={{ antialias: true }} camera={CAMERA}>
        <GlobeScene controls={controls} />
      </Canvas>
    </div>
  );
}

export default function Globe() {
  const [isSupported] = useState(isWebGLAvailable);

  if (!isSupported) return <GlobeUnavailable />;
  return (
    <GlobeErrorBoundary>
      <GlobeCanvas />
    </GlobeErrorBoundary>
  );
}
