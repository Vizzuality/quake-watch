import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
} from 'three';

import type { Earthquake } from '@/lib/earthquakes/types';
import { getFeltRingAttributes, getWavesEndTime } from '@/lib/globe/felt-rings';
import { getGlobeFrame } from '@/lib/globe/frame';
import { getLandMask } from '@/lib/globe/land-mask';
import { GLOBE_DOT_COUNT, GLOBE_LOOK } from '@/lib/globe/look';
import type { GlobeView } from '@/lib/globe/motion';
import { type QuakeVertexAttributes, getQuakeMarkerAttributes } from '@/lib/globe/quakes';
import { getFibonacciPoints } from '@/lib/globe/sphere';

import { type GlobeWaves, getWaveStartValues, getWaveStarts } from './globe-waves';
import {
  DOT_FRAGMENT_SHADER,
  DOT_VERTEX_SHADER,
  NEEDLE_FRAGMENT_SHADER,
  NEEDLE_VERTEX_SHADER,
  QUAKE_FRAGMENT_SHADER,
  QUAKE_VERTEX_SHADER,
  RING_FRAGMENT_SHADER,
  RING_VERTEX_SHADER,
} from './shaders';
import type { GlobeControls } from './use-globe-controls';

type GlobeAssets = ReturnType<typeof getGlobeAssets>;
type ViewUniforms = {
  uLon: { value: number };
  uLat: { value: number };
  uRadius: { value: number };
  uCenter: { value: Vector2 };
  uDpr: { value: number };
};

const FRAME_SECONDS = 1 / 60;
const RING_QUAD_CORNERS = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];
const RING_QUAD_INDEX = [0, 1, 2, 0, 2, 3];

const ADDITIVE_BLENDING = {
  blending: CustomBlending,
  blendSrc: SrcAlphaFactor,
  blendDst: OneFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
  transparent: true,
  depthTest: false,
  depthWrite: false,
} as const;

function getRgb(rgb: readonly [number, number, number]): Vector3 {
  return new Vector3(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
}

function getDotGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(getFibonacciPoints(GLOBE_DOT_COUNT), 3));
  geometry.setAttribute('aLand', new BufferAttribute(Float32Array.from(getLandMask()), 1));
  return geometry;
}

function getDotMaterial(view: ViewUniforms): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: DOT_VERTEX_SHADER,
    fragmentShader: DOT_FRAGMENT_SHADER,
    uniforms: {
      ...view,
      uOcean: { value: getRgb(GLOBE_LOOK.ocean) },
      uLand: { value: getRgb(GLOBE_LOOK.land) },
      uOceanAlpha: { value: GLOBE_LOOK.oceanA },
      uLandAlpha: { value: GLOBE_LOOK.landA },
      uLandScale: { value: GLOBE_LOOK.landS },
      uDotSize: { value: GLOBE_LOOK.dot },
      uRim: { value: GLOBE_LOOK.rim },
    },
    ...ADDITIVE_BLENDING,
  });
}

function getQuakeGeometry({
  direction,
  radius,
  color,
  alpha,
}: QuakeVertexAttributes): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(direction, 3));
  geometry.setAttribute('aRadius', new BufferAttribute(radius, 1));
  geometry.setAttribute('aColor', new BufferAttribute(color, 3));
  geometry.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
  return geometry;
}

function getRingGeometry(earthquakes: readonly Earthquake[], waveStart: InstancedBufferAttribute) {
  const { direction, reachAngle, minPx, color, depthKm, life, glowPx } =
    getFeltRingAttributes(earthquakes);
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(RING_QUAD_CORNERS), 3));
  geometry.setIndex(RING_QUAD_INDEX);
  geometry.setAttribute('aDirection', new InstancedBufferAttribute(direction, 3));
  geometry.setAttribute('aReachAngle', new InstancedBufferAttribute(reachAngle, 1));
  geometry.setAttribute('aMinPx', new InstancedBufferAttribute(minPx, 1));
  geometry.setAttribute('aColor', new InstancedBufferAttribute(color, 3));
  geometry.setAttribute('aDepthKm', new InstancedBufferAttribute(depthKm, 1));
  geometry.setAttribute('aLife', new InstancedBufferAttribute(life, 1));
  geometry.setAttribute('aGlowPx', new InstancedBufferAttribute(glowPx, 1));
  geometry.setAttribute('aWaveStart', waveStart);
  return geometry;
}

function getQuakeGeometries(earthquakes: readonly Earthquake[]) {
  const { markers, needles } = getQuakeMarkerAttributes(earthquakes);
  const markerGeometry = getQuakeGeometry(markers);
  markerGeometry.setAttribute('aSize', new BufferAttribute(markers.size, 1));
  const waveStart = new InstancedBufferAttribute(getWaveStartValues(earthquakes, new Map()), 1);
  waveStart.setUsage(DynamicDrawUsage);
  return {
    markerGeometry,
    needleGeometry: getQuakeGeometry(needles),
    ringGeometry: getRingGeometry(earthquakes, waveStart),
    waveStart,
  };
}

