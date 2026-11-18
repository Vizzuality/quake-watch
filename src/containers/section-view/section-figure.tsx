import { type Ref, useId } from 'react';

import { getDepthColor } from '@/lib/earthquakes/depth-color';
import type { Earthquake } from '@/lib/earthquakes/types';
import { SECTION_FRAME } from '@/lib/section/depth-scale';
import {
  SECTION_LAYER_ORDER,
  getDepthTickLabel,
  getLayerName,
  getSectionFootnote,
  getSectionHypocentreLabel,
  getUpperLabel,
} from '@/lib/section/section-labels';
import type { Face, LayerId, SectionModel, SlabLabel, SlabLine } from '@/lib/section/section-model';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

export const SECTION_VIEW_BOX = { x: 480, y: 200, width: 960, height: 530 } as const;
export const PULSE_RINGS = [
  { radius: 22, opacity: 0.55 },
  { radius: 38, opacity: 0.32 },
  { radius: 56, opacity: 0.16 },
] as const;

const FACE_FILL = '#1b1c3b';
const SHADE_FILL = 'rgb(23 26 51 / 0.6)';
const LABEL_CLASS_NAME = 'text-[9.5px] font-medium tracking-[1.6px]';
const SMALL_LABEL_CLASS_NAME = 'text-[9px] font-medium tracking-[1.5px]';
const LEGEND = { x: 1186, titleY: 547, firstRowY: 552, rowGap: 17, labelX: 1212 } as const;
const AXIS = { tickX1: 577, tickX2: 583, labelX: 571 } as const;
const FOOTNOTE_Y = 702.5;
const BOUNDARY_OPACITY: Record<LayerId, number> = {
  water: 0,
  sediments: 0.9,
  upper: 0.45,
  middle: 0.45,
  lower: 0.45,
  mantle: 0.7,
};

function getInk(alpha: number): string {
  return `rgb(230 228 245 / ${alpha})`;
}

function getId(prefix: string, name: string): string {
  return `${prefix}-${name}`;
}

function getUrl(prefix: string, name: string): string {
  return `url(#${getId(prefix, name)})`;
}

function PatternDefs({ prefix }: { prefix: string }) {
  const id = (name: string) => getId(prefix, name);
  return (
    <defs>
      <pattern id={id('water')} width="6" height="4" patternUnits="userSpaceOnUse">
        <path d="M0 2 H6" stroke={getInk(0.35)} strokeWidth="0.7" />
      </pattern>
      <pattern id={id('sediments')} width="8" height="3" patternUnits="userSpaceOnUse">
        <path d="M0 1.5 H4" stroke={getInk(0.7)} strokeWidth="0.7" />
      </pattern>
      <pattern id={id('upper')} width="3" height="3" patternUnits="userSpaceOnUse">
        <rect x="1" y="1" width="1.1" height="1.1" fill={getInk(0.65)} />
      </pattern>
      <pattern id={id('middle')} width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M-1 6 L6 -1" stroke={getInk(0.45)} strokeWidth="0.7" />
      </pattern>
      <pattern id={id('lower')} width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M-1 -1 L6 6" stroke={getInk(0.35)} strokeWidth="0.7" />
      </pattern>
      <pattern id={id('mantle')} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect x="2.5" y="2.5" width="1" height="1" fill={getInk(0.38)} />
      </pattern>
      <radialGradient
        id={id('fade-gradient')}
        gradientUnits="userSpaceOnUse"
        cx="955"
        cy="440"
        r="470"
        gradientTransform="translate(955 440) scale(1.2 0.8) translate(-955 -440)"
      >
        <stop offset="0.45" stopColor="#fff" />
        <stop offset="0.8" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient
        id={id('down-gradient')}
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="420"
        x2="0"
        y2="700"
      >
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id={id('fade')} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900">
        <rect width="1440" height="900" fill={getUrl(prefix, 'fade-gradient')} />
      </mask>
      <mask id={id('down')} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900">
        <rect width="1440" height="900" fill={getUrl(prefix, 'down-gradient')} />
      </mask>
    </defs>
  );
}

