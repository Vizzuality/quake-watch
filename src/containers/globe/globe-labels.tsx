import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import {
  type LabelBox,
  type LabelSize,
  LABEL_OBSTACLE_SELECTOR,
  getPlacedLabels,
} from '@/lib/globe/country-labels';
import { COUNTRY_LABELS } from '@/lib/globe/country-labels.data';
import { getGlobeFrame } from '@/lib/globe/frame';
import { getLocale } from '@/paraglide/runtime';

import type { GlobeControls } from './use-globe-controls';

type LabelLayer = {
  host: HTMLDivElement;
  spans: HTMLSpanElement[];
  sizes: LabelSize[];
  transforms: string[];
  opacities: string[];
  isShown: boolean[];
  placedFrames: Uint32Array;
  frame: number;
  isRevealed: boolean;
};

const HOST_CLASS_NAME = 'pointer-events-none absolute inset-0';
const LABEL_CLASS_NAME =
  'absolute top-0 left-0 whitespace-nowrap text-country text-muted uppercase';
const LABEL_FONT = '500 10px "Space Grotesk"';

function getLabelHost(): HTMLDivElement {
  const host = document.createElement('div');
  host.className = HOST_CLASS_NAME;
  host.setAttribute('aria-hidden', 'true');
  host.style.visibility = 'hidden';
  const locale = getLocale();
  for (const label of COUNTRY_LABELS) {
    const span = document.createElement('span');
    span.className = LABEL_CLASS_NAME;
    span.textContent = label.name[locale];
    host.append(span);
  }
  return host;
}

function getLabelSize(span: HTMLSpanElement): LabelSize {
  const trailingSpacing = Number.parseFloat(getComputedStyle(span).letterSpacing) || 0;
  return { width: span.offsetWidth - trailingSpacing, height: span.offsetHeight };
}

function getLabelLayer(host: HTMLDivElement): LabelLayer {
  const spans = [...host.children] as HTMLSpanElement[];
  return {
    host,
    spans,
    sizes: spans.map(getLabelSize),
    transforms: spans.map(() => ''),
    opacities: spans.map(() => ''),
    isShown: spans.map(() => true),
    placedFrames: new Uint32Array(spans.length),
    frame: 0,
    isRevealed: false,
  };
}

function getObstacleBoxes(host: HTMLElement): LabelBox[] {
  const origin = host.getBoundingClientRect();
  return [...document.querySelectorAll(LABEL_OBSTACLE_SELECTOR)]
    .filter((obstacle) => obstacle.checkVisibility({ visibilityProperty: true }))
    .map((obstacle) => obstacle.getBoundingClientRect())
    .filter(({ width, height }) => width > 0 && height > 0)
    .map(({ left, top, right, bottom }) => ({
      left: left - origin.left,
      top: top - origin.top,
      right: right - origin.left,
      bottom: bottom - origin.top,
    }));
}

function showLabel(layer: LabelLayer, index: number, x: number, y: number, opacity: number) {
  const { style } = layer.spans[index];
  const { width, height } = layer.sizes[index];
  const transform = `translate(${x - width / 2}px, ${y - height / 2}px)`;
  const alpha = String(opacity);
  layer.placedFrames[index] = layer.frame;
  if (!layer.isShown[index]) {
    style.display = '';
    layer.isShown[index] = true;
  }
  if (layer.transforms[index] !== transform) {
    style.transform = transform;
    layer.transforms[index] = transform;
  }
  if (layer.opacities[index] !== alpha) {
    style.opacity = alpha;
    layer.opacities[index] = alpha;
  }
}

function hideLabel(layer: LabelLayer, index: number) {
  if (!layer.isShown[index]) return;
  layer.spans[index].style.display = 'none';
  layer.isShown[index] = false;
}

export default function GlobeLabels({ controls }: { controls: GlobeControls }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const layerRef = useRef<LabelLayer | null>(null);

  useFrame((state) => {
    const layer = layerRef.current;
    if (!layer) return;
    const frame = getGlobeFrame(state.size.width, state.size.height);
    const placed = getPlacedLabels(
      COUNTRY_LABELS,
      layer.sizes,
      controls.viewRef.current,
      frame,
      getObstacleBoxes(layer.host),
    );
    layer.frame += 1;
    for (const { index, x, y, opacity } of placed) showLabel(layer, index, x, y, opacity);
    for (let index = 0; index < layer.spans.length; index++) {
      if (layer.placedFrames[index] !== layer.frame) hideLabel(layer, index);
    }
    if (layer.isRevealed) return;
    layer.host.style.visibility = 'visible';
    layer.isRevealed = true;
  });

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const host = getLabelHost();
    let isMounted = true;
    parent.append(host);
    void document.fonts
      .load(LABEL_FONT)
      .catch(() => [])
      .then(() => {
        if (!isMounted) return;
        layerRef.current = getLabelLayer(host);
        invalidate();
      });
    return () => {
      isMounted = false;
      layerRef.current = null;
      host.remove();
    };
  }, [gl, invalidate]);

  return null;
}
