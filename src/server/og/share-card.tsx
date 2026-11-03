import type { ReactNode } from 'react';

import { getMagnitudeClass } from '@/lib/earthquakes/magnitude';
import type { MagnitudeClass } from '@/lib/earthquakes/magnitude';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from '@/lib/seo/open-graph';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { MONO_FONT, SANS_FONT } from './fonts';
import { LAND_PATH } from './land-path';

const DARK = {
  canvas: '#0e1116',
  surface: '#161a21',
  fg: '#e8eaee',
  muted: '#8b93a1',
  line: '#2a313c',
  lineStrong: '#667080',
  accent: '#fe6ec7',
} as const;

const MAGNITUDE_FILLS: Record<MagnitudeClass, { fill: string; on: string }> = {
  1: { fill: '#fecee8', on: '#0e1116' },
  2: { fill: '#fea2d7', on: '#0e1116' },
  3: { fill: '#fe6ec7', on: '#0e1116' },
  4: { fill: '#e849b0', on: '#0e1116' },
  5: { fill: '#cc2997', on: '#ffffff' },
  6: { fill: '#ae017e', on: '#ffffff' },
};

const FILL_STYLE = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: 0 } as const;

const LOCATOR_FRAME_STYLE = {
  display: 'flex',
  flexShrink: 0,
  border: `2px solid ${DARK.line}`,
  borderRadius: 8,
  overflow: 'hidden',
} as const;

const TRACE_POINTS = '0,10 4,10 5.5,6 7,15 8.5,2 10,17 11.5,7 13,12 14.5,9 16,10 20,10';
const SOURCE_NAMES: Record<Earthquake['source'], string> = { usgs: 'USGS', emsc: 'EMSC' };

function getUtcDateTimeLabel(time: number, locale: Locale): string {
  const label = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(time);
  return `${label} UTC`;
}

function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.35 }}>
      <svg width={size} height={size} viewBox="0 0 20 20">
        <polyline
          points={TRACE_POINTS}
          fill="none"
          stroke={DARK.accent}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{ fontFamily: SANS_FONT, fontWeight: 600, fontSize: size * 0.85, color: DARK.fg }}
      >
        {m.app_title()}
      </div>
    </div>
  );
}

function Locator({
  width,
  epicenter,
}: {
  width: number;
  epicenter?: { x: number; y: number; color: string };
}) {
  return (
    <svg width={width} height={width / 2} viewBox="0 0 360 180">
      <rect width="360" height="180" fill={DARK.surface} />
      <path d={LAND_PATH} fill={DARK.line} />
      {epicenter ? (
        <g>
          <line
            x1="0"
            y1={epicenter.y}
            x2="360"
            y2={epicenter.y}
            stroke={DARK.lineStrong}
            strokeWidth="0.6"
          />
          <line
            x1={epicenter.x}
            y1="0"
            x2={epicenter.x}
            y2="180"
            stroke={DARK.lineStrong}
            strokeWidth="0.6"
          />
          <circle
            cx={epicenter.x}
            cy={epicenter.y}
            r="11"
            fill={epicenter.color}
            fillOpacity="0.28"
          />
          <circle
            cx={epicenter.x}
            cy={epicenter.y}
            r="5.5"
            fill={epicenter.color}
            stroke={DARK.canvas}
            strokeWidth="1.5"
          />
        </g>
      ) : null}
    </svg>
  );
}

function Frame({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div
      style={{
        width: SHARE_IMAGE_WIDTH,
        height: SHARE_IMAGE_HEIGHT,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 60,
        paddingRight: 72,
        paddingBottom: 52,
        paddingLeft: 72,
        backgroundColor: DARK.canvas,
        color: DARK.fg,
        fontFamily: SANS_FONT,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', ...FILL_STYLE }}>{children}</div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 28,
          borderTop: `2px solid ${DARK.line}`,
          fontFamily: MONO_FONT,
          fontSize: 24,
          color: DARK.muted,
        }}
      >
        {footer}
      </div>
    </div>
  );
}

export function EarthquakeShareCard({
  earthquake,
  locale,
  host,
}: {
  earthquake: Earthquake;
  locale: Locale;
  host: string;
}) {
  const magnitude = MAGNITUDE_FILLS[getMagnitudeClass(earthquake.magnitude)];
  const place = earthquake.place ?? m.place_unknown({}, { locale });

  return (
    <Frame
      footer={
        <>
          <div>{m.attribution_data({ source: SOURCE_NAMES[earthquake.source] }, { locale })}</div>
          <div>{host}</div>
        </>
      }
    >
      <Wordmark size={40} />
      <div style={{ display: 'flex', ...FILL_STYLE, alignItems: 'center', gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', ...FILL_STYLE }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div
              style={{
                display: 'flex',
                padding: '0 22px',
                borderRadius: 6,
                backgroundColor: magnitude.fill,
                color: magnitude.on,
                fontFamily: MONO_FONT,
                fontWeight: 600,
                fontSize: 92,
                lineHeight: 1.15,
              }}
            >
              {earthquake.magnitude.toFixed(1)}
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', fontSize: 26, color: DARK.muted }}
            >
              <div>{m.col_magnitude({}, { locale })}</div>
              {earthquake.magnitudeType ? (
                <div style={{ fontFamily: MONO_FONT }}>{earthquake.magnitudeType}</div>
              ) : null}
            </div>
          </div>
          <div
            style={{
              display: 'block',
              marginTop: 32,
              fontSize: 52,
              fontWeight: 600,
              lineHeight: 1.15,
              lineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {place}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              columnGap: 32,
              rowGap: 4,
              marginTop: 28,
              fontFamily: MONO_FONT,
              fontSize: 26,
              color: DARK.muted,
              whiteSpace: 'nowrap',
            }}
          >
            <div>{getUtcDateTimeLabel(earthquake.time, locale)}</div>
            <div>
              {`${m.col_depth({}, { locale })} ${getKmLabel(earthquake.depthKm, locale, 1)}`}
            </div>
          </div>
        </div>
        <div style={LOCATOR_FRAME_STYLE}>
          <Locator
            width={360}
            epicenter={{
              x: earthquake.longitude + 180,
              y: 90 - earthquake.latitude,
              color: magnitude.fill,
            }}
          />
        </div>
      </div>
    </Frame>
  );
}

export function SiteShareCard({ locale, host }: { locale: Locale; host: string }) {
  return (
    <Frame
      footer={
        <>
          <div>EMSC · USGS</div>
          <div>{host}</div>
        </>
      }
    >
      <div style={{ display: 'flex', ...FILL_STYLE, alignItems: 'center', gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', ...FILL_STYLE, gap: 36 }}>
          <Wordmark size={64} />
          <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.15 }}>
            {m.app_description({}, { locale })}
          </div>
        </div>
        <div style={LOCATOR_FRAME_STYLE}>
          <Locator width={460} />
        </div>
      </div>
    </Frame>
  );
}
