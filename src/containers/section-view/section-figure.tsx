import { type CSSProperties, type Ref, useId, useLayoutEffect, useRef, useState } from 'react';

import { getDepthColor } from '@/lib/earthquakes/depth-color';
import type { Earthquake } from '@/lib/earthquakes/types';
import { SECTION_FRAME } from '@/lib/section/depth-scale';
import {
  PHONE_SECTION,
  type PhoneSectionView,
  type PlacedLabel,
  type SectionBox,
  getPhoneHypocentreLabel,
  getPhoneSlabLabel,
} from '@/lib/section/phone-section';
import {
  SECTION_LAYER_ORDER,
  getDepthTickLabel,
  getLayerName,
  getSectionFootnote,
  getSectionHypocentreLabel,
  getUpperLabel,
} from '@/lib/section/section-labels';
import type { Face, LayerId, SectionModel, SlabLine } from '@/lib/section/section-model';
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
const PHONE_AXIS = { tickX1Px: 2, tickX2Px: 8, labelGapPx: 3 } as const;
const PHONE_SVG_CLASS_NAME = 'size-full overflow-hidden [&_*]:[vector-effect:non-scaling-stroke]';
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

export function PatternDefs({ prefix, unit }: { prefix: string; unit?: number }) {
  const id = (name: string) => getId(prefix, name);
  const patternTransform = unit === undefined ? undefined : `scale(${unit})`;
  return (
    <defs>
      <pattern
        id={id('water')}
        width="6"
        height="4"
        patternUnits="userSpaceOnUse"
        patternTransform={patternTransform}
      >
        <path d="M0 2 H6" stroke={getInk(0.35)} strokeWidth="0.7" />
      </pattern>
      <pattern
        id={id('sediments')}
        width="8"
        height="3"
        patternUnits="userSpaceOnUse"
        patternTransform={patternTransform}
      >
        <path d="M0 1.5 H4" stroke={getInk(0.7)} strokeWidth="0.7" />
      </pattern>
      <pattern
        id={id('upper')}
        width="3"
        height="3"
        patternUnits="userSpaceOnUse"
        patternTransform={patternTransform}
      >
        <rect x="1" y="1" width="1.1" height="1.1" fill={getInk(0.65)} />
      </pattern>
      <pattern
        id={id('middle')}
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform={patternTransform}
      >
        <path d="M-1 6 L6 -1" stroke={getInk(0.45)} strokeWidth="0.7" />
      </pattern>
      <pattern
        id={id('lower')}
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform={patternTransform}
      >
        <path d="M-1 -1 L6 6" stroke={getInk(0.35)} strokeWidth="0.7" />
      </pattern>
      <pattern
        id={id('mantle')}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform={patternTransform}
      >
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

type TextProps = { className: string; style?: CSSProperties };

function getTextProps(
  phone: PhoneSectionView | null,
  desktopClassName: string,
  colorClassName = '',
): TextProps {
  if (!phone) return { className: `${desktopClassName} ${colorClassName}`.trim() };
  return {
    className: `font-medium ${colorClassName}`.trim(),
    style: {
      fontSize: `${PHONE_SECTION.fontPx * phone.unit}px`,
      letterSpacing: `${PHONE_SECTION.trackingPx * phone.unit}px`,
    },
  };
}

function HaloText({
  x,
  y,
  anchor,
  textProps,
  fill,
  measure,
  children,
}: {
  x: number;
  y: number;
  anchor: 'start' | 'end';
  textProps: TextProps;
  fill: string;
  measure?: string;
  children: string;
}) {
  return (
    <>
      <text
        data-halo
        x={x}
        y={y}
        textAnchor={anchor}
        {...textProps}
        fill="none"
        stroke={FACE_FILL}
        strokeWidth="5"
        strokeLinejoin="round"
      >
        {children}
      </text>
      <text x={x} y={y} textAnchor={anchor} {...textProps} fill={fill} data-measure={measure}>
        {children}
      </text>
    </>
  );
}

function getSideLabelY(phone: PhoneSectionView, bottomY: number): number {
  return bottomY + (PHONE_SECTION.padBottomPx - PHONE_SECTION.descentPx) * phone.unit;
}

function getSideLabelBox(x: number, y: number, width: number, unit: number): SectionBox {
  const { capPx, descentPx } = PHONE_SECTION;
  return { x, y: y - capPx * unit, width, height: (capPx + descentPx) * unit };
}

type PhoneLabels = {
  ticks: { depthKm: number; x: number; y: number; box: SectionBox }[];
  hypocentre: PlacedLabel;
  slab: PlacedLabel | null;
};

function getPhoneLabels(
  phone: PhoneSectionView,
  model: SectionModel,
  widths: Record<string, number>,
): PhoneLabels {
  const { unit } = phone;
  const x = phone.x + PHONE_AXIS.tickX1Px * unit;
  const ticks = model.scale.ticks.map(({ depthKm, y }) => {
    const baseline = y - PHONE_AXIS.labelGapPx * unit;
    const box = {
      x,
      y: baseline - PHONE_SECTION.capPx * unit,
      width: widths[`tick-${depthKm}`] ?? 0,
      height: (PHONE_SECTION.capPx + PHONE_SECTION.descentPx) * unit,
    };
    return { depthKm, x, y: baseline, box };
  });
  const { hypocentre: centre } = model;
  const hypocentre = getPhoneHypocentreLabel(phone, centre, widths.hypocentre ?? 0);
  const markerPx = 11.5 * unit;
  const marker = {
    x: centre.x - markerPx,
    y: centre.y - markerPx,
    width: markerPx * 2,
    height: markerPx * 2,
  };
  const sideY = getSideLabelY(phone, model.scale.bottomY);
  const edge = PHONE_SECTION.edgePx * unit;
  const westWidth = widths.west ?? 0;
  const eastWidth = widths.east ?? 0;
  const sides = [
    getSideLabelBox(phone.x + edge, sideY, westWidth, unit),
    getSideLabelBox(phone.x + phone.width - edge - eastWidth, sideY, eastWidth, unit),
  ];
  const obstacles = [...ticks.map(({ box }) => box), hypocentre.box, marker, ...sides];
  const slabWidth = Math.max(widths['slab-top'] ?? 0, widths['slab-model'] ?? 0);
  return {
    ticks,
    hypocentre,
    slab: model.slab && getPhoneSlabLabel(phone, model.slab.label, slabWidth, obstacles),
  };
}

function getMeasuredWidths(svg: SVGSVGElement | null): Record<string, number> {
  const widths: Record<string, number> = {};
  svg?.querySelectorAll<SVGTextElement>('text[data-measure]').forEach((text) => {
    widths[text.dataset.measure ?? ''] = text.getBBox().width;
  });
  return widths;
}

function isSameWidths(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((key) => a[key] === b[key]);
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

function getViewBox(phone: PhoneSectionView | null): string {
  const { x, y, width, height } = phone ?? SECTION_VIEW_BOX;
  return `${x} ${y} ${width} ${height}`;
}

function getSvgClassName(phone: PhoneSectionView | null): string {
  return phone ? PHONE_SVG_CLASS_NAME : 'size-full overflow-visible';
}

function DepthAxis({
  model,
  phone,
  labels,
  locale,
}: {
  model: SectionModel;
  phone: PhoneSectionView | null;
  labels: PhoneLabels | null;
  locale: Locale;
}) {
  if (!phone || !labels) {
    return model.scale.ticks.map(({ depthKm, y }) => (
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
    ));
  }
  const textProps = getTextProps(phone, LABEL_CLASS_NAME);
  return labels.ticks.map(({ depthKm, x, y }, index) => (
    <g key={depthKm}>
      <line
        x1={phone.x + PHONE_AXIS.tickX1Px * phone.unit}
        x2={phone.x + PHONE_AXIS.tickX2Px * phone.unit}
        y1={model.scale.ticks[index].y}
        y2={model.scale.ticks[index].y}
        className="stroke-muted"
      />
      <HaloText
        x={x}
        y={y}
        anchor="start"
        textProps={textProps}
        fill="var(--color-muted)"
        measure={`tick-${depthKm}`}
      >
        {getDepthTickLabel(depthKm, locale)}
      </HaloText>
    </g>
  ));
}

function SideLabels({
  phone,
  bottomY,
  locale,
}: {
  phone: PhoneSectionView;
  bottomY: number;
  locale: Locale;
}) {
  const { unit } = phone;
  const edge = PHONE_SECTION.edgePx * unit;
  const y = getSideLabelY(phone, bottomY);
  const textProps = getTextProps(phone, LABEL_CLASS_NAME, 'fill-muted');
  return (
    <>
      <text x={phone.x + edge} y={y} {...textProps} data-measure="west">
        {m.section_west({}, { locale })}
      </text>
      <text
        x={phone.x + phone.width - edge}
        y={y}
        textAnchor="end"
        {...textProps}
        data-measure="east"
      >
        {m.section_east({}, { locale })}
      </text>
    </>
  );
}

function DesktopFootnotes({
  prefix,
  stretch,
  locale,
}: {
  prefix: string;
  stretch: SectionModel['scale']['stretch'];
  locale: Locale;
}) {
  return (
    <>
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
        {getSectionFootnote(stretch, locale)}
      </text>
    </>
  );
}

function getHypocentreLabel(
  hypocentre: SectionModel['hypocentre'],
  labels: PhoneLabels | null,
): { x: number; y: number; anchor: 'start' | 'end' } {
  if (labels) return labels.hypocentre;
  return { x: hypocentre.x + 18, y: hypocentre.y + 3, anchor: 'start' };
}

function getSlabLabelLines(
  slab: NonNullable<SectionModel['slab']>,
  phone: PhoneSectionView | null,
  labels: PhoneLabels | null,
): { x: number; y: number; dy: number; anchor: 'start' | 'end' } {
  if (phone && labels?.slab) {
    const { x, y } = labels.slab;
    return { x, y, dy: PHONE_SECTION.lineStepPx * phone.unit, anchor: 'start' };
  }
  return { x: slab.label.x, y: slab.label.y, dy: 14, anchor: slab.label.anchor };
}

function SlabLabelText({
  slab,
  phone,
  labels,
  locale,
}: {
  slab: NonNullable<SectionModel['slab']>;
  phone: PhoneSectionView | null;
  labels: PhoneLabels | null;
  locale: Locale;
}) {
  const { x, y, dy, anchor } = getSlabLabelLines(slab, phone, labels);
  const textProps = getTextProps(phone, SMALL_LABEL_CLASS_NAME);
  return (
    <g>
      <HaloText
        x={x}
        y={y}
        anchor={anchor}
        textProps={textProps}
        fill="var(--color-foreground)"
        measure={phone ? 'slab-top' : undefined}
      >
        {getUpperLabel(m.section_slab_top, locale)}
      </HaloText>
      <HaloText
        x={x}
        y={y + dy}
        anchor={anchor}
        textProps={textProps}
        fill="var(--color-muted)"
        measure={phone ? 'slab-model' : undefined}
      >
        {getUpperLabel(m.section_slab_model, locale)}
      </HaloText>
    </g>
  );
}

export function SectionFigure({
  model,
  earthquake,
  locale,
  ringsRef,
  phone = null,
}: {
  model: SectionModel;
  earthquake: Earthquake;
  locale: Locale;
  ringsRef: Ref<SVGGElement>;
  phone?: PhoneSectionView | null;
}) {
  const prefix = `section${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const { backLines, front, east, slab, hypocentre, others, scale } = model;
  const markerScale = phone?.unit ?? 1;
  const [widths, setWidths] = useState<Record<string, number>>({});
  const labels = phone && getPhoneLabels(phone, model, widths);
  const hypocentreLabel = getHypocentreLabel(hypocentre, labels);
  const hypocentreTextProps = getTextProps(phone, LABEL_CLASS_NAME);

  useLayoutEffect(() => {
    if (!phone) return;
    const measured = getMeasuredWidths(svgRef.current);
    setWidths((current) => (isSameWidths(current, measured) ? current : measured));
  }, [phone, model, locale, earthquake.magnitude, earthquake.depthKm]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      data-testid="section-figure"
      viewBox={getViewBox(phone)}
      preserveAspectRatio="xMidYMid meet"
      className={getSvgClassName(phone)}
    >
      <PatternDefs prefix={prefix} unit={phone?.unit} />
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
      <DepthAxis model={model} phone={phone} labels={labels} locale={locale} />
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
          <circle cx={other.x} cy={other.topY} r={1.3 * markerScale} fill={getInk(0.7)} />
          <circle
            cx={other.x}
            cy={other.y}
            r={other.radius * markerScale}
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
        y2={hypocentre.y - 12 * markerScale}
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
        r={7 * markerScale}
        fill={getDepthColor(earthquake.depthKm)}
      />
      <circle
        cx={hypocentre.x}
        cy={hypocentre.y}
        r={11.5 * markerScale}
        fill="none"
        stroke="#fff"
        strokeWidth="1.2"
      />
      {phone ? (
        <HaloText
          {...hypocentreLabel}
          textProps={hypocentreTextProps}
          fill="var(--color-foreground)"
          measure="hypocentre"
        >
          {getSectionHypocentreLabel(earthquake.magnitude, earthquake.depthKm, locale)}
        </HaloText>
      ) : (
        <text
          x={hypocentreLabel.x}
          y={hypocentreLabel.y}
          {...hypocentreTextProps}
          fill="var(--color-foreground)"
        >
          {getSectionHypocentreLabel(earthquake.magnitude, earthquake.depthKm, locale)}
        </text>
      )}
      <circle
        cx={hypocentre.x}
        cy={hypocentre.surfaceY}
        r={2.5 * markerScale}
        fill="var(--color-foreground)"
      />
      {slab && <SlabLabelText slab={slab} phone={phone} labels={labels} locale={locale} />}
      {phone ? (
        <SideLabels phone={phone} bottomY={scale.bottomY} locale={locale} />
      ) : (
        <DesktopFootnotes prefix={prefix} stretch={scale.stretch} locale={locale} />
      )}
    </svg>
  );
}