function CutFace({ face, prefix, name }: { face: Face; prefix: string; name: string }) {
  return (
    <>
      <clipPath id={getId(prefix, name)}>
        <polygon points={face.clip} />
      </clipPath>
      <polygon points={face.clip} fill={FACE_FILL} mask={getUrl(prefix, 'down')} />
      <g mask={getUrl(prefix, 'down')}>
        <g clipPath={getUrl(prefix, name)}>
          {face.bands.map((band) => (
            <g key={band.id}>
              <polygon points={band.polygon} fill={getUrl(prefix, band.id)} />
              {BOUNDARY_OPACITY[band.id] > 0 && (
                <polyline
                  points={band.top}
                  fill="none"
                  stroke={getInk(BOUNDARY_OPACITY[band.id])}
                  strokeWidth="0.8"
                />
              )}
            </g>
          ))}
          {face.grid.map((points) => (
            <polyline
              key={points}
              points={points}
              fill="none"
              stroke={getInk(0.18)}
              strokeDasharray="1 4"
            />
          ))}
        </g>
      </g>
      <polyline
        points={face.surface}
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth="1.2"
      />
      <polyline points={face.seaLevel} fill="none" stroke={getInk(0.45)} strokeWidth="0.8" />
    </>
  );
}

function SlabLines({ lines, width, dash }: { lines: SlabLine[]; width: number; dash?: string }) {
  return lines.flatMap(({ runs, opacity }, line) =>
    runs.map((points) => (
      <polyline
        key={`${line}-${points.slice(0, 16)}`}
        points={points}
        fill="none"
        stroke={getInk(opacity)}
        strokeWidth={width}
        strokeDasharray={dash}
      />
    )),
  );
}

function HaloText({
  label,
  dy,
  fill,
  children,
}: {
  label: SlabLabel;
  dy: number;
  fill: string;
  children: string;
}) {
  const { x, y, anchor } = label;
  return (
    <>
      <text
        x={x}
        y={y + dy}
        textAnchor={anchor}
        className={SMALL_LABEL_CLASS_NAME}
        fill="none"
        stroke={FACE_FILL}
        strokeWidth="5"
        strokeLinejoin="round"
      >
        {children}
      </text>
      <text x={x} y={y + dy} textAnchor={anchor} className={SMALL_LABEL_CLASS_NAME} fill={fill}>
        {children}
      </text>
    </>
  );
}

function Legend({ prefix, locale }: { prefix: string; locale: Locale }) {
  const othersY = LEGEND.firstRowY + LEGEND.rowGap * SECTION_LAYER_ORDER.length + 7;
  return (
    <g data-testid="section-legend">
      <text
        x={LEGEND.x}
        y={LEGEND.titleY}
        className={SMALL_LABEL_CLASS_NAME}
        fill="var(--color-foreground)"
      >
        {getUpperLabel(m.section_legend_title, locale)}
      </text>
      {SECTION_LAYER_ORDER.map((layer, row) => {
        const y = LEGEND.firstRowY + LEGEND.rowGap * row;
        return (
          <g key={layer}>
            <rect
              x={LEGEND.x}
              y={y}
              width="18"
              height="10"
              fill={getUrl(prefix, layer)}
              stroke={getInk(0.35)}
              strokeWidth="0.6"
            />
            <text x={LEGEND.labelX} y={y + 8} className={`${SMALL_LABEL_CLASS_NAME} fill-muted`}>
              {getLayerName(layer, locale)}
            </text>
          </g>
        );
      })}
      <circle
        cx={LEGEND.x + 9}
        cy={othersY}
        r="3.6"
        fill={SHADE_FILL}
        stroke={getInk(0.9)}
        strokeWidth="0.9"
      />
      <text x={LEGEND.labelX} y={othersY + 3} className={`${SMALL_LABEL_CLASS_NAME} fill-muted`}>
        {getUpperLabel(m.section_legend_others, locale)}
      </text>
    </g>
  );
}

