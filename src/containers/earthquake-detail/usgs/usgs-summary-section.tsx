import { useQuery } from '@tanstack/react-query';

import { Datum, DatumList } from '@/components/ui/explainer';
import {
  getMagnitudeTypeExplanation,
  getReviewStatusLabel,
} from '@/containers/earthquake-detail/shared/detail-labels';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { getCoordinatesLabel, getKmLabel, getDecimalLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export function UsgsSummarySection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));
  if (!data) return null;
  const { earthquake, significance, status } = data;
  const locale = getLocale();

  return (
    <DetailSection
      title={m.detail_facts_title()}
      explainer={
        <>
          <p>{m.detail_facts_explainer_magnitude()}</p>
          <p>{m.detail_facts_explainer_intensity()}</p>
        </>
      }
    >
      <DatumList>
        {earthquake.magnitudeType ? (
          <Datum
            label={m.detail_label_magnitude_type()}
            value={earthquake.magnitudeType}
            explanation={getMagnitudeTypeExplanation(earthquake.magnitudeType)}
          />
        ) : null}
        <Datum
          label={m.detail_label_depth()}
          value={getKmLabel(earthquake.depthKm, locale, 1)}
          explanation={m.detail_depth_explain()}
        />
        <Datum
          label={m.detail_label_epicenter()}
          value={getCoordinatesLabel(earthquake, locale)}
          explanation={m.detail_epicenter_explain()}
        />
        {significance === null ? null : (
          <Datum
            label={m.detail_label_significance()}
            value={getDecimalLabel(significance, locale)}
            explanation={m.detail_significance_explain()}
          />
        )}
        {status === null ? null : (
          <Datum
            label={m.detail_label_status()}
            value={getReviewStatusLabel(status)}
            explanation={m.detail_status_explain()}
          />
        )}
      </DatumList>
    </DetailSection>
  );
}
