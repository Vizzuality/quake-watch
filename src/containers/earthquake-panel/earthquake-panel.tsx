import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  type ReactNode,
  type Ref,
  Suspense,
  lazy,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BottomSheet } from '@/components/bottom-sheet/bottom-sheet';
import { InfoLabel } from '@/components/info-button/info-button';
import { getQuakeKey, getSelectedEarthquake } from '@/containers/globe/use-hovered-quake';
import { setWavePaused, useIsWavePaused } from '@/containers/globe/wave-pause';
import { requestWaveReplay } from '@/containers/globe/wave-replay';
import { ViewToggle } from '@/containers/section-view/view-toggle';
import { usePhoneLayout } from '@/hooks/use-phone-layout';
import { getDepthColor } from '@/lib/earthquakes/depth-color';
import {
  type EarthquakePosition,
  DEPTH_SCALE_KM,
  getDepthScaleFraction,
  getDetailsDate,
  getEarthquakePosition,
  getFeltReports,
  getMagnitudeTypeCaption,
  getMagnitudeValueLabel,
  getPositionLabel,
  getTimeOrderedEarthquakes,
} from '@/lib/earthquakes/details-panel';
import {
  earthquakeDetailQueryOptions,
  getDetailEarthquake,
} from '@/lib/earthquakes/details/query-options';
import { getEarthquakeMeaning } from '@/lib/earthquakes/meaning';
import { SOURCE_ADAPTERS, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import {
  type Sequence,
  getSequenceBlurb,
  getSequenceOf,
  getSequenceRoleLabel,
  getSequenceRows,
  getSequences,
} from '@/lib/earthquakes/sequences';
import {
  getTooltipCompactMeta,
  getTooltipFelt,
  getTooltipMagnitude,
} from '@/lib/earthquakes/tooltip';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getDecimalLabel, getKmLabel } from '@/lib/format';
import { getDetailSheetOpenTop } from '@/lib/layout/phone-detail';
import { DETAILS_HEADING_ID } from '@/lib/layout/skip-targets';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

type PanelState = 'loading' | 'not-found' | 'error' | 'ready';
type QueryFlags = { isListPending: boolean; isDetailPending: boolean; isDetailError: boolean };

const homeRoute = getRouteApi('/');
const SectionView = lazy(() => import('@/containers/section-view/section-view'));
const SectionNote = lazy(() =>
  import('@/containers/section-view/section-view').then(({ SectionNote }) => ({
    default: SectionNote,
  })),
);
const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const PILL_BASE_CLASS_NAME =
  'pointer-events-auto flex cursor-pointer items-center gap-2 rounded-pill border leading-[1.2] font-medium tracking-[0.2em] text-foreground uppercase hover:border-accent disabled:cursor-default disabled:opacity-40 disabled:hover:border-muted';
const PILL_CLASS_NAME = `${PILL_BASE_CLASS_NAME} border-muted text-[9.5px]`;
const CIRCLE_HIT_CLASS_NAME =
  'relative before:absolute before:-inset-[6px] md:static md:before:hidden';
const PREVIOUS_HIT_CLASS_NAME =
  'relative before:absolute before:-inset-y-[6px] before:-right-[3px] before:-left-[9px] md:static md:before:hidden';
const ROW_HIT_CLASS_NAME =
  'before:absolute before:inset-x-0 before:-inset-y-[7px] md:before:hidden';
const DETAIL_GRID_CLASS_NAME = 'grid-cols-2 gap-x-5 gap-y-3 md:grid md:gap-x-8 md:gap-y-4';
const DEPTH_GRADIENT = `linear-gradient(90deg, var(--color-depth-0) 0%, var(--color-depth-70) ${(70 / DEPTH_SCALE_KM) * 100}%, var(--color-depth-300) ${(300 / DEPTH_SCALE_KM) * 100}%, var(--color-depth-700) 100%)`;

function getFocusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function isFocusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

function getPanelState(
  earthquake: Earthquake | null,
  { isListPending, isDetailPending, isDetailError }: QueryFlags,
): PanelState {
  if (earthquake) return 'ready';
  if (isDetailError) return 'error';
  if (isDetailPending || isListPending) return 'loading';
  return 'not-found';
}

