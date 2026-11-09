import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
} from 'three';

import { getGlobeFrame } from '@/lib/globe/frame';
import { getLandMask } from '@/lib/globe/land-mask';
import { GLOBE_DOT_COUNT, GLOBE_LOOK } from '@/lib/globe/look';
import type { GlobeView } from '@/lib/globe/motion';
import { getFibonacciPoints } from '@/lib/globe/sphere';

import { DOT_FRAGMENT_SHADER, DOT_VERTEX_SHADER } from './shaders';
import type { GlobeControls } from './use-globe-controls';

type GlobeAssets = ReturnType<typeof getGlobeAssets>;
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
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

function getGlobeAssets() {
  const view: ViewUniforms = {
    uLon: { value: 0 },
    uLat: { value: 0 },
    uRadius: { value: 1 },
    uCenter: { value: new Vector2() },
    uDpr: { value: 1 },
  };
  return {
    view,
    dotGeometry: getDotGeometry(),
    dotMaterial: getDotMaterial(view),
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
    <points geometry={assets.dotGeometry} material={assets.dotMaterial} frustumCulled={false} />
  );
}
