import { Wordmark } from '@/components/brand/wordmark';
import { DEPTH_COLOR_STOPS, getDepthColor, getDepthRgb } from '@/lib/earthquakes/depth-color';
import { getTooltipDate } from '@/lib/earthquakes/tooltip';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from '@/lib/seo/open-graph';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { GROTESK_FONT } from './fonts';

const TOKENS = {
  background: '#171a33',
  foreground: '#e6e4f5',
  muted: '#a09dc1',
  line: 'rgba(185, 182, 224, 0.16)',
} as const;

const PAGE_BACKGROUND = [
  'radial-gradient(ellipse 60% 55% at 50% 48%, rgba(70, 80, 190, 0.32), rgba(70, 80, 190, 0) 100%)',
  'radial-gradient(ellipse 70% 60% at 15% 105%, rgba(150, 70, 95, 0.38), rgba(150, 70, 95, 0) 100%)',
  'linear-gradient(165deg, #15172e 0%, #1c1c38 50%, #2c2340 100%)',
].join(', ');

const SCALE = 2.2;
const DEPTH_MAX_KM = DEPTH_COLOR_STOPS[DEPTH_COLOR_STOPS.length - 1][0];
const DEPTH_DOT_SIZE = 26;
const DEPTH_BAR_HEIGHT = 4;

const LABEL_STYLE = {
  fontSize: 10 * SCALE,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: TOKENS.muted,
} as const;

const CAPTION_STYLE = {
  fontSize: 10 * SCALE,
  fontWeight: 500,
  lineHeight: 1.3,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: TOKENS.muted,
} as const;

function getMagnitudeNumeral(magnitude: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(magnitude);
}

function getDepthGradient(): string {
  const stops = DEPTH_COLOR_STOPS.map(
    ([km]) => `${getDepthColor(km)} ${(km / DEPTH_MAX_KM) * 100}%`,
  );
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function getDepthFraction(depthKm: number): number {
  return Math.min(Math.max(depthKm / DEPTH_MAX_KM, 0), 1);
}

function getDepthGlow(depthKm: number): string {
  const [r, g, b] = getDepthRgb(depthKm).map(Math.round);
  return `radial-gradient(circle 420px at 230px 330px, rgba(${r}, ${g}, ${b}, 0.3), rgba(${r}, ${g}, ${b}, 0) 100%)`;
}

function DepthScale({ depthKm, locale }: { depthKm: number; locale: Locale }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 16 }}>
      <div style={{ display: 'flex', position: 'relative', height: DEPTH_DOT_SIZE }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (DEPTH_DOT_SIZE - DEPTH_BAR_HEIGHT) / 2,
            height: DEPTH_BAR_HEIGHT,
            borderRadius: DEPTH_BAR_HEIGHT,
            backgroundImage: getDepthGradient(),
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${getDepthFraction(depthKm) * 100}%`,
            top: 0,
            width: DEPTH_DOT_SIZE,
            height: DEPTH_DOT_SIZE,
            marginLeft: -DEPTH_DOT_SIZE / 2,
            borderRadius: DEPTH_DOT_SIZE,
            backgroundColor: getDepthColor(depthKm),
            border: `4px solid ${TOKENS.background}`,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...CAPTION_STYLE }}>
        <div>{m.og_depth_surface({}, { locale })}</div>
        <div>{getKmLabel(DEPTH_MAX_KM, locale)}</div>
      </div>
    </div>
  );
}

export function EarthquakeShareCard({
  earthquake,
  locale,
}: {
  earthquake: Earthquake;
  locale: Locale;
}) {
  return (
    <div
      style={{
        width: SHARE_IMAGE_WIDTH,
        height: SHARE_IMAGE_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '64px 80px',
        backgroundColor: TOKENS.background,
        backgroundImage: `${getDepthGlow(earthquake.depthKm)}, ${PAGE_BACKGROUND}`,
        color: TOKENS.foreground,
        fontFamily: GROTESK_FONT,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', transform: 'scale(1.75)', transformOrigin: 'left center' }}>
          <Wordmark />
        </div>
        <div style={CAPTION_STYLE}>{earthquake.source}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={LABEL_STYLE}>{m.og_magnitude_label({}, { locale })}</div>
          <div
            style={{
              fontSize: 220,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: '-0.05em',
              marginLeft: -8,
            }}
          >
            {getMagnitudeNumeral(earthquake.magnitude, locale)}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            flexShrink: 1,
            gap: 20,
            paddingBottom: 30,
          }}
        >
          <div
            style={{
              display: 'block',
              fontSize: 48,
              fontWeight: 400,
              lineHeight: 1.2,
              lineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {earthquake.place ?? m.place_unknown({}, { locale })}
          </div>
          <div style={CAPTION_STYLE}>{getTooltipDate(earthquake.time, locale)}</div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          paddingTop: 32,
          borderTop: `1px solid ${TOKENS.line}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={LABEL_STYLE}>{m.col_depth({}, { locale })}</div>
          <div style={{ fontSize: 26 * SCALE, fontWeight: 300, lineHeight: 1.2 }}>
            {getKmLabel(earthquake.depthKm, locale)}
          </div>
        </div>
        <DepthScale depthKm={earthquake.depthKm} locale={locale} />
      </div>
    </div>
  );
}
