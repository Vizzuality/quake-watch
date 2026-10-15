import { useQuery } from '@tanstack/react-query';

import { Beachball } from '@/components/focal-mechanism/beachball';
import { Datum, DatumList } from '@/components/ui/explainer';
import {
  getFaultTypeExplanation,
  getFaultTypeLabel,
} from '@/containers/earthquake-detail/shared/detail-labels';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import type { NodalPlane } from '@/lib/earthquakes/details/usgs';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { getFaultType } from '@/lib/focal-mechanism/beachball';
import {
  getDecimalLabel,
  getDegreesLabel,
  getKmLabel,
  getPercentLabel,
  getScientificLabel,
} from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

const BEACHBALL_SIZE = 160;

function getDerivedMagnitudeLabel(magnitude: number, type: string | null, locale: Locale): string {
  const label = getDecimalLabel(magnitude, locale, 1);
  return type ? `${label} (${type})` : label;
}

function NodalPlaneCard({
  plane,
  index,
  locale,
}: {
  plane: NodalPlane;
  index: number;
  locale: Locale;
}) {
  const faultType = getFaultType(plane);

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-3">
      <h3 className="text-sm font-semibold text-fg">{m.detail_plane_title({ index })}</h3>
      <DatumList>
        <Datum
          label={m.detail_label_fault_type()}
          value={getFaultTypeLabel(faultType)}
          explanation={getFaultTypeExplanation(faultType)}
        />
        <Datum
          label={m.detail_label_strike()}
          value={getDegreesLabel(plane.strikeDeg, locale, 1)}
          explanation={m.detail_strike_explain()}
        />
        <Datum
          label={m.detail_label_dip()}
          value={getDegreesLabel(plane.dipDeg, locale, 1)}
          explanation={m.detail_dip_explain()}
        />
        <Datum
          label={m.detail_label_rake()}
          value={getDegreesLabel(plane.rakeDeg, locale, 1)}
          explanation={m.detail_rake_explain()}
        />
      </DatumList>
    </div>
  );
}

export function UsgsMechanismSection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));
  if (!data?.mechanism) return null;
  const locale = getLocale();
  const {
    nodalPlanes: [first, second],
    percentDoubleCouple,
    scalarMomentNm,
    derivedMagnitude,
    derivedMagnitudeType,
    derivedDepthKm,
  } = data.mechanism;

  return (
    <DetailSection
      title={m.detail_mechanism_title()}
      explainer={
        <>
          <p>{m.detail_mechanism_explainer_what()}</p>
          <p>{m.detail_mechanism_explainer_beachball()}</p>
          <p>{m.detail_mechanism_explainer_planes()}</p>
        </>
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <figure className="flex shrink-0 flex-col items-center gap-2">
          <Beachball plane={first} size={BEACHBALL_SIZE} title={m.detail_beachball_title()} />
          <figcaption className="max-w-48 text-center text-xs text-muted">
            {m.detail_beachball_caption()}
          </figcaption>
        </figure>
        <div className="grid flex-1 gap-4 md:grid-cols-2">
          <NodalPlaneCard plane={first} index={1} locale={locale} />
          <NodalPlaneCard plane={second} index={2} locale={locale} />
        </div>
      </div>
      <DatumList>
        {percentDoubleCouple === null ? null : (
          <Datum
            label={m.detail_label_double_couple()}
            value={getPercentLabel(percentDoubleCouple, locale)}
            explanation={m.detail_double_couple_explain()}
          />
        )}
        {scalarMomentNm === null ? null : (
          <Datum
            label={m.detail_label_scalar_moment()}
            value={`${getScientificLabel(scalarMomentNm, locale)} N·m`}
            explanation={m.detail_scalar_moment_explain()}
          />
        )}
        {derivedMagnitude === null ? null : (
          <Datum
            label={m.detail_label_derived_magnitude()}
            value={getDerivedMagnitudeLabel(derivedMagnitude, derivedMagnitudeType, locale)}
            explanation={m.detail_derived_magnitude_explain()}
          />
        )}
        {derivedDepthKm === null ? null : (
          <Datum
            label={m.detail_label_derived_depth()}
            value={getKmLabel(derivedDepthKm, locale, 1)}
            explanation={m.detail_derived_depth_explain()}
          />
        )}
      </DatumList>
    </DetailSection>
  );
}
