import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AreaStrip } from '@/containers/detail-map/area-strip';
import { usePhoneLayout } from '@/hooks/use-phone-layout';
import type { Earthquake } from '@/lib/earthquakes/types';
import { isPhoneViewport } from '@/lib/layout/phone';
import {
  getPhoneSectionBandStyle,
  getPhoneSectionView,
  getSectionContent,
} from '@/lib/section/phone-section';
import {
  SECTION_LAYER_ORDER,
  getLayerName,
  getSectionAlt,
  getSectionBlurb,
  getSectionFootnote,
  getUpperLabel,
} from '@/lib/section/section-labels';
import type { SectionModel } from '@/lib/section/section-model';
import { setSectionShown } from '@/lib/section/section-shown-store';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

import { PatternDefs, SectionFigure } from './section-figure';
import { useSectionData } from './use-section-data';
import { useSectionWave } from './use-section-wave';

const FIGURE_BOX_CLASS_NAME =
  'absolute top-(--section-top) right-4 left-[max(1rem,env(safe-area-inset-left))] h-(--section-height) short:right-84 lg:top-[200px] lg:right-0 lg:bottom-[170px] lg:left-120 lg:h-auto';
const STATUS_CLASS_NAME = `${FIGURE_BOX_CLASS_NAME} flex flex-col items-center justify-center gap-4 text-center text-body-s text-muted lg:text-start`;
const RETRY_CLASS_NAME =
  'relative min-h-[34px] cursor-pointer rounded-pill border border-muted px-4 py-2.5 text-[11px] leading-[1.2] font-medium tracking-[0.2em] text-foreground uppercase before:absolute before:inset-x-0 before:-inset-y-[5px] hover:border-accent disabled:cursor-default disabled:opacity-40 lg:static lg:min-h-0 lg:text-[9.5px] lg:before:hidden';
const SWATCH_STROKE = 'rgb(230 228 245 / 0.35)';

type BoxSize = { width: number; height: number };

function getNoteClassName(isExpanded: boolean): string {
  return isExpanded ? 'md:hidden' : 'hidden';
}

function SectionFigureBlock({
  model,
  earthquake,
  locale,
}: {
  model: SectionModel;
  earthquake: Earthquake;
  locale: Locale;
}) {
  const ringsRef = useRef<SVGGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const captionId = useId();
  const content = useMemo(() => getSectionContent(model), [model]);
  const alt = getSectionAlt(
    {
      depthKm: earthquake.depthKm,
      facts: model.facts,
      hasSlab: model.slab !== null,
      otherCount: model.others.length,
    },
    locale,
  );
  const [box, setBox] = useState<BoxSize | null>(null);
  const phone = useMemo(() => box && getPhoneSectionView(box, content), [box, content]);

  useSectionWave(ringsRef, earthquake.id);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    function measure() {
      if (!element) return;
      const { width, height } = element.getBoundingClientRect();
      const isPhone =
        isPhoneViewport(window.innerWidth, window.innerHeight) && width > 0 && height > 0;
      setBox((current) => {
        if (!isPhone) return null;
        if (current?.width === width && current.height === height) return current;
        return { width, height };
      });
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <figure
      aria-labelledby={captionId}
      className={`${FIGURE_BOX_CLASS_NAME} m-0 flex flex-col lg:block`}
    >
      <figcaption id={captionId} className="sr-only">
        {alt}
      </figcaption>
      <p aria-hidden="true" className="mb-2 text-caption text-muted lg:hidden">
        {getSectionFootnote(model.scale.stretch, locale)}
      </p>
      <div ref={boxRef} className="min-h-0 flex-1 lg:size-full">
        <SectionFigure
          model={model}
          earthquake={earthquake}
          locale={locale}
          ringsRef={ringsRef}
          phone={phone}
        />
      </div>
    </figure>
  );
}

export function SectionNote({ quake, isExpanded = true }: { quake: string; isExpanded?: boolean }) {
  const { earthquake, model } = useSectionData(quake);
  const locale = getLocale();
  const prefix = `note${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      data-testid="section-note"
      className={`mt-4 border-t border-line pt-3.5 ${getNoteClassName(isExpanded)}`}
    >
      <svg aria-hidden="true" className="absolute size-0">
        <PatternDefs prefix={prefix} />
      </svg>
      <h3 className="text-caption-bold uppercase">{m.section_heading()}</h3>
      {earthquake && model && (
        <p className="mt-1.5 text-body-s leading-normal text-muted">
          {getSectionBlurb(earthquake.source, model.slab !== null, locale)}
        </p>
      )}
      <p className="mt-3 text-caption">{getUpperLabel(m.section_legend_title, locale)}</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-caption text-muted">
        {SECTION_LAYER_ORDER.map((layer) => (
          <li key={layer} className="flex items-center gap-2">
            <svg aria-hidden="true" width="18" height="10" className="shrink-0">
              <rect
                x="0.3"
                y="0.3"
                width="17.4"
                height="9.4"
                fill={`url(#${prefix}-${layer})`}
                stroke={SWATCH_STROKE}
                strokeWidth="0.6"
              />
            </svg>
            {getLayerName(layer, locale)}
          </li>
        ))}
        <li className="col-span-2 flex items-center gap-2">
          <svg aria-hidden="true" width="18" height="10" className="shrink-0">
            <circle
              cx="9"
              cy="5"
              r="3.6"
              fill="none"
              stroke="rgb(230 228 245 / 0.9)"
              strokeWidth="0.9"
            />
          </svg>
          {getUpperLabel(m.section_legend_others, locale)}
        </li>
      </ul>
    </div>
  );
}

export default function SectionView({ quake }: { quake: string }) {
  const locale = getLocale();
  const layout = usePhoneLayout();
  const { earthquake, model, isError, isFetching, retry } = useSectionData(quake);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const hostRef = useCallback((node: HTMLSpanElement | null) => {
    setHost(node?.closest('main') ?? null);
  }, []);

  const view = (
    <div
      ref={viewRef}
      data-testid="section-view"
      style={getPhoneSectionBandStyle(layout)}
      className="pointer-events-auto absolute inset-0 z-[5] block bg-background bg-page md:hidden lg:block"
    >
      <div className="absolute top-[158px] left-139 hidden w-[520px] lg:block">
        <h3 className="text-caption-bold uppercase">{m.section_heading()}</h3>
        {earthquake && model && (
          <p className="mt-2 text-body-s leading-normal text-muted">
            {getSectionBlurb(earthquake.source, model.slab !== null, locale)}
          </p>
        )}
      </div>
      {earthquake && model && (
        <SectionFigureBlock model={model} earthquake={earthquake} locale={locale} />
      )}
      {isError && (
        <div role="alert" className={STATUS_CLASS_NAME}>
          <p>{m.section_error()}</p>
          <button type="button" disabled={isFetching} onClick={retry} className={RETRY_CLASS_NAME}>
            {m.details_retry()}
          </button>
        </div>
      )}
      {!isError && !model && <output className={STATUS_CLASS_NAME}>{m.section_loading()}</output>}
      <div className="hidden lg:contents">
        <AreaStrip />
      </div>
    </div>
  );

  useLayoutEffect(() => {
    const element = viewRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSectionShown(entry.contentRect.width > 0);
    });
    observer.observe(element);
    setSectionShown(element.getBoundingClientRect().width > 0);
    return () => {
      observer.disconnect();
      setSectionShown(false);
    };
  }, [host]);

  return (
    <>
      <span hidden ref={hostRef} />
      {host && createPortal(view, host)}
    </>
  );
}
