import type { ReactNode } from 'react';

import { getMagnitudeClass } from '@/lib/earthquakes/magnitude';
import type { MagnitudeClass } from '@/lib/earthquakes/magnitude';
import { getEarthquakeMeaning } from '@/lib/earthquakes/meaning';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel, getLatitudeLabel, getLongitudeLabel } from '@/lib/format';
import { getEarthquakeMeaningLabel } from '@/lib/i18n/meaning-labels';
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from '@/lib/seo/open-graph';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { MONO_FONT, SANS_FONT } from './fonts';
import { LAND_PATH } from './land-path';
import { QUAKE_HISTORY } from './quake-history';

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

const TRACE_POINTS = '0,10 4,10 5.5,6 7,15 8.5,2 10,17 11.5,7 13,12 14.5,9 16,10 20,10';
const LAND_OFFSETS = [-360, 0, 360] as const;

const DETAIL_MAP_DEGREES_WIDE = 300;
const EPICENTER_X = 420;
const EPICENTER_Y = 200;
const EPICENTER_RADIUS = 12;
const EPICENTER_HALO = 2.4;
const LABEL_GAP = 30;
const LABEL_MARGIN = 30;
const BADGE_SIZE = 80;
const PLACE_SIZE = 46;
const PLACE_LINE_HEIGHT = 1.08;
const FACTS_SIZE = 22;
const LABEL_STACK_GAP = 14;
const PLACE_ONE_LINE_CHARACTERS = 20;

const SITE_PANEL_WIDTH = 520;
const SITE_MAP_LEFT = 440;
const SITE_MAP_WIDTH = SHARE_IMAGE_WIDTH - SITE_MAP_LEFT;
const SITE_MAP_DEGREES_WIDE = 220;
const SITE_MAP_CENTER_LONGITUDE = 150;

type MapView = { x0: number; y0: number; degreesWide: number; degreesTall: number; scale: number };

function getMapView({
  width,
  height,
  degreesWide,
  left,
  top,
}: {
  width: number;
  height: number;
  degreesWide: number;
  left: number;
  top: number;
}): MapView {
  const scale = width / degreesWide;
  const degreesTall = height / scale;
  const y0 = Math.min(Math.max(top, -4), 180 - degreesTall + 4);
  return { x0: left, y0, degreesWide, degreesTall, scale };
}

function getMapX(longitude: number, view: MapView): number {
  const x = longitude + 180;
  return x < view.x0 ? x + 360 : x;
}

function getUtcDateTimeLabel(time: number, locale: Locale): string {
  const label = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(time);
  return `${label} UTC`;
}

function getLabelHeight(place: string): number {
  const placeLines = place.length > PLACE_ONE_LINE_CHARACTERS ? 2 : 1;
  const badge = BADGE_SIZE * 1.12;
  const facts = FACTS_SIZE * 1.25 * 2 + 6;
  return badge + placeLines * PLACE_SIZE * PLACE_LINE_HEIGHT + facts + LABEL_STACK_GAP * 2;
}