export function SectionFigure({
  model,
  earthquake,
  locale,
  ringsRef,
}: {
  model: SectionModel;
  earthquake: Earthquake;
  locale: Locale;
  ringsRef: Ref<SVGGElement>;
}) {
  const prefix = `section${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { backLines, front, east, slab, hypocentre, others, scale } = model;
  const { x: viewX, y: viewY, width, height } = SECTION_VIEW_BOX;

  return (
    <svg
      aria-hidden="true"
      data-testid="section-figure"
      viewBox={`${viewX} ${viewY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="size-full overflow-visible"
    >
      <PatternDefs prefix={prefix} />
      <g mask={getUrl(prefix, 'fade')}>
        {backLines.map((line) => (
          <g key={line.index}>
            <polygon points={line.polygon} fill={FACE_FILL} />
            <polyline
              points={line.line}
              fill="none"
              stroke={getInk(line.opacity)}
              strokeWidth="0.8"
            />
            {line.land.map((points) => (
              <polyline
                key={points}
                points={points}
                fill="none"
                stroke={getInk(line.landOpacity)}
                strokeWidth="1"
              />
            ))}
          </g>
        ))}
        <CutFace face={east} prefix={prefix} name="east" />
        <CutFace face={front} prefix={prefix} name="front" />
        {slab && (
          <g data-testid="section-slab" mask={getUrl(prefix, 'down')}>
            <SlabLines lines={slab.back} width={0.8} dash="2 4" />
            <SlabLines lines={slab.echoes} width={0.8} />
            {slab.front.map((points) => (
              <polyline
                key={points}
                points={points}
                fill="none"
                stroke={getInk(1)}
                strokeWidth="1.4"
              />
            ))}
          </g>
        )}
      </g>
      {scale.ticks.map(({ depthKm, y }) => (
        <g key={depthKm}>
          <line x1={AXIS.tickX1} x2={AXIS.tickX2} y1={y} y2={y} className="stroke-muted" />
          <text
            x={AXIS.labelX}
            y={y + 3}
            textAnchor="end"
            className={`${LABEL_CLASS_NAME} fill-muted`}
          >
            {getDepthTickLabel(depthKm, locale)}
          </text>
        </g>
      ))}
      {others.map((other) => (
        <g key={other.id} data-testid="section-other">
          <line
            x1={other.x}
            x2={other.x}
            y1={other.topY}
            y2={other.y}
            stroke={getInk(0.45)}
            strokeWidth="0.8"
          />
          <circle cx={other.x} cy={other.topY} r="1.3" fill={getInk(0.7)} />
          <circle
            cx={other.x}
            cy={other.y}
            r={other.radius}
            fill={SHADE_FILL}
            stroke={getInk(0.9)}
            strokeWidth="0.9"
          />
        </g>
      ))}
      <line
        x1={hypocentre.x}
        x2={hypocentre.x}
        y1={hypocentre.surfaceY}
        y2={hypocentre.y - 12}
        stroke={getInk(0.8)}
        strokeDasharray="2 3"
      />
      <g ref={ringsRef} clipPath={getUrl(prefix, 'front')}>
        {PULSE_RINGS.map(({ radius, opacity }) => (
          <circle
            key={radius}
            cx={hypocentre.x}
            cy={hypocentre.y}
            r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity={opacity}
          />
        ))}
      </g>
      <circle
        data-testid="section-hypocentre"
        cx={hypocentre.x}
        cy={hypocentre.y}
        r="7"
        fill={getDepthColor(earthquake.depthKm)}
      />
      <circle
        cx={hypocentre.x}
        cy={hypocentre.y}
        r="11.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.2"
      />
      <text
        x={hypocentre.x + 18}
        y={hypocentre.y + 3}
        className={LABEL_CLASS_NAME}
        fill="var(--color-foreground)"
      >
        {getSectionHypocentreLabel(earthquake.magnitude, earthquake.depthKm, locale)}
      </text>
      <circle cx={hypocentre.x} cy={hypocentre.surfaceY} r="2.5" fill="var(--color-foreground)" />
      {slab && (
        <g>
          <HaloText label={slab.label} dy={0} fill="var(--color-foreground)">
            {getUpperLabel(m.section_slab_top, locale)}
          </HaloText>
          <HaloText label={slab.label} dy={14} fill="var(--color-muted)">
            {getUpperLabel(m.section_slab_model, locale)}
          </HaloText>
        </g>
      )}
      <Legend prefix={prefix} locale={locale} />
      <text x={SECTION_FRAME.left} y={FOOTNOTE_Y} className={`${LABEL_CLASS_NAME} fill-muted`}>
        {m.section_west({}, { locale })}
      </text>
      <text
        x={SECTION_FRAME.right}
        y={FOOTNOTE_Y}
        textAnchor="end"
        className={`${LABEL_CLASS_NAME} fill-muted`}
      >
        {m.section_east({}, { locale })}
      </text>
      <text
        x={SECTION_FRAME.centre}
        y={FOOTNOTE_Y}
        textAnchor="middle"
        className={`${SMALL_LABEL_CLASS_NAME} fill-muted`}
      >
        {getSectionFootnote(scale.stretch, locale)}
      </text>
    </svg>
  );
}
