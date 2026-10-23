import { useId } from 'react';

import {
  getCssColor,
  getIntensityShortLabel,
  getSwatchClassName,
} from '@/containers/earthquake-detail/shared/shaking/shaking-labels';
import {
  SourceLink,
  WaveSources,
} from '@/containers/earthquake-detail/shared/shaking/shaking-sources';
import { FELT_REPORTS_PALETTE } from '@/lib/felt-reports/palette';
import { getPaletteColor } from '@/lib/shakemap/coverage';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { FeltReportsSizeKey } from './felt-reports-size-key';

const EMSC_DOCS_URL = 'https://www.seismicportal.eu/testimonies-ws/';
const EMSC_METHOD_URL = 'https://doi.org/10.5281/zenodo.12570295';
const USGS_SCALE_URL =
  'https://www.usgs.gov/programs/earthquake-hazards/modified-mercalli-intensity-scale';
const LEGEND_INTENSITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function FeltScale() {
  const titleId = useId();
  const locale = getLocale();

  return (
    <>
      <div className="flex flex-col gap-2">
        <span id={titleId} className="font-medium text-fg">
          {m.detail_felt_legend_title()}
        </span>
        <ol aria-labelledby={titleId} className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {LEGEND_INTENSITIES.map((intensity) => (
            <li key={intensity} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={getSwatchClassName(true)}
                style={{
                  backgroundColor: getCssColor(getPaletteColor(FELT_REPORTS_PALETTE, intensity)),
                }}
              />
              {getIntensityShortLabel(intensity, locale)}
            </li>
          ))}
        </ol>
        <p>{m.detail_felt_legend_cells()}</p>
      </div>
      <FeltReportsSizeKey />
    </>
  );
}

export function FeltReportsLegend({
  hasReports,
  isObserved,
}: {
  hasReports: boolean;
  isObserved: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 text-muted">
      {hasReports ? <FeltScale /> : null}
      {hasReports ? <p>{m.detail_train_emsc_real()}</p> : null}
      <p>{isObserved ? m.detail_train_reports_recreated() : m.detail_train_circle_recreated()}</p>
      {hasReports ? (
        <p>
          {m.detail_felt_explainer_source()}{' '}
          <SourceLink href={EMSC_DOCS_URL}>{m.detail_felt_source_link()}</SourceLink>
          {' · '}
          <SourceLink href={EMSC_METHOD_URL}>{m.detail_felt_source_link_method()}</SourceLink>
          {' · '}
          <SourceLink href={USGS_SCALE_URL}>{m.detail_felt_source_link_scale()}</SourceLink>
        </p>
      ) : null}
      <WaveSources />
    </div>
  );
}