function getLabelTop(epicenterY: number, labelHeight: number): number {
  const below = epicenterY + LABEL_GAP;
  if (below + labelHeight <= SHARE_IMAGE_HEIGHT - LABEL_MARGIN) return below;
  const above = epicenterY - LABEL_GAP - labelHeight;
  if (above >= LABEL_MARGIN) return above;
  return SHARE_IMAGE_HEIGHT - LABEL_MARGIN - labelHeight;
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

function WorldMap({
  view,
  width,
  height,
  children,
}: {
  view: MapView;
  width: number;
  height: number;
  children?: ReactNode;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${view.x0} ${view.y0} ${view.degreesWide} ${view.degreesTall}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      <rect
        x={view.x0}
        y={view.y0}
        width={view.degreesWide}
        height={view.degreesTall}
        fill={DARK.surface}
      />
      {LAND_OFFSETS.map((offset) => (
        <path key={offset} d={LAND_PATH} fill={DARK.line} transform={`translate(${offset} 0)`} />
      ))}
      {children}
    </svg>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: SHARE_IMAGE_WIDTH,
        height: SHARE_IMAGE_HEIGHT,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: DARK.canvas,
        color: DARK.fg,
        fontFamily: SANS_FONT,
      }}
    >
      {children}
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
  const magnitude = MAGNITUDE_FILLS[getMagnitudeClass(earthquake.magnitude)];
  const place = earthquake.place ?? m.place_unknown({}, { locale });
  const feltReach = getEarthquakeMeaningLabel(
    getEarthquakeMeaning({ ...earthquake, distanceKm: null }),
    undefined,
    locale,
  );
  const scale = SHARE_IMAGE_WIDTH / DETAIL_MAP_DEGREES_WIDE;
  const view = getMapView({
    width: SHARE_IMAGE_WIDTH,
    height: SHARE_IMAGE_HEIGHT,
    degreesWide: DETAIL_MAP_DEGREES_WIDE,
    left: earthquake.longitude + 180 - EPICENTER_X / scale,
    top: 90 - earthquake.latitude - EPICENTER_Y / scale,
  });
  const x = (getMapX(earthquake.longitude, view) - view.x0) * view.scale;
  const y = (90 - earthquake.latitude - view.y0) * view.scale;
  const halo = EPICENTER_RADIUS * EPICENTER_HALO;

  return (
    <Frame>
      <WorldMap view={view} width={SHARE_IMAGE_WIDTH} height={SHARE_IMAGE_HEIGHT} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y - 1,
          width: SHARE_IMAGE_WIDTH,
          height: 2,
          backgroundColor: DARK.lineStrong,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 1,
          top: 0,
          width: 2,
          height: SHARE_IMAGE_HEIGHT,
          backgroundColor: DARK.lineStrong,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: y - 40,
          fontFamily: MONO_FONT,
          fontSize: 22,
          color: DARK.muted,
        }}
      >
        {getLatitudeLabel(earthquake.latitude, locale)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: x + 14,
          top: 20,
          fontFamily: MONO_FONT,
          fontSize: 22,
          color: DARK.muted,
        }}
      >
        {getLongitudeLabel(earthquake.longitude, locale)}
      </div>
      <svg
        width={halo * 2}
        height={halo * 2}
        viewBox={`${-EPICENTER_HALO} ${-EPICENTER_HALO} ${EPICENTER_HALO * 2} ${EPICENTER_HALO * 2}`}
        style={{ position: 'absolute', left: x - halo, top: y - halo }}
      >
        <circle r={EPICENTER_HALO} fill={magnitude.fill} fillOpacity="0.22" />
        <circle r="1.55" fill={magnitude.fill} fillOpacity="0.3" />
        <circle r="1" fill={magnitude.fill} stroke={DARK.canvas} strokeWidth="0.12" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: x + 40,
          top: getLabelTop(y, getLabelHeight(place)),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: LABEL_STACK_GAP,
          maxWidth: 680,
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '0 28px',
            borderRadius: 7,
            backgroundColor: magnitude.fill,
            color: magnitude.on,
            fontFamily: MONO_FONT,
            fontWeight: 600,
            fontSize: BADGE_SIZE,
            lineHeight: 1.12,
          }}
        >
          {earthquake.magnitude.toFixed(1)}
        </div>
        <div
          style={{
            display: 'block',
            fontSize: PLACE_SIZE,
            fontWeight: 600,
            lineHeight: PLACE_LINE_HEIGHT,
            lineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {place}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: FACTS_SIZE,
            lineHeight: 1.25,
            color: DARK.muted,
          }}
        >
          <div>
            {`${getUtcDateTimeLabel(earthquake.time, locale)} · ${m.col_depth({}, { locale })} ${getKmLabel(earthquake.depthKm, locale, 1)}`}
          </div>
          <div style={{ color: DARK.fg }}>{feltReach}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 56, top: 40, display: 'flex' }}>
        <Wordmark size={30} />
      </div>
    </Frame>
  );
}

const HISTORY_POINTS = QUAKE_HISTORY.split(',').map((point) => point.split(' ').map(Number));

function HistoryDots({ view }: { view: MapView }) {
  return (
    <>
      {HISTORY_POINTS.map(([longitude, latitude, magnitude], index) => (
        <circle
          key={index}
          cx={getMapX(longitude, view)}
          cy={90 - latitude}
          r={(1.6 + (magnitude - 6) * 2.6) / view.scale}
          fill={MAGNITUDE_FILLS[getMagnitudeClass(magnitude)].fill}
          fillOpacity="0.75"
        />
      ))}
    </>
  );
}

export function SiteShareCard({ locale }: { locale: Locale }) {
  const scale = SITE_MAP_WIDTH / SITE_MAP_DEGREES_WIDE;
  const view = getMapView({
    width: SITE_MAP_WIDTH,
    height: SHARE_IMAGE_HEIGHT,
    degreesWide: SITE_MAP_DEGREES_WIDE,
    left: SITE_MAP_CENTER_LONGITUDE + 180 - SITE_MAP_DEGREES_WIDE / 2,
    top: 90 - SHARE_IMAGE_HEIGHT / scale / 2,
  });

  return (
    <Frame>
      <div
        style={{
          position: 'absolute',
          left: SITE_MAP_LEFT,
          top: 0,
          width: SITE_MAP_WIDTH,
          height: SHARE_IMAGE_HEIGHT,
          display: 'flex',
        }}
      >
        <WorldMap view={view} width={SITE_MAP_WIDTH} height={SHARE_IMAGE_HEIGHT}>
          <HistoryDots view={view} />
        </WorldMap>
        <div
          style={{
            position: 'absolute',
            right: 28,
            bottom: 24,
            padding: '4px 10px',
            backgroundColor: DARK.surface,
            fontSize: 20,
            color: DARK.muted,
          }}
        >
          {m.og_site_history({}, { locale })}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SITE_PANEL_WIDTH,
          height: SHARE_IMAGE_HEIGHT,
          boxSizing: 'border-box',
          padding: '56px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: DARK.canvas,
        }}
      >
        <Wordmark size={34} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em' }}
          >
            {m.og_site_headline({}, { locale })}
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.35, color: DARK.muted }}>
            {m.og_site_summary({}, { locale })}
          </div>
        </div>
      </div>
    </Frame>
  );
}
