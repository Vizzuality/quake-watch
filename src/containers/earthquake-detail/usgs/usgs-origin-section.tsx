import { useQuery } from '@tanstack/react-query';

import { Datum, DatumList } from '@/components/ui/explainer';
import { getReviewStatusLabel } from '@/containers/earthquake-detail/shared/detail-labels';
import { getRow } from '@/containers/earthquake-detail/shared/detail-row';
import type { DetailRow } from '@/containers/earthquake-detail/shared/detail-row';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import type { UsgsOrigin } from '@/lib/earthquakes/details/usgs';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { getDecimalLabel, getDegreesLabel, getKmLabel, getSecondsLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

const KM_PER_DEGREE = 111;

const DEPTH_TYPE_LABELS: Record<string, () => string> = {
  'from location': m.detail_depth_type_location,
  'from moment tensor inversion': m.detail_depth_type_moment_tensor,
  'operator assigned': m.detail_depth_type_operator,
  'constrained by depth phases': m.detail_depth_type_depth_phases,
};

function getDepthTypeLabel(depthType: string): string {
  return DEPTH_TYPE_LABELS[depthType.toLowerCase()]?.() ?? depthType;
}

function getOriginRows(origin: UsgsOrigin, locale: Locale): DetailRow[] {
  const rows = [
    getRow(origin.depthType, (depthType) => ({
      key: 'depth-type',
      label: m.detail_label_depth_type(),
      value: getDepthTypeLabel(depthType),
      explanation: m.detail_depth_type_explain(),
    })),
    getRow(origin.horizontalErrorKm, (km) => ({
      key: 'horizontal-error',
      label: m.detail_label_horizontal_error(),
      value: `± ${getKmLabel(km, locale, 1)}`,
      explanation: m.detail_horizontal_error_explain(),
    })),
    getRow(origin.verticalErrorKm, (km) => ({
      key: 'vertical-error',
      label: m.detail_label_vertical_error(),
      value: `± ${getKmLabel(km, locale, 1)}`,
      explanation: m.detail_vertical_error_explain(),
    })),
    getRow(origin.azimuthalGapDeg, (degrees) => ({
      key: 'azimuthal-gap',
      label: m.detail_label_azimuthal_gap(),
      value: getDegreesLabel(degrees, locale),
      explanation: m.detail_azimuthal_gap_explain(),
    })),
    getRow(origin.numStationsUsed, (count) => ({
      key: 'stations',
      label: m.detail_label_stations(),
      value: getDecimalLabel(count, locale),
      explanation: m.detail_stations_explain(),
    })),
    getRow(origin.numPhasesUsed, (count) => ({
      key: 'phases',
      label: m.detail_label_phases(),
      value: getDecimalLabel(count, locale),
      explanation: m.detail_phases_explain(),
    })),
    getRow(origin.standardErrorS, (seconds) => ({
      key: 'standard-error',
      label: m.detail_label_standard_error(),
      value: getSecondsLabel(seconds, locale),
      explanation: m.detail_standard_error_explain(),
    })),
    getRow(origin.minimumDistanceDeg, (degrees) => ({
      key: 'minimum-distance',
      label: m.detail_label_minimum_distance(),
      value: m.detail_degrees_and_km({
        degrees: getDegreesLabel(degrees, locale, 2),
        distance: getKmLabel(degrees * KM_PER_DEGREE, locale),
      }),
      explanation: m.detail_minimum_distance_explain(),
    })),
    getRow(origin.reviewStatus, (status) => ({
      key: 'review-status',
      label: m.detail_label_review_status(),
      value: getReviewStatusLabel(status),
      explanation: m.detail_review_status_explain(),
    })),
    getRow(origin.network, (network) => ({
      key: 'network',
      label: m.detail_label_network(),
      value: network.toUpperCase(),
      explanation: m.detail_network_explain(),
    })),
  ];
  return rows.filter((row) => row !== null);
}

export function UsgsOriginSection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));
  if (!data?.origin) return null;
  const rows = getOriginRows(data.origin, getLocale());
  if (rows.length === 0) return null;

  return (
    <DetailSection
      title={m.detail_origin_title()}
      explainer={
        <>
          <p>{m.detail_origin_explainer_what()}</p>
          <p>{m.detail_origin_explainer_how()}</p>
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
