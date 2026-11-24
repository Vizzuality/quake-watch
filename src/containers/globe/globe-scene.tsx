import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
  Vector4,
} from 'three';

import {
  ARRIVAL_PULSE,
  getPulseGlowAlpha,
  getPulseRingAlpha,
  getPulseRingRadiusPx,
} from '@/lib/earthquakes/arrivals';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import {
  type TimeRange,
  getPlaybackSpeed,
  getShownCount,
  getSortedByTime,
} from '@/lib/earthquakes/timeline';
import type { Earthquake } from '@/lib/earthquakes/types';
import {
  type FeltRingAttributes,
  type GlobeWave,
  MAX_GLOBE_WAVES,
  type WallWave,
  getFeltRingAttributes,
  getGlobeWaves,
  getPrunedWaveStarts,
  getQuakeStates,
  getReplaySeconds,
  getWaveQuakes,
  getWavesEndTime,
} from '@/lib/globe/felt-rings';
import { getGlobeFrame } from '@/lib/globe/frame';
import { GLOBE_DOT_COUNT, GLOBE_LOOK, getCoastAlpha } from '@/lib/globe/look';
import type { GlobeView } from '@/lib/globe/motion';
import {
  type QuakeVertexAttributes,
  getEmberMs,
  getQuakeMarkerAttributes,
} from '@/lib/globe/quakes';
import {
  getCoastSegments,
  getFibonacciPoints,
  getLatLonVector,
  getRetried,
} from '@/lib/globe/sphere';

import { type GlobeWaves, getWaveStartValues, getWaveStarts } from './globe-waves';
import {
  COAST_FRAGMENT_SHADER,
  COAST_VERTEX_SHADER,
  DISC_FRAGMENT_SHADER,
  DISC_VERTEX_SHADER,
  DOT_FRAGMENT_SHADER,
  DOT_VERTEX_SHADER,
  NEEDLE_FRAGMENT_SHADER,
  NEEDLE_VERTEX_SHADER,
  PULSE_FRAGMENT_SHADER,
  PULSE_VERTEX_SHADER,
  QUAKE_FRAGMENT_SHADER,
  QUAKE_VERTEX_SHADER,
  RING_FRAGMENT_SHADER,
  RING_VERTEX_SHADER,
} from './shaders';
import type { GlobeControls } from './use-globe-controls';

type Uniforms = Record<string, { value: unknown }>;
type GlobeAssets = ReturnType<typeof getGlobeAssets>;
type QuakeGeometries = ReturnType<typeof getQuakeGeometries>;
type Pulse = { id: string; start: number };
type PendingPulse = { id: string; framesLeft: number };
type Surface = { dots: BufferGeometry; coast: BufferGeometry | null };

const FRAME_SECONDS = 1 / 60;
const HOUR_MS = 3_600_000;
const NONE = -1;
const PULSE_WAIT_FRAMES = 30;
const NO_WALL_WAVES: readonly WallWave[] = [];
const QUAD_CORNERS = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];

const BLENDINGS = {
  additive: {
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
  },
  normal: { blending: NormalBlending },
} as const;

function getRgb(rgb: readonly number[]): Vector3 {
  return new Vector3(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
}

function getMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Uniforms,
  blending: keyof typeof BLENDINGS,
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    ...BLENDINGS[blending],
  });
}

function getFaceMaterials(vertexShader: string, fragmentShader: string, uniforms: Uniforms) {
  return [0, 1].map((front) =>
    getMaterial(
      vertexShader,
      fragmentShader,
      { ...uniforms, uFront: { value: front } },
      'additive',
    ),
  );
}

function getQuadGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(QUAD_CORNERS), 3));
  geometry.setIndex(QUAD_INDEX);
  return geometry;
}

function getDotGeometry(landMask: Uint8Array): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(getFibonacciPoints(GLOBE_DOT_COUNT), 3));
  geometry.setAttribute('aLand', new BufferAttribute(Float32Array.from(landMask), 1));
  return geometry;
}