function getDetailGridClassName(isExpanded: boolean): string {
  return cn(DETAIL_GRID_CLASS_NAME, isExpanded ? 'grid' : 'hidden');
}

function getSequenceClassName(isExpanded: boolean): string {
  return isExpanded ? 'md:contents' : 'hidden md:contents';
}

function getMoreDetailsLabel(isExpanded: boolean): string {
  return isExpanded ? m.details_less() : m.details_more();
}

function getFeltCaption(earthquake: Earthquake): string | undefined {
  const meaning = getEarthquakeMeaning({ ...earthquake, distanceKm: null });
  return meaning.kind === 'felt-reach' ? m.details_felt_caption() : undefined;
}

function CaretLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" fill="currentColor" className="size-3">
      <path d="M7.69875 9.55125C7.72638 9.577 7.74855 9.60805 7.76392 9.64255C7.77929 9.67705 7.78756 9.71429 7.78822 9.75205C7.78889 9.78982 7.78194 9.82733 7.7678 9.86235C7.75365 9.89737 7.7326 9.92918 7.70589 9.95589C7.67918 9.9826 7.64737 10.0037 7.61235 10.0178C7.57733 10.0319 7.53982 10.0389 7.50205 10.0382C7.46429 10.0376 7.42705 10.0293 7.39255 10.0139C7.35805 9.99855 7.327 9.97638 7.30125 9.94875L3.55125 6.19875C3.49858 6.14602 3.469 6.07453 3.469 6C3.469 5.92547 3.49858 5.85398 3.55125 5.80125L7.30125 2.05125C7.35457 2.00157 7.42508 1.97452 7.49795 1.97581C7.57081 1.97709 7.64033 2.00661 7.69186 2.05814C7.74339 2.10967 7.7729 2.17919 7.77419 2.25205C7.77548 2.32492 7.74843 2.39543 7.69875 2.44875L4.14797 6L7.69875 9.55125Z" />
    </svg>
  );
}

function CaretRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-3">
      <path d="M16.8975 12.3975L9.3975 19.8975C9.29087 19.9969 9.14983 20.051 9.00411 20.0484C8.85838 20.0458 8.71934 19.9868 8.61628 19.8837C8.51322 19.7807 8.45419 19.6416 8.45162 19.4959C8.44905 19.3502 8.50314 19.2091 8.6025 19.1025L15.7041 12L8.6025 4.8975C8.50314 4.79087 8.44905 4.64983 8.45162 4.50411C8.45419 4.35838 8.51322 4.21934 8.61628 4.11628C8.71934 4.01322 8.85838 3.95419 9.00411 3.95162C9.14983 3.94905 9.29087 4.00314 9.3975 4.1025L16.8975 11.6025C17.0028 11.708 17.062 11.8509 17.062 12C17.062 12.1491 17.0028 12.292 16.8975 12.3975Z" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" fill="currentColor" className="size-3">
      <path d="M10.4062 6C10.4062 6.07459 10.3766 6.14613 10.3239 6.19887C10.2711 6.25162 10.1996 6.28125 10.125 6.28125H2.55422L5.44875 9.17625C5.47638 9.202 5.49855 9.23305 5.51392 9.26755C5.52929 9.30205 5.53756 9.33929 5.53822 9.37705C5.53889 9.41482 5.53194 9.45233 5.5178 9.48735C5.50365 9.52237 5.4826 9.55418 5.45589 9.58089C5.42918 9.6076 5.39737 9.62865 5.36235 9.6428C5.32733 9.65694 5.28982 9.66389 5.25205 9.66322C5.21429 9.66256 5.17705 9.65429 5.14255 9.63892C5.10805 9.62355 5.077 9.60138 5.05125 9.57375L1.67625 6.19875C1.62358 6.14602 1.594 6.07453 1.594 6C1.594 5.92547 1.62358 5.85398 1.67625 5.80125L5.05125 2.42625C5.10457 2.37657 5.17508 2.34952 5.24795 2.35081C5.32081 2.3521 5.39033 2.38161 5.44186 2.43314C5.49339 2.48467 5.5229 2.55419 5.52419 2.62705C5.52548 2.69992 5.49843 2.77043 5.44875 2.82375L2.55422 5.71875H10.125C10.1996 5.71875 10.2711 5.74838 10.3239 5.80113C10.3766 5.85387 10.4062 5.92541 10.4062 6Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-3">
      <path d="M21.69 10.8928L8.1825 2.63062C7.98324 2.50841 7.75496 2.44163 7.52126 2.43718C7.28755 2.43273 7.05689 2.49077 6.85313 2.60531C6.65045 2.71662 6.48161 2.8806 6.36444 3.07995C6.24728 3.27929 6.18614 3.50659 6.1875 3.73781V20.2622C6.18614 20.4934 6.24728 20.7207 6.36444 20.9201C6.48161 21.1194 6.65045 21.2834 6.85313 21.3947C7.05689 21.5092 7.28755 21.5673 7.52126 21.5628C7.75496 21.5584 7.98324 21.4916 8.1825 21.3694L21.69 13.1072C21.8801 12.9916 22.0373 12.8291 22.1464 12.6352C22.2554 12.4412 22.3127 12.2225 22.3127 12C22.3127 11.7775 22.2554 11.5588 22.1464 11.3648C22.0373 11.1709 21.8801 11.0084 21.69 10.8928ZM21.1031 12.1472L7.59375 20.4094C7.56459 20.4269 7.53121 20.4362 7.49719 20.4362C7.46317 20.4362 7.42979 20.4269 7.40063 20.4094C7.37237 20.3956 7.34858 20.3741 7.33199 20.3474C7.3154 20.3207 7.3067 20.2899 7.30688 20.2584V3.73781C7.3067 3.70638 7.3154 3.67553 7.33199 3.64883C7.34858 3.62213 7.37237 3.60065 7.40063 3.58687C7.43096 3.56996 7.46529 3.56154 7.5 3.5625C7.53328 3.56369 7.56564 3.57372 7.59375 3.59156L21.1031 11.8528C21.1288 11.8679 21.1501 11.8894 21.1649 11.9152C21.1797 11.941 21.1874 11.9702 21.1874 12C21.1874 12.0298 21.1797 12.059 21.1649 12.0848C21.1501 12.1106 21.1288 12.1321 21.1031 12.1472Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor" className="size-3">
      <path d="M200,34H160a14,14,0,0,0-14,14V208a14,14,0,0,0,14,14h40a14,14,0,0,0,14-14V48A14,14,0,0,0,200,34Zm2,174a2,2,0,0,1-2,2H160a2,2,0,0,1-2-2V48a2,2,0,0,1,2-2h40a2,2,0,0,1,2,2ZM96,34H56A14,14,0,0,0,42,48V208a14,14,0,0,0,14,14H96a14,14,0,0,0,14-14V48A14,14,0,0,0,96,34Zm2,174a2,2,0,0,1-2,2H56a2,2,0,0,1-2-2V48a2,2,0,0,1,2-2H96a2,2,0,0,1,2,2Z" />
    </svg>
  );
}

function ArrowSquareOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="size-4 text-muted">
      <path d="M13.875 6.5C13.875 6.59946 13.8355 6.69484 13.7652 6.76516C13.6948 6.83549 13.5995 6.875 13.5 6.875C13.4005 6.875 13.3052 6.83549 13.2348 6.76516C13.1645 6.69484 13.125 6.59946 13.125 6.5V3.40563L8.76562 7.765C8.69454 7.83124 8.60051 7.8673 8.50336 7.86559C8.40621 7.86387 8.31352 7.82452 8.24481 7.75581C8.17611 7.6871 8.13675 7.59441 8.13504 7.49726C8.13332 7.40011 8.16939 7.30609 8.23563 7.235L12.5944 2.875H9.5C9.40054 2.875 9.30516 2.83549 9.23483 2.76517C9.16451 2.69484 9.125 2.59946 9.125 2.5C9.125 2.40054 9.16451 2.30516 9.23483 2.23483C9.30516 2.16451 9.40054 2.125 9.5 2.125H13.5C13.5995 2.125 13.6948 2.16451 13.7652 2.23483C13.8355 2.30516 13.875 2.40054 13.875 2.5V6.5ZM11.5 8.125C11.4005 8.125 11.3052 8.16451 11.2348 8.23483C11.1645 8.30516 11.125 8.40054 11.125 8.5V13C11.125 13.0332 11.1118 13.0649 11.0884 13.0884C11.0649 13.1118 11.0332 13.125 11 13.125H3C2.96685 13.125 2.93505 13.1118 2.91161 13.0884C2.88817 13.0649 2.875 13.0332 2.875 13V5C2.875 4.96685 2.88817 4.93505 2.91161 4.91161C2.93505 4.88817 2.96685 4.875 3 4.875H7.5C7.59946 4.875 7.69484 4.83549 7.76516 4.76516C7.83549 4.69484 7.875 4.59946 7.875 4.5C7.875 4.40054 7.83549 4.30516 7.76516 4.23484C7.69484 4.16451 7.59946 4.125 7.5 4.125H3C2.76794 4.125 2.54538 4.21719 2.38128 4.38128C2.21719 4.54538 2.125 4.76794 2.125 5V13C2.125 13.2321 2.21719 13.4546 2.38128 13.6187C2.54538 13.7828 2.76794 13.875 3 13.875H11C11.2321 13.875 11.4546 13.7828 11.6187 13.6187C11.7828 13.4546 11.875 13.2321 11.875 13V8.5C11.875 8.40054 11.8355 8.30516 11.7652 8.23483C11.6948 8.16451 11.5995 8.125 11.5 8.125Z" />
    </svg>
  );
}

const DATA_LABEL_CLASS_NAME = 'text-label text-muted uppercase';

function DataCell({
  label,
  info,
  value,
  caption,
}: {
  label: string;
  info: string;
  value: ReactNode;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3 md:pt-3.5">
      <dt className="flex">
        <InfoLabel
          label={label}
          info={info}
          className={`${DATA_LABEL_CLASS_NAME} max-md:line-clamp-2 max-md:whitespace-normal`}
        />
      </dt>
      <dd className="text-value-s whitespace-nowrap md:text-value">{value}</dd>
      {caption && <dd className="text-body-s text-muted">{caption}</dd>}
    </div>
  );
}

function DepthScale({ depthKm, locale }: { depthKm: number; locale: Locale }) {
  const percent = getDepthScaleFraction(depthKm) * 100;

  return (
    <div aria-hidden="true" data-testid="depth-scale" className="flex min-w-0 flex-col gap-2.25">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-2.5 h-[1.5px] bg-line-tick" />
        <div
          className="absolute inset-x-0 top-2.5 h-[1.5px]"
          style={{ backgroundImage: DEPTH_GRADIENT, clipPath: `inset(0 ${100 - percent}% 0 0)` }}
        />
        <span
          className="absolute top-1.25 size-[10.36px] -translate-x-1/2 rounded-full"
          style={{ left: `${percent}%`, backgroundColor: getDepthColor(depthKm) }}
        />
      </div>
      <div className="flex justify-between text-label-s text-muted uppercase">
        <span>{m.details_depth_surface()}</span>
        <span>{getKmLabel(DEPTH_SCALE_KM, locale)}</span>
      </div>
    </div>
  );
}

