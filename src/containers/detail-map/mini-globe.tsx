import { type RefObject, useEffect, useRef } from 'react';

import { usePhoneLayout } from '@/hooks/use-phone-layout';
import { getLandMask } from '@/lib/globe/land-mask';
import { GLOBE_DOT_COUNT } from '@/lib/globe/look';
import { MINI_GLOBE_LOOK, getMiniGlobeDots } from '@/lib/globe/map-locator';
import { getFibonacciPoints } from '@/lib/globe/sphere';
import { getPhoneDetailOverlayStyle } from '@/lib/layout/phone-detail';

const MINI_GLOBE_COLORS = {
  disc: 'rgba(24, 26, 54, 0.92)',
  land: '230, 228, 245',
  sea: '96, 104, 200',
  outline: 'rgba(185, 182, 224, 0.45)',
} as const;
const DOT_PX = 1.1;
const QUAKE_DOT_PX = 3;
const SIZE_PX = (MINI_GLOBE_LOOK.radiusPx + MINI_GLOBE_LOOK.marginPx) * 2;
const CENTRE_PX = SIZE_PX / 2;

let sphere: { points: Float32Array; landMask: Uint8Array } | null = null;

function getSphere() {
  sphere ??= { points: getFibonacciPoints(GLOBE_DOT_COUNT), landMask: getLandMask() };
  return sphere;
}

function getDotColor(isLand: boolean): string {
  return isLand ? MINI_GLOBE_COLORS.land : MINI_GLOBE_COLORS.sea;
}

function drawMiniGlobe(canvas: HTMLCanvasElement, latitude: number, longitude: number) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  const { radiusPx } = MINI_GLOBE_LOOK;
  canvas.width = SIZE_PX * ratio;
  canvas.height = SIZE_PX * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, SIZE_PX, SIZE_PX);
  context.fillStyle = MINI_GLOBE_COLORS.disc;
  context.beginPath();
  context.arc(CENTRE_PX, CENTRE_PX, radiusPx, 0, Math.PI * 2);
  context.fill();
  const { points, landMask } = getSphere();
  for (const { x, y, alpha, isLand } of getMiniGlobeDots(latitude, longitude, points, landMask)) {
    context.fillStyle = `rgba(${getDotColor(isLand)}, ${alpha.toFixed(3)})`;
    context.fillRect(
      CENTRE_PX + x * radiusPx - DOT_PX / 2,
      CENTRE_PX + y * radiusPx - DOT_PX / 2,
      DOT_PX,
      DOT_PX,
    );
  }
  context.strokeStyle = MINI_GLOBE_COLORS.outline;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(CENTRE_PX, CENTRE_PX, radiusPx, 0, Math.PI * 2);
  context.stroke();
}

type MiniGlobeProps = {
  latitude: number;
  longitude: number;
  rectRef: RefObject<SVGRectElement | null>;
};

export function MiniGlobe({ latitude, longitude, rectRef }: MiniGlobeProps) {
  const layout = usePhoneLayout();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) drawMiniGlobe(canvasRef.current, latitude, longitude);
  }, [latitude, longitude]);

  return (
    <div
      data-testid="mini-globe"
      className="pointer-events-none absolute top-(--mini-globe-top) right-(--mini-globe-right) scale-(--mini-globe-scale) md:top-auto md:right-[54px] md:bottom-[302px] md:scale-none"
      style={{ width: SIZE_PX, height: SIZE_PX, ...getPhoneDetailOverlayStyle(layout) }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <svg className="absolute inset-0 size-full overflow-visible">
        <g transform={`translate(${CENTRE_PX} ${CENTRE_PX})`}>
          <rect ref={rectRef} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={1} />
          <circle r={QUAKE_DOT_PX} className="fill-accent" />
        </g>
      </svg>
    </div>
  );
}