function getLoadedOr<T>(load: () => Promise<T>, fallback: T, part: string): Promise<T> {
  return getRetried(load).catch((error: unknown) => {
    console.error(`Globe ${part} failed to load`, error);
    return fallback;
  });
}

async function getSurface(): Promise<Surface> {
  const [landMask, coast] = await Promise.all([
    getLoadedOr(
      () => import('@/lib/globe/land-mask').then(({ getLandMask }) => getLandMask()),
      new Uint8Array(GLOBE_DOT_COUNT),
      'land mask',
    ),
    getLoadedOr<BufferGeometry | null>(
      () =>
        import('@/lib/globe/coastlines-110m.json').then(({ default: d }) => getCoastGeometry(d)),
      null,
      'coastlines',
    ),
  ]);
  return { dots: getDotGeometry(landMask), coast };
}

function getDiscUniforms(
  view: Uniforms,
  rgb: readonly number[],
  alpha: number,
  inner: number,
  outer: number,
) {
  return {
    ...view,
    uColor: { value: getRgb(rgb) },
    uAlpha: { value: alpha },
    uInner: { value: inner },
    uOuter: { value: outer },
  };
}

function getGlobeAssets() {
  const view = {
    uLon: { value: 0 },
    uLat: { value: 0 },
    uRadius: { value: 1 },
    uCenter: { value: new Vector2() },
    uDpr: { value: 1 },
  };
  const clock = {
    uDataT: { value: 0 },
    uHasData: { value: 0 },
    uEmber: { value: 1 },
    uLifeK: { value: 0 },
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uSelected: { value: NONE },
    uHovered: { value: NONE },
  };
  const waves = {
    uWaveCount: { value: 0 },
    uWaveCentre: { value: Array.from({ length: MAX_GLOBE_WAVES }, () => new Vector4()) },
    uWaveShape: { value: Array.from({ length: MAX_GLOBE_WAVES }, () => new Vector4()) },
    uWaveColor: { value: Array.from({ length: MAX_GLOBE_WAVES }, () => new Vector3()) },
  };
  const pulse = {
    uPulseDirection: { value: new Vector3() },
    uRingPx: { value: new Vector3() },
    uRingAlpha: { value: new Vector3() },
    uGlowAlpha: { value: 0 },
  };
  const coast = { uAlpha: { value: 0 } };
  const quakeUniforms = { ...view, ...clock };
  const { halo, haloA, haloFrom, haloTo, veil, veilA } = GLOBE_LOOK;
  return {
    view,
    clock,
    waves,
    pulse,
    coast,
    quad: getQuadGeometry(),
    dotMaterials: getFaceMaterials(DOT_VERTEX_SHADER, DOT_FRAGMENT_SHADER, {
      ...view,
      ...waves,
      uOcean: { value: getRgb(GLOBE_LOOK.ocean) },
      uLand: { value: getRgb(GLOBE_LOOK.land) },
      uOceanAlpha: { value: GLOBE_LOOK.oceanA },
      uLandAlpha: { value: GLOBE_LOOK.landA },
      uLandScale: { value: GLOBE_LOOK.landS },
      uDotSize: { value: GLOBE_LOOK.dot },
      uRim: { value: GLOBE_LOOK.rim },
    }),
    haloMaterial: getMaterial(
      DISC_VERTEX_SHADER,
      DISC_FRAGMENT_SHADER,
      getDiscUniforms(view, halo, haloA, haloFrom, haloTo),
      'normal',
    ),
    veilMaterial: getMaterial(
      DISC_VERTEX_SHADER,
      DISC_FRAGMENT_SHADER,
      getDiscUniforms(view, veil, veilA, 1, 1),
      'normal',
    ),
    coastMaterial: getMaterial(
      COAST_VERTEX_SHADER,
      COAST_FRAGMENT_SHADER,
      { ...view, ...coast },
      'normal',
    ),
    markerMaterials: getFaceMaterials(QUAKE_VERTEX_SHADER, QUAKE_FRAGMENT_SHADER, quakeUniforms),
    needleMaterials: getFaceMaterials(NEEDLE_VERTEX_SHADER, NEEDLE_FRAGMENT_SHADER, quakeUniforms),
    ringMaterials: getFaceMaterials(RING_VERTEX_SHADER, RING_FRAGMENT_SHADER, quakeUniforms),
    pulseMaterial: getMaterial(
      PULSE_VERTEX_SHADER,
      PULSE_FRAGMENT_SHADER,
      { ...view, ...pulse },
      'normal',
    ),
  };
}