function EarthquakeFacts({
  earthquake,
  feltReports,
  headingId,
  headingRef,
  locale,
  isExpanded,
  onExpandedChange,
}: {
  earthquake: Earthquake;
  feltReports: number | null;
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  locale: Locale;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  const { magnitude, magnitudeType, depthKm, place, time, source, url } = earthquake;
  const magnitudeLabel = getMagnitudeValueLabel(magnitude, locale);

  return (
    <div className="flex flex-col gap-3.5 md:gap-5.5">
      <div className="flex items-end gap-4 md:contents">
        <div className="shrink-0 md:relative md:shrink">
          <div className="md:absolute md:top-0 md:left-0">
            <InfoLabel
              label={m.details_magnitude()}
              info={m.info_details_magnitude()}
              className={DATA_LABEL_CLASS_NAME}
            />
          </div>
          <p className="mt-0.5 text-numeral-m md:mt-0 md:text-numeral-xl">{magnitudeLabel}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1.5 md:min-w-auto md:flex-initial md:gap-2.5 md:pb-0">
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="text-place-l outline-none md:text-title"
          >
            <span className="sr-only">
              {m.details_heading_prefix({ magnitude: magnitudeLabel })}{' '}
            </span>
            {place ?? m.place_unknown()}
          </h2>
          <p className="text-caption text-muted uppercase md:text-label">
            {getDetailsDate(time, locale)}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:gap-4">
        <dl>
          <div className="flex flex-col gap-1 border-t border-line pt-3 md:pt-3.5">
            <dt className="flex">
              <InfoLabel
                label={m.col_depth()}
                info={m.info_details_depth()}
                className={DATA_LABEL_CLASS_NAME}
              />
            </dt>
            <dd
              data-testid="depth-row"
              className="grid grid-cols-[96px_minmax(0,1fr)] gap-[18px] md:grid-cols-[86px_minmax(0,310px)] md:gap-6"
            >
              <span className="text-value whitespace-nowrap">{getKmLabel(depthKm, locale)}</span>
              <DepthScale depthKm={depthKm} locale={locale} />
            </dd>
          </div>
        </dl>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => onExpandedChange(!isExpanded)}
          className="-my-3 flex h-11 cursor-pointer items-center self-start text-caption text-muted uppercase transition-colors hover:text-foreground md:hidden"
        >
          {getMoreDetailsLabel(isExpanded)}
        </button>
        <dl className={getDetailGridClassName(isExpanded)}>
          <DataCell
            label={m.tooltip_likely_felt()}
            info={m.info_details_likely_felt()}
            value={getTooltipFelt(magnitude, depthKm, locale)}
            caption={getFeltCaption(earthquake)}
          />
          {feltReports !== null && (
            <DataCell
              label={m.details_felt_reports()}
              info={m.info_details_felt_reports()}
              value={getDecimalLabel(feltReports, locale)}
              caption={m.details_felt_reports_caption()}
            />
          )}
          {magnitudeType && (
            <DataCell
              label={m.details_type()}
              info={m.info_details_type()}
              value={magnitudeType.toUpperCase()}
              caption={getMagnitudeTypeCaption(magnitudeType, locale)}
            />
          )}
          <DataCell
            label={m.details_source()}
            info={m.info_details_source()}
            value={
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-baseline gap-2 hover:text-accent"
              >
                {SOURCE_ADAPTERS[source].label}
                <span className="sr-only">{m.details_opens_new_tab()}</span>
                <ArrowSquareOutIcon />
              </a>
            }
          />
        </dl>
      </div>
    </div>
  );
}

function getRoleClassName(isSelected: boolean): string {
  return isSelected ? 'text-label text-accent uppercase' : 'text-label text-muted uppercase';
}

