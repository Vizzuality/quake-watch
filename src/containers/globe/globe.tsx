import { Canvas } from '@react-three/fiber';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { m } from '@/paraglide/messages';

import { GlobeScene } from './globe-scene';
import { GlobeErrorBoundary, GlobeUnavailable } from './globe-unavailable';
import { type GlobeWaves, createGlobeWaves } from './globe-waves';
import { useGlobeControls } from './use-globe-controls';

declare global {
  interface Window {
    __playGlobeWaves?: GlobeWaves['play'];
  }
}

const CAMERA = { zoom: 1, position: [0, 0, 1000], near: 0.1, far: 5000 } as const;
const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const homeRoute = getRouteApi('/');

function isWebGLAvailable(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}

function GlobeCanvas() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useGlobeControls(containerRef);
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const [waves] = useState(createGlobeWaves);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__playGlobeWaves = waves.play;
    return () => {
      delete window.__playGlobeWaves;
    };
  }, [waves]);

  return (
    <div
      ref={containerRef}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an <img> element cannot host the WebGL canvas
      role="img"
      aria-label={m.globe_label()}
      className="absolute inset-0 cursor-grab touch-none select-none"
    >
      <Canvas orthographic flat dpr={[1, 2]} gl={{ antialias: true }} camera={CAMERA}>
        <GlobeScene controls={controls} earthquakes={earthquakes} waves={waves} />
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