function getGlobeAssets() {
  const view: ViewUniforms = {
    uLon: { value: 0 },
    uLat: { value: 0 },
    uRadius: { value: 1 },
    uCenter: { value: new Vector2() },
    uDpr: { value: 1 },
  };
  const time = { value: 0 };
  return {
    view,
    time,
    dotGeometry: getDotGeometry(),
    dotMaterial: getDotMaterial(view),
    markerMaterial: new ShaderMaterial({
      vertexShader: QUAKE_VERTEX_SHADER,
      fragmentShader: QUAKE_FRAGMENT_SHADER,
      uniforms: { ...view },
      ...ADDITIVE_BLENDING,
    }),
    ringMaterial: new ShaderMaterial({
      vertexShader: RING_VERTEX_SHADER,
      fragmentShader: RING_FRAGMENT_SHADER,
      uniforms: { ...view, uTime: time },
      ...ADDITIVE_BLENDING,
    }),
    needleMaterial: new ShaderMaterial({
      vertexShader: NEEDLE_VERTEX_SHADER,
      fragmentShader: NEEDLE_FRAGMENT_SHADER,
      uniforms: { ...view },
      ...ADDITIVE_BLENDING,
    }),
  };
}

function setFrameUniforms(
  assets: GlobeAssets,
  { lon, lat, zoom }: GlobeView,
  { width, height }: { width: number; height: number },
  dpr: number,
  time: number,
) {
  const frame = getGlobeFrame(width, height);
  const { view } = assets;
  assets.time.value = time;
  view.uLon.value = lon;
  view.uLat.value = lat;
  view.uRadius.value = frame.radius * zoom;
  view.uCenter.value.set(frame.cx - width / 2, height / 2 - frame.cy);
  view.uDpr.value = dpr;
}

function setWaveStarts(attribute: InstancedBufferAttribute, values: Float32Array) {
  attribute.set(values);
  attribute.needsUpdate = true;
}

export function GlobeScene({
  controls,
  earthquakes,
  waves,
}: {
  controls: GlobeControls;
  earthquakes: readonly Earthquake[];
  waves: GlobeWaves;
}) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const assets = useMemo(() => getGlobeAssets(), []);
  const quakes = useMemo(() => getQuakeGeometries(earthquakes), [earthquakes]);
  const waveStartsRef = useRef<ReadonlyMap<string, number>>(new Map());
  const wavesEndRef = useRef(-Infinity);
  const stampedRef = useRef<InstancedBufferAttribute | null>(null);
  const isContinuingRef = useRef(false);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const dt = isContinuingRef.current ? delta : Math.min(delta, FRAME_SECONDS);
    const view = controls.advance(dt, time * 1000);
    setFrameUniforms(assets, view, state.size, state.viewport.dpr, time);
    const requests = waves.takeRequests();
    if (requests.length > 0 || stampedRef.current !== quakes.waveStart) {
      waveStartsRef.current = getWaveStarts(waveStartsRef.current, requests, earthquakes, time);
      setWaveStarts(quakes.waveStart, getWaveStartValues(earthquakes, waveStartsRef.current));
      wavesEndRef.current = getWavesEndTime(earthquakes, waveStartsRef.current);
      stampedRef.current = quakes.waveStart;
    }
    isContinuingRef.current = controls.isAnimating() || time <= wavesEndRef.current + FRAME_SECONDS;
    if (isContinuingRef.current) state.invalidate();
  });

  useEffect(
    () => () => {
      for (const asset of Object.values(assets)) {
        if ('dispose' in asset) asset.dispose();
      }
    },
    [assets],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    function handleContextRestored() {
      invalidate();
    }
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    return () => canvas.removeEventListener('webglcontextrestored', handleContextRestored);
  }, [gl, invalidate]);

  useEffect(
    () => () => {
      quakes.markerGeometry.dispose();
      quakes.needleGeometry.dispose();
      quakes.ringGeometry.dispose();
    },
    [quakes],
  );

  return (
    <>
      <points geometry={assets.dotGeometry} material={assets.dotMaterial} frustumCulled={false} />
      {earthquakes.length > 0 && (
        <>
          <mesh
            geometry={quakes.ringGeometry}
            material={assets.ringMaterial}
            renderOrder={1}
            frustumCulled={false}
          />
          <lineSegments
            geometry={quakes.needleGeometry}
            material={assets.needleMaterial}
            renderOrder={2}
            frustumCulled={false}
          />
          <points
            geometry={quakes.markerGeometry}
            material={assets.markerMaterial}
            renderOrder={3}
            frustumCulled={false}
          />
        </>
      )}
    </>
  );
}
