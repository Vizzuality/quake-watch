import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Blending } from 'three';

import { getBorderSegments } from '@/lib/globe/borders';
import { getGlobeFrame } from '@/lib/globe/frame';
import { getLandMask } from '@/lib/globe/land-mask';
import { GLOBE_BACKGROUND, GLOBE_DOT_COUNT, GLOBE_GLOW, GLOBE_LOOK } from '@/lib/globe/look';
import type { GlobeView } from '@/lib/globe/motion';
import { getFibonacciPoints } from '@/lib/globe/sphere';

import {
  BORDER_FRAGMENT_SHADER,
  BORDER_VERTEX_SHADER,
  DISC_VERTEX_SHADER,
  DOT_FRAGMENT_SHADER,
  DOT_VERTEX_SHADER,
  GLOW_FRAGMENT_SHADER,
  VEIL_FRAGMENT_SHADER,
} from './shaders';
import type { GlobeControls } from './use-globe-controls';

type GlobeAssets = ReturnType<typeof getGlobeAssets>;

const VEIL_EXTENT = 1.01;

const RENDER_ORDER = { glow: 0, backDots: 1, veil: 2, frontDots: 3, borders: 4 } as const;

type ViewUniforms = {
  uLon: { value: number };
  uLat: { value: number };
  uRadius: { value: number };
  uCenter: { value: Vector2 };
  uDpr: { value: number };
};

function getRgb(rgb: readonly [number, number, number]): Vector3 {
  return new Vector3(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
}

function getHexRgb(hex: string): Vector3 {
  const value = Number.parseInt(hex.slice(1), 16);
  return getRgb([(value >> 16) & 255, (value >> 8) & 255, value & 255]);
}

function getMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, { value: unknown }>,
  blending: Blending,
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    blending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

function getDotGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(getFibonacciPoints(GLOBE_DOT_COUNT), 3));
  geometry.setAttribute('aLand', new BufferAttribute(Float32Array.from(getLandMask()), 1));
  return geometry;
}

function getBorderGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(getBorderSegments(), 3));
  return geometry;
}

function getDotMaterial(view: ViewUniforms, isFront: boolean): ShaderMaterial {
  return getMaterial(
    DOT_VERTEX_SHADER,
    DOT_FRAGMENT_SHADER,
    {
      ...view,
      uFront: { value: Number(isFront) },
      uOcean: { value: getRgb(GLOBE_LOOK.ocean) },
      uLand: { value: getRgb(GLOBE_LOOK.land) },
      uOceanAlpha: { value: GLOBE_LOOK.oceanA },
      uLandAlpha: { value: GLOBE_LOOK.landA },
      uLandScale: { value: GLOBE_LOOK.landS },
      uDotSize: { value: GLOBE_LOOK.dot },
      uRim: { value: GLOBE_LOOK.rim },
    },
    AdditiveBlending,
  );
}

function getGlobeAssets() {
  const view: ViewUniforms = {
    uLon: { value: 0 },
    uLat: { value: 0 },
    uRadius: { value: 1 },
    uCenter: { value: new Vector2() },
    uDpr: { value: 1 },
  };
  const borderAlpha: { value: number } = { value: GLOBE_LOOK.outA };
  return {
    view,
    borderAlpha,
    dotGeometry: getDotGeometry(),
    borderGeometry: getBorderGeometry(),
    discGeometry: new PlaneGeometry(2, 2),
    glowMaterial: getMaterial(
      DISC_VERTEX_SHADER,
      GLOW_FRAGMENT_SHADER,
      {
        ...view,
        uExtent: { value: GLOBE_GLOW.to },
        uFrom: { value: GLOBE_GLOW.from },
        uTo: { value: GLOBE_GLOW.to },
        uColor: { value: getRgb(GLOBE_GLOW.rgb) },
        uAlpha: { value: GLOBE_GLOW.alpha },
      },
      NormalBlending,
    ),
    backDotMaterial: getDotMaterial(view, false),
    veilMaterial: getMaterial(
      DISC_VERTEX_SHADER,
      VEIL_FRAGMENT_SHADER,
      {
        ...view,
        uExtent: { value: VEIL_EXTENT },
        uColor: { value: getHexRgb(GLOBE_BACKGROUND) },
        uAlpha: { value: GLOBE_LOOK.veil },
      },
      NormalBlending,
    ),
    frontDotMaterial: getDotMaterial(view, true),
    borderMaterial: getMaterial(
      BORDER_VERTEX_SHADER,
      BORDER_FRAGMENT_SHADER,
      { ...view, uAlpha: borderAlpha },
      NormalBlending,
    ),
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
  assets.borderAlpha.value = GLOBE_LOOK.outA * Math.min(1, GLOBE_LOOK.outW * dpr);
}

export function GlobeScene({ controls }: { controls: GlobeControls }) {
  const assets = useMemo(() => getGlobeAssets(), []);

  useFrame((state, delta) => {
    const view = controls.advance(delta, state.clock.elapsedTime * 1000);
    setFrameUniforms(assets, view, state.size, state.viewport.dpr);
  });

  useEffect(
    () => () => {
      for (const asset of Object.values(assets)) {
        if ('dispose' in asset) asset.dispose();
      }
    },
    [assets],
  );

  return (
    <>
      <color attach="background" args={[GLOBE_BACKGROUND]} />
      <mesh
        geometry={assets.discGeometry}
        material={assets.glowMaterial}
        renderOrder={RENDER_ORDER.glow}
        frustumCulled={false}
      />
      <points
        geometry={assets.dotGeometry}
        material={assets.backDotMaterial}
        renderOrder={RENDER_ORDER.backDots}
        frustumCulled={false}
      />
      <mesh
        geometry={assets.discGeometry}
        material={assets.veilMaterial}
        renderOrder={RENDER_ORDER.veil}
        frustumCulled={false}
      />
      <points
        geometry={assets.dotGeometry}
        material={assets.frontDotMaterial}
        renderOrder={RENDER_ORDER.frontDots}
        frustumCulled={false}
      />
      <lineSegments
        geometry={assets.borderGeometry}
        material={assets.borderMaterial}
        renderOrder={RENDER_ORDER.borders}
        frustumCulled={false}
      />
    </>
  );
}
