import { useQuery } from '@tanstack/react-query';

import { Datum, DatumList } from '@/components/ui/explainer';
import { getRow } from '@/containers/earthquake-detail/shared/detail-row';
import type { DetailRow } from '@/containers/earthquake-detail/shared/detail-row';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import type { UsgsImpact } from '@/lib/earthquakes/details/usgs';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { getIntensityLevel } from '@/lib/earthquakes/intensity';
import { getDecimalLabel } from '@/lib/format';
import { getIntensityLevelLabel } from '@/lib/i18n/tooltip-labels';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

type PagerAlert = NonNullable<UsgsImpact['pagerAlert']>;

const PAGER_LABELS: Record<PagerAlert, () => string> = {
  green: m.detail_pager_green,
  yellow: m.detail_pager_yellow,
  orange: m.detail_pager_orange,
  red: m.detail_pager_red,
};

const PAGER_EXPLANATIONS: Record<PagerAlert, () => string> = {
  green: m.detail_pager_green_explain,
  yellow: m.detail_pager_yellow_explain,
  orange: m.detail_pager_orange_explain,
  red: m.detail_pager_red_explain,
};

const PAGER_DOT_CLASS_NAMES: Record<PagerAlert, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

function getIntensityValue(mmi: number, locale: Locale): string {
  const { roman, key } = getIntensityLevel(mmi);
  return `${roman} · ${getIntensityLevelLabel(key, locale)} (${getDecimalLabel(mmi, locale, 1)})`;
}

function getImpactRows(impact: UsgsImpact, locale: Locale): DetailRow[] {
  const rows = [
    getRow(impact.pagerAlert, (alert) => ({
      key: 'pager',
      label: m.detail_label_pager(),
      value: (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className={cn('size-3 rounded-full', PAGER_DOT_CLASS_NAMES[alert])} />
          {PAGER_LABELS[alert]()}
        </span>
      ),
      explanation: (
        <>
          {m.detail_pager_explain()} {PAGER_EXPLANATIONS[alert]()}
        </>
      ),
    })),
    getRow(impact.shakemapMaxMmi, (mmi) => ({
      key: 'shakemap',
      label: m.detail_label_shakemap(),
      value: getIntensityValue(mmi, locale),
      explanation: m.detail_shakemap_explain(),
    })),
    getRow(impact.dyfiResponses, (count) => ({
      key: 'dyfi-responses',
      label: m.detail_label_dyfi_responses(),
      value: getDecimalLabel(count, locale),
      explanation: m.detail_dyfi_responses_explain(),
    })),
    getRow(impact.dyfiMaxMmi, (mmi) => ({
      key: 'dyfi-intensity',
      label: m.detail_label_dyfi_intensity(),
      value: getIntensityValue(mmi, locale),
      explanation: m.detail_dyfi_intensity_explain(),
    })),
    getRow(impact.tsunami ? true : null, () => ({
      key: 'tsunami',
      label: m.detail_label_tsunami(),
      value: m.detail_tsunami_flagged(),
      explanation: m.detail_tsunami_explain(),
    })),
  ];
  return rows.filter((row) => row !== null);
}

export function UsgsImpactSection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));
  if (!data?.impact) return null;
  const rows = getImpactRows(data.impact, getLocale());
  if (rows.length === 0) return null;

  return (
    <DetailSection
      title={m.detail_impact_title()}
      explainer={
        <>
          <p>{m.detail_impact_explainer_what()}</p>
          <p>{m.detail_impact_explainer_intensity()}</p>
        </>
      }
    >
      <DatumList>
        {rows.map(({ key, label, value, explanation }) => (
          <Datum key={key} label={label} value={value} explanation={explanation} />
        ))}
      </DatumList>
    </DetailSection>
  );
}
