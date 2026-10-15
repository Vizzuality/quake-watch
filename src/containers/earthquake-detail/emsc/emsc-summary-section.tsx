import { useQuery } from '@tanstack/react-query';

import { Datum, DatumList } from '@/components/ui/explainer';
import { getMagnitudeTypeExplanation } from '@/containers/earthquake-detail/shared/detail-labels';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';
import { getCoordinatesLabel, getKmLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export function EmscSummarySection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(emscEarthquakeDetailQueryOptions(earthquakeId));
  if (!data) return null;
  const { earthquake } = data;
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
      </DatumList>
    </DetailSection>
  );
}