function RelatedEarthquakes({
  sequence,
  selected,
  locale,
  onGoTo,
}: {
  sequence: Sequence | null;
  selected: Earthquake;
  locale: Locale;
  onGoTo: (earthquake: Earthquake) => void;
}) {
  const rows = sequence ? getSequenceRows(sequence, selected) : [];

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3.5">
      <h3 className="text-label text-muted uppercase">{m.details_related()}</h3>
      <p className="text-body-s text-muted">{getSequenceBlurb(sequence, selected, locale)}</p>
      {rows.length > 1 && (
        <ul className="flex flex-col">
          {rows.map((member) => {
            const { earthquake } = member;
            const isSelected = earthquake === selected;
            return (
              <li key={getQuakeKey(earthquake)}>
                <button
                  type="button"
                  aria-current={isSelected || undefined}
                  onClick={() => onGoTo(earthquake)}
                  className="flex h-9 w-full cursor-pointer items-center gap-3 border-b border-line text-left hover:text-accent"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getDepthColor(earthquake.depthKm) }}
                  />
                  <span className="text-body-s font-medium">
                    {getTooltipMagnitude(earthquake.magnitude, locale)}
                  </span>
                  <span className="text-label-s text-muted uppercase">
                    {getTooltipCompactMeta(earthquake.time, earthquake.depthKm, locale)}
                  </span>
                  <span className={`ml-auto ${getRoleClassName(isSelected)}`}>
                    {getSequenceRoleLabel(member, selected, locale)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WavePauseButton() {
  const isPaused = useIsWavePaused();

  return (
    <button
      type="button"
      aria-label={isPaused ? m.details_wave_play() : m.details_wave_pause()}
      onClick={() => setWavePaused(!isPaused)}
      className={`${PILL_BASE_CLASS_NAME} relative size-8 justify-center border-foreground before:absolute before:-inset-[7px] md:size-[34px] md:border-muted md:before:hidden`}
    >
      {isPaused ? <PlayIcon /> : <PauseIcon />}
    </button>
  );
}

function PanelNavigation({
  position,
  locale,
  onClose,
  onGoTo,
}: {
  position: EarthquakePosition | null;
  locale: Locale;
  onClose: () => void;
  onGoTo: (earthquake: Earthquake) => void;
}) {
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const previous = position?.previous ?? null;
  const next = position?.next ?? null;
  const isAtStart = previous === null;
  const isAtEnd = next === null;

  function goPrevious() {
    if (previous) onGoTo(previous);
  }

  function goNext() {
    if (next) onGoTo(next);
  }

  useLayoutEffect(() => {
    if (isAtStart && document.activeElement === previousRef.current) nextRef.current?.focus();
    if (isAtEnd && document.activeElement === nextRef.current) previousRef.current?.focus();
  }, [isAtStart, isAtEnd]);

  return (
    <div className="absolute top-[50px] right-4 left-[max(1rem,env(safe-area-inset-left))] flex items-center gap-2 md:top-13.5 md:right-14 md:left-79 md:gap-7 short:right-84">
      <button
        type="button"
        data-label-obstacle
        onClick={onClose}
        className={`${PILL_CLASS_NAME} ${CIRCLE_HIT_CLASS_NAME} size-control shrink-0 justify-center md:size-auto md:shrink md:justify-normal md:px-4 md:py-2.5`}
      >
        <ArrowLeftIcon />
        <span className="sr-only md:not-sr-only">{m.details_close()}</span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:ml-auto md:min-w-auto md:flex-initial md:gap-7">
        {position && (
          <p
            data-label-obstacle
            className="min-w-0 flex-1 text-center text-caption text-muted uppercase md:min-w-auto md:flex-initial md:text-start md:text-label"
          >
            {getPositionLabel(position, locale)}
          </p>
        )}
        <div data-label-obstacle className="ml-auto flex items-center gap-2 md:ml-0">
          <button
            ref={previousRef}
            type="button"
            aria-label={m.details_previous()}
            disabled={previous === null}
            onClick={goPrevious}
            className={`${PILL_CLASS_NAME} ${PREVIOUS_HIT_CLASS_NAME} size-control justify-center`}
          >
            <CaretLeftIcon />
          </button>
          <button
            ref={nextRef}
            type="button"
            aria-label={m.details_next()}
            disabled={next === null}
            onClick={goNext}
            className={`${PILL_CLASS_NAME} ${CIRCLE_HIT_CLASS_NAME} size-control justify-center`}
          >
            <CaretRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EarthquakePanel({ quake }: { quake: string }) {
  const search = homeRoute.useSearch();
  const navigate = homeRoute.useNavigate();
  const { data: list, isPending: isListPending } = useQuery(
    earthquakesQueryOptions(getEarthquakeFilters(search)),
  );
  const {
    data: detail,
    isPending: isDetailPending,
    isError: isDetailError,
    isFetching: isDetailFetching,
    refetch: refetchDetail,
  } = useQuery(earthquakeDetailQueryOptions(quake));
  const layout = usePhoneLayout();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sheetBodyRef = useRef<HTMLDivElement>(null);
  const hasFocusedRef = useRef(false);
  const locale = getLocale();
  const earthquakes = list?.earthquakes ?? EMPTY_EARTHQUAKES;
  const ordered = useMemo(() => getTimeOrderedEarthquakes(earthquakes), [earthquakes]);
  const sequences = useMemo(() => getSequences(earthquakes), [earthquakes]);
  const position = getEarthquakePosition(ordered, quake);
  const listed = getSelectedEarthquake(earthquakes, quake);
  const earthquake = listed ?? getDetailEarthquake(detail ?? null);
  const state = getPanelState(earthquake, { isListPending, isDetailPending, isDetailError });
  const [returnFocusTarget] = useState(getFocusedElement);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  function close() {
    void navigate({ search: (prev) => ({ ...prev, quake: undefined, view: undefined }) });
    if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
  }

  function goTo(target: Earthquake) {
    void navigate({ search: (prev) => ({ ...prev, quake: getQuakeKey(target) }) });
  }

  const handleEscape = useEffectEvent(close);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) handleEscape();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (state === 'loading') return;
    if (hasFocusedRef.current && !isFocusLost()) return;
    hasFocusedRef.current = true;
    headingRef.current?.focus();
  }, [state]);

  useEffect(() => {
    sheetBodyRef.current?.scrollTo({ top: 0 });
  }, [quake]);

  return (
    <section
      aria-labelledby={DETAILS_HEADING_ID}
      className="pointer-events-none absolute inset-0 z-10"
    >
      {earthquake && search.view === 'section' && (
        <Suspense fallback={null}>
          <SectionView quake={quake} />
        </Suspense>
      )}
      <PanelNavigation position={position} locale={locale} onClose={close} onGoTo={goTo} />
      {earthquake && (
        <div
          data-label-obstacle
          className="absolute top-24 left-[max(1rem,env(safe-area-inset-left))] flex items-center gap-2 md:top-29 md:left-139"
        >
          <button
            type="button"
            disabled={position === null}
            onClick={() => requestWaveReplay(earthquake.id)}
            className={`${PILL_BASE_CLASS_NAME} ${ROW_HIT_CLASS_NAME} relative h-8 border-foreground px-3 text-button md:h-auto md:border-muted md:px-4 md:py-2.5 md:text-[9.5px]`}
          >
            <PlayIcon />
            <span aria-hidden="true" className="md:hidden">
              {m.details_replay_short()}
            </span>
            <span className="sr-only md:not-sr-only">{m.details_replay()}</span>
          </button>
          <WavePauseButton />
        </div>
      )}
      {earthquake && <ViewToggle />}
      <BottomSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        collapsedTop={layout?.detailSheetTop}
        expandedTop={layout ? getDetailSheetOpenTop(layout) : undefined}
        handleLabels={{ open: m.details_more(), close: m.details_less() }}
        bodyRef={sheetBodyRef}
        className="pointer-events-auto"
      >
        <div
          data-label-obstacle
          className="pointer-events-auto md:absolute md:top-35 md:left-14 md:max-h-[calc(100%-156px)] md:w-105 md:overflow-y-auto"
        >
          {state === 'ready' && earthquake && (
            <EarthquakeFacts
              earthquake={earthquake}
              feltReports={getFeltReports(detail)}
              headingId={DETAILS_HEADING_ID}
              headingRef={headingRef}
              locale={locale}
              isExpanded={isSheetOpen}
              onExpandedChange={setIsSheetOpen}
            />
          )}
          {state === 'ready' && listed && (
            <div className={getSequenceClassName(isSheetOpen)}>
              <RelatedEarthquakes
                sequence={getSequenceOf(sequences, listed)}
                selected={listed}
                locale={locale}
                onGoTo={goTo}
              />
            </div>
          )}
          {state === 'ready' && earthquake && search.view === 'section' && (
            <Suspense fallback={null}>
              <SectionNote quake={quake} isExpanded={isSheetOpen} />
            </Suspense>
          )}
          {state === 'not-found' && (
            <h2
              ref={headingRef}
              id={DETAILS_HEADING_ID}
              tabIndex={-1}
              className="text-title outline-none"
            >
              {m.details_not_found()}
            </h2>
          )}
          {state === 'error' && (
            <div role="alert" className="flex flex-col items-start gap-4">
              <h2
                ref={headingRef}
                id={DETAILS_HEADING_ID}
                tabIndex={-1}
                className="text-title outline-none"
              >
                {m.details_error()}
              </h2>
              <button
                type="button"
                disabled={isDetailFetching}
                onClick={() => void refetchDetail()}
                className={`${PILL_CLASS_NAME} px-4 py-2.5`}
              >
                {m.details_retry()}
              </button>
            </div>
          )}
          {state === 'loading' && (
            <h2 id={DETAILS_HEADING_ID} className="sr-only">
              {m.details_loading()}
            </h2>
          )}
        </div>
      </BottomSheet>
    </section>
  );
}
