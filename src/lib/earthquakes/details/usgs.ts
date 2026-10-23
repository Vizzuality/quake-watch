import { z } from 'zod';

import { EarthquakeSourceError } from '../query-options';
import { usgsAdapter } from '../sources/usgs';
import type { Earthquake } from '../types';

const DETAIL_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

export type NodalPlane = { strikeDeg: number; dipDeg: number; rakeDeg: number };

export type UsgsOrigin = {
  depthType: string | null;
  horizontalErrorKm: number | null;
  verticalErrorKm: number | null;
  azimuthalGapDeg: number | null;
  numStationsUsed: number | null;
  numPhasesUsed: number | null;
  standardErrorS: number | null;
  minimumDistanceDeg: number | null;
  reviewStatus: string | null;
  network: string | null;
};

export type UsgsImpact = {
  pagerAlert: 'green' | 'yellow' | 'orange' | 'red' | null;
  shakemapMaxMmi: number | null;
  dyfiResponses: number | null;
  dyfiMaxMmi: number | null;
  tsunami: boolean;
};

export type UsgsMechanism = {
  nodalPlanes: [NodalPlane, NodalPlane];
  percentDoubleCouple: number | null;
  scalarMomentNm: number | null;
  derivedMagnitude: number | null;
  derivedMagnitudeType: string | null;
  derivedDepthKm: number | null;
};

export type UsgsShakemapFiles = { contoursUrl: string };

export type UsgsEarthquakeDetail = {
  earthquake: Earthquake;
  status: string | null;
  significance: number | null;
  origin: UsgsOrigin | null;
  impact: UsgsImpact | null;
  mechanism: UsgsMechanism | null;
  shakemap: UsgsShakemapFiles | null;
};

const productSchema = z.object({
  preferredWeight: z.number().nullish(),
  properties: z.record(z.string(), z.unknown()),
  contents: z
    .record(z.string(), z.object({ url: z.string().optional() }).catch({}))
    .nullish()
    .catch(null),
});

const productsSchema = z.record(z.string(), z.array(productSchema));

const detailFeatureSchema = z.object({
  properties: z.object({
    status: z.string().nullish(),
    sig: z.number().nullish(),
    net: z.string().nullish(),
    tsunami: z.number().nullish(),
    products: productsSchema.nullish(),
  }),
});

type ProductProperties = Record<string, unknown>;

const PAGER_ALERTS = ['green', 'yellow', 'orange', 'red'] as const;

const SHAKEMAP_CONTOURS_KEY = 'download/cont_mmi.json';

function getPreferredProduct(products: z.infer<typeof productsSchema>, type: string) {
  const candidates = products[type] ?? [];
  return candidates.reduce<(typeof candidates)[number] | null>(
    (best, product) =>
      best === null || (product.preferredWeight ?? 0) > (best.preferredWeight ?? 0)
        ? product
        : best,
    null,
  );
}

function getPreferredProperties(
  products: z.infer<typeof productsSchema>,
  type: string,
): ProductProperties | null {
  return getPreferredProduct(products, type)?.properties ?? null;
}

function getShakemapFiles(products: z.infer<typeof productsSchema>): UsgsShakemapFiles | null {
  const contents = getPreferredProduct(products, 'shakemap')?.contents;
  const contoursUrl = contents?.[SHAKEMAP_CONTOURS_KEY]?.url;
  if (!contoursUrl) return null;
  return { contoursUrl };
}