function getQuakeGeometry(
  { direction, radius, color, alpha }: QuakeVertexAttributes,
  state: BufferAttribute,
  replay: BufferAttribute,
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(direction, 3));
  geometry.setAttribute('aRadius', new BufferAttribute(radius, 1));
  geometry.setAttribute('aColor', new BufferAttribute(color, 3));
  geometry.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
  geometry.setAttribute('aState', state);
  geometry.setAttribute('aReplay', replay);
  return geometry;
}

function getRingGeometry(rings: FeltRingAttributes, replay: InstancedBufferAttribute) {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(QUAD_CORNERS), 3));
  geometry.setIndex(QUAD_INDEX);
  geometry.setAttribute('aDirection', new InstancedBufferAttribute(rings.direction, 3));
  geometry.setAttribute('aRadius', new InstancedBufferAttribute(rings.radius, 1));
  geometry.setAttribute('aColor', new InstancedBufferAttribute(rings.color, 3));
  geometry.setAttribute('aShape', new InstancedBufferAttribute(rings.shape, 3));
  geometry.setAttribute('aState', new InstancedBufferAttribute(rings.state, 3));
  geometry.setAttribute('aReplay', replay);
  return geometry;
}

function getDynamic<T extends BufferAttribute>(attribute: T): T {
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

function getQuakeGeometries(earthquakes: readonly Earthquake[], selected: Earthquake | undefined) {
  const originMs = earthquakes[0]?.time ?? 0;
  const { markers, needles } = getQuakeMarkerAttributes(earthquakes);
  const state = new BufferAttribute(getQuakeStates(earthquakes, originMs, 2), 3);
  const replay = getDynamic(new BufferAttribute(getWaveStartValues(earthquakes, new Map(), 2), 1));
  const ringReplay = getDynamic(
    new InstancedBufferAttribute(getWaveStartValues(earthquakes, new Map()), 1),
  );
  const markerGeometry = getQuakeGeometry(markers, state, replay);
  markerGeometry.setAttribute('aSize', new BufferAttribute(markers.size, 1));
  const rings = getFeltRingAttributes(earthquakes, selected, originMs);
  return {
    originMs,
    rings,
    replay,
    ringReplay,
    markerGeometry,
    needleGeometry: getQuakeGeometry(needles, state, replay),
    ringGeometry: getRingGeometry(rings, ringReplay),
  };
}

function setFrameUniforms(
  assets: GlobeAssets,
  { lon, lat, zoom }: GlobeView,
  { width, height }: { width: number; height: number },
  dpr: number,
) {
  const frame = getGlobeFrame(width, height);
  const { view } = assets;
  view.uLon.value = lon;
  view.uLat.value = lat;
  view.uRadius.value = frame.radius * zoom;
  view.uCenter.value.set(frame.cx - width / 2, height / 2 - frame.cy);
  view.uDpr.value = dpr;
  assets.coast.uAlpha.value = getCoastAlpha(dpr);
}

function getDataTime(playhead: number | null, range: TimeRange | null): number | null {
  return playhead ?? range?.end ?? null;
}

function setClockUniforms(
  { clock }: GlobeAssets,
  {
    originMs,
    dataTime,
    range,
    time,
    motion,
    selectedIndex,
    hoveredIndex,
  }: {
    originMs: number;
    dataTime: number | null;
    range: TimeRange | null;
    time: number;
    motion: boolean;
    selectedIndex: number;
    hoveredIndex: number;
  },
) {
  clock.uTime.value = time;
  clock.uSelected.value = selectedIndex;
  clock.uHovered.value = hoveredIndex;
  clock.uMotion.value = Number(motion);
  clock.uHasData.value = Number(dataTime !== null && range !== null);
  if (dataTime === null || range === null) return;
  clock.uDataT.value = (dataTime - originMs) / HOUR_MS;
  clock.uEmber.value = getEmberMs(range.end - range.start) / HOUR_MS;
  clock.uLifeK.value = (getPlaybackSpeed(range) * 1000) / HOUR_MS;
}

function setWaveUniforms(
  { waves }: GlobeAssets,
  active: readonly GlobeWave[],
  rings: FeltRingAttributes,
) {
  waves.uWaveCount.value = active.length;
  active.forEach(({ index, front, reach, lambda, envelope, minCos }, slot) => {
    const at = index * 3;
    waves.uWaveCentre.value[slot].set(
      rings.direction[at],
      rings.direction[at + 1],
      rings.direction[at + 2],
      front,
    );
    waves.uWaveShape.value[slot].set(reach, lambda, envelope, minCos);
    waves.uWaveColor.value[slot].set(rings.color[at], rings.color[at + 1], rings.color[at + 2]);
  });
}

function setPulseUniforms(
  { pulse }: GlobeAssets,
  earthquake: Earthquake | undefined,
  elapsedMs: number,
) {
  const shownMs = earthquake ? elapsedMs : Number.NaN;
  pulse.uGlowAlpha.value = getPulseGlowAlpha(shownMs);
  for (let ring = 0; ring < ARRIVAL_PULSE.ringCount; ring++) {
    pulse.uRingPx.value.setComponent(ring, getPulseRingRadiusPx(shownMs, ring));
    pulse.uRingAlpha.value.setComponent(ring, getPulseRingAlpha(shownMs, ring));
  }
  if (earthquake)
    pulse.uPulseDirection.value.set(...getLatLonVector(earthquake.latitude, earthquake.longitude));
}

function setShownCount(quakes: QuakeGeometries, count: number) {
  quakes.markerGeometry.setDrawRange(0, count * 2);
  quakes.needleGeometry.setDrawRange(0, count * 2);
  quakes.ringGeometry.instanceCount = count;
}

function setWaveStarts(attribute: BufferAttribute, values: Float32Array) {
  attribute.set(values);
  attribute.needsUpdate = true;
}

function getWallWaves(
  starts: ReadonlyMap<string, number>,
  pulse: Pulse | null,
  sorted: readonly Earthquake[],
  indexById: ReadonlyMap<string, number>,
  time: number,
): readonly WallWave[] {
  const pulseIndex = pulse ? indexById.get(pulse.id) : undefined;
  if (starts.size === 0 && pulseIndex === undefined) return NO_WALL_WAVES;
  const wallWaves: WallWave[] = [];
  for (const [id, start] of starts) {
    const index = indexById.get(id);
    if (index === undefined) continue;
    wallWaves.push({
      index,
      progress: (time - start) / getReplaySeconds(sorted[index].magnitude),
      k: 1,
    });
  }
  if (pulse && pulseIndex !== undefined) {
    const progress = ((time - pulse.start) * 1000) / ARRIVAL_PULSE.waveMs;
    wallWaves.push({ index: pulseIndex, progress, k: ARRIVAL_PULSE.waveK });
  }
  return wallWaves;
}

function getPendingPulse(
  pending: PendingPulse | null,
  indexById: ReadonlyMap<string, number>,
): PendingPulse | null {
  if (!pending || indexById.has(pending.id)) return pending;
  if (pending.framesLeft <= 0) return null;
  return { id: pending.id, framesLeft: pending.framesLeft - 1 };
}

function getRunningPulse(
  pulse: Pulse | null,
  indexById: ReadonlyMap<string, number>,
  time: number,
): Pulse | null {
  if (!pulse || !indexById.has(pulse.id)) return null;
  return (time - pulse.start) * 1000 < ARRIVAL_PULSE.durationMs ? pulse : null;
}

function getCoastGeometry(lines: readonly (readonly number[])[]): BufferGeometry {
  const { position, other } = getCoastSegments(lines);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aOther', new BufferAttribute(other, 3));
  return geometry;
}

function getIndex(
  indexById: ReadonlyMap<string, number>,
  earthquake: Earthquake | undefined,
): number {
  return (earthquake && indexById.get(earthquake.id)) ?? NONE;
}

export function GlobeScene({
  controls,
  earthquakes,
  selectedEarthquake,
  hoveredEarthquake,
  waves,
  isHidden = false,
}: {
  controls: GlobeControls;
  earthquakes: readonly Earthquake[];
  selectedEarthquake: Earthquake | undefined;
  hoveredEarthquake?: Earthquake;
  waves: GlobeWaves;
  isHidden?: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const assets = useMemo(() => getGlobeAssets(), []);
  const sorted = useMemo(() => getSortedByTime(earthquakes), [earthquakes]);
  const times = useMemo(() => Float64Array.from(sorted, ({ time }) => time), [sorted]);
  const indexById = useMemo(() => new Map(sorted.map(({ id }, index) => [id, index])), [sorted]);
  const waveQuakes = useMemo(() => getWaveQuakes(sorted), [sorted]);
  const quakes = useMemo(
    () => getQuakeGeometries(sorted, selectedEarthquake),
    [sorted, selectedEarthquake],
  );
  const selectedIndex = getIndex(indexById, selectedEarthquake);
  const hoveredIndex = getIndex(indexById, hoveredEarthquake);
  const [surface, setSurface] = useState<Surface | null>(null);
  const waveStartsRef = useRef<ReadonlyMap<string, number>>(new Map());
  const wavesEndRef = useRef(-Infinity);
  const pulseRef = useRef<Pulse | null>(null);
  const pendingPulseRef = useRef<PendingPulse | null>(null);
  const stampedRef = useRef<BufferAttribute | null>(null);
  const isContinuingRef = useRef(false);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const dt = isContinuingRef.current ? delta : Math.min(delta, FRAME_SECONDS);
    const view = controls.advance(dt);
    setFrameUniforms(assets, view, state.size, state.viewport.dpr);
    const playhead = playbackClock.getPlayhead();
    const { range } = playbackClock.getSnapshot();
    const shownCount = getShownCount(times, playhead);
    setShownCount(quakes, shownCount);
    const requests = waves.takeRequests();
    if (requests.length > 0 || stampedRef.current !== quakes.replay) {
      const starts = getWaveStarts(waveStartsRef.current, requests, sorted, time);
      waveStartsRef.current = getPrunedWaveStarts(sorted, starts, time);
      setWaveStarts(quakes.replay, getWaveStartValues(sorted, waveStartsRef.current, 2));
      setWaveStarts(quakes.ringReplay, getWaveStartValues(sorted, waveStartsRef.current));
      wavesEndRef.current = getWavesEndTime(sorted, waveStartsRef.current);
      stampedRef.current = quakes.replay;
    }
    const requestedPulse = waves.takePulse();
    if (requestedPulse !== undefined) {
      pendingPulseRef.current = { id: requestedPulse, framesLeft: PULSE_WAIT_FRAMES };
    }
    pendingPulseRef.current = getPendingPulse(pendingPulseRef.current, indexById);
    const pending = pendingPulseRef.current;
    if (pending && indexById.has(pending.id)) {
      pulseRef.current = { id: pending.id, start: time };
      pendingPulseRef.current = null;
    }
    pulseRef.current = getRunningPulse(pulseRef.current, indexById, time);
    const pulseIndex = pulseRef.current ? indexById.get(pulseRef.current.id) : undefined;
    const pulseMs = pulseRef.current ? (time - pulseRef.current.start) * 1000 : Number.NaN;
    const motion = !controls.isReducedMotion();
    const dataTime = getDataTime(playhead, range);
    setClockUniforms(assets, {
      originMs: quakes.originMs,
      dataTime,
      range,
      time,
      motion,
      selectedIndex,
      hoveredIndex,
    });
    const wallWaves = getWallWaves(
      waveStartsRef.current,
      pulseRef.current,
      sorted,
      indexById,
      time,
    );
    const active = getGlobeWaves({
      quakes: waveQuakes,
      shownCount,
      dataTime: motion && range ? dataTime : null,
      lifeMsPerSecond: range ? getPlaybackSpeed(range) * 1000 : 0,
      wallWaves: motion ? wallWaves : NO_WALL_WAVES,
    });
    setWaveUniforms(assets, active, quakes.rings);
    setPulseUniforms(assets, pulseIndex === undefined ? undefined : sorted[pulseIndex], pulseMs);
    const isPulsing = pulseRef.current !== null || pendingPulseRef.current !== null;
    const isWaving = time <= wavesEndRef.current + FRAME_SECONDS || isPulsing;
    isContinuingRef.current = !isHidden && (controls.isAnimating() || isWaving);
    if (isContinuingRef.current) state.invalidate();
  });

  useEffect(
    () => () => {
      for (const asset of Object.values(assets)) {
        if ('dispose' in asset) asset.dispose();
      }
      for (const material of [
        ...assets.dotMaterials,
        ...assets.markerMaterials,
        ...assets.needleMaterials,
        ...assets.ringMaterials,
      ]) {
        material.dispose();
      }
    },
    [assets],
  );

  useEffect(() => {
    if (isHidden) return;
    invalidate();
    return playbackClock.subscribeFrame(invalidate);
  }, [invalidate, isHidden]);

  useEffect(() => {
    invalidate();
  }, [invalidate, selectedIndex, hoveredIndex]);

  useEffect(() => {
    let isMounted = true;
    let loaded: Surface | null = null;
    getSurface()
      .then((next) => {
        loaded = next;
        if (!isMounted) {
          next.dots.dispose();
          next.coast?.dispose();
          return;
        }
        setSurface(next);
        invalidate();
      })
      .catch(() => {});
    return () => {
      isMounted = false;
      loaded?.dots.dispose();
      loaded?.coast?.dispose();
    };
  }, [invalidate]);

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

  const hasQuakes = earthquakes.length > 0;
  const [backDots, frontDots] = assets.dotMaterials;
  return (
    <>
      <mesh
        geometry={assets.quad}
        material={assets.haloMaterial}
        renderOrder={0}
        frustumCulled={false}
      />
      {surface && (
        <points geometry={surface.dots} material={backDots} renderOrder={1} frustumCulled={false} />
      )}
      {hasQuakes && <QuakeLayers quakes={quakes} assets={assets} face={0} renderOrder={2} />}
      <mesh
        geometry={assets.quad}
        material={assets.veilMaterial}
        renderOrder={5}
        frustumCulled={false}
      />
      {surface && (
        <points
          geometry={surface.dots}
          material={frontDots}
          renderOrder={6}
          frustumCulled={false}
        />
      )}
      {surface?.coast && (
        <lineSegments
          geometry={surface.coast}
          material={assets.coastMaterial}
          renderOrder={7}
          frustumCulled={false}
        />
      )}
      {hasQuakes && <QuakeLayers quakes={quakes} assets={assets} face={1} renderOrder={8} />}
      <mesh
        geometry={assets.quad}
        material={assets.pulseMaterial}
        renderOrder={11}
        frustumCulled={false}
      />
    </>
  );
}

function QuakeLayers({
  quakes,
  assets,
  face,
  renderOrder,
}: {
  quakes: QuakeGeometries;
  assets: GlobeAssets;
  face: 0 | 1;
  renderOrder: number;
}) {
  return (
    <>
      <mesh
        geometry={quakes.ringGeometry}
        material={assets.ringMaterials[face]}
        renderOrder={renderOrder}
        frustumCulled={false}
      />
      <lineSegments
        geometry={quakes.needleGeometry}
        material={assets.needleMaterials[face]}
        renderOrder={renderOrder + 1}
        frustumCulled={false}
      />
      <points
        geometry={quakes.markerGeometry}
        material={assets.markerMaterials[face]}
        renderOrder={renderOrder + 2}
        frustumCulled={false}
      />
    </>
  );
}