function getNumber(properties: ProductProperties, key: string): number | null {
  const value = properties[key];
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getString(properties: ProductProperties, key: string): string | null {
  const value = properties[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function getOrigin(
  properties: ProductProperties | null,
  network: string | null,
): UsgsOrigin | null {
  if (!properties) return null;
  return {
    depthType: getString(properties, 'depth-type'),
    horizontalErrorKm: getNumber(properties, 'horizontal-error'),
    verticalErrorKm: getNumber(properties, 'vertical-error'),
    azimuthalGapDeg: getNumber(properties, 'azimuthal-gap'),
    numStationsUsed: getNumber(properties, 'num-stations-used'),
    numPhasesUsed: getNumber(properties, 'num-phases-used'),
    standardErrorS: getNumber(properties, 'standard-error'),
    minimumDistanceDeg: getNumber(properties, 'minimum-distance'),
    reviewStatus: getString(properties, 'review-status'),
    network,
  };
}

function getPagerAlert(properties: ProductProperties | null): UsgsImpact['pagerAlert'] {
  const alert = properties ? getString(properties, 'alertlevel') : null;
  return PAGER_ALERTS.find((level) => level === alert) ?? null;
}

function getImpact(products: z.infer<typeof productsSchema>, tsunami: boolean): UsgsImpact | null {
  const pager = getPreferredProperties(products, 'losspager');
  const shakemap = getPreferredProperties(products, 'shakemap');
  const dyfi = getPreferredProperties(products, 'dyfi');
  if (!pager && !shakemap && !dyfi && !tsunami) return null;
  return {
    pagerAlert: getPagerAlert(pager),
    shakemapMaxMmi: shakemap ? getNumber(shakemap, 'maxmmi') : null,
    dyfiResponses: dyfi ? getNumber(dyfi, 'num-responses') : null,
    dyfiMaxMmi: dyfi ? getNumber(dyfi, 'maxmmi') : null,
    tsunami,
  };
}

function getNodalPlane(properties: ProductProperties, index: 1 | 2): NodalPlane | null {
  const strikeDeg = getNumber(properties, `nodal-plane-${index}-strike`);
  const dipDeg = getNumber(properties, `nodal-plane-${index}-dip`);
  const rakeDeg = getNumber(properties, `nodal-plane-${index}-rake`);
  if (strikeDeg === null || dipDeg === null || rakeDeg === null) return null;
  return { strikeDeg, dipDeg, rakeDeg };
}

function getMechanism(properties: ProductProperties | null): UsgsMechanism | null {
  if (!properties) return null;
  const first = getNodalPlane(properties, 1);
  const second = getNodalPlane(properties, 2);
  if (!first || !second) return null;
  return {
    nodalPlanes: [first, second],
    percentDoubleCouple: getNumber(properties, 'percent-double-couple'),
    scalarMomentNm: getNumber(properties, 'scalar-moment'),
    derivedMagnitude: getNumber(properties, 'derived-magnitude'),
    derivedMagnitudeType: getString(properties, 'derived-magnitude-type'),
    derivedDepthKm: getNumber(properties, 'derived-depth'),
  };
}

export function getUsgsEarthquakeDetailFromFeature(feature: unknown): UsgsEarthquakeDetail | null {
  const earthquake = usgsAdapter.getEarthquake(feature);
  const parsed = detailFeatureSchema.safeParse(feature);
  if (!earthquake || !parsed.success) return null;
  const { status, sig, net, tsunami, products } = parsed.data.properties;
  const safeProducts = products ?? {};
  return {
    earthquake,
    status: status ?? null,
    significance: sig ?? null,
    origin: getOrigin(getPreferredProperties(safeProducts, 'origin'), net ?? null),
    impact: getImpact(safeProducts, tsunami === 1),
    mechanism: getMechanism(getPreferredProperties(safeProducts, 'moment-tensor')),
    shakemap: getShakemapFiles(safeProducts),
  };
}

export async function getUsgsEarthquakeDetail(
  id: string,
  signal?: AbortSignal,
): Promise<UsgsEarthquakeDetail | null> {
  const params = new URLSearchParams({ eventid: id, format: 'geojson' });
  const response = await fetch(`${DETAIL_URL}?${params}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new EarthquakeSourceError('usgs', response.status);
  const detail = getUsgsEarthquakeDetailFromFeature(await response.json());
  if (!detail) throw new EarthquakeSourceError('usgs', response.status);
  return detail;
}
