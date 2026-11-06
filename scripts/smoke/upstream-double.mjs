import { appendFileSync } from 'node:fs';

import {
  getEmscFeature,
  getFeatureCollection,
  getUsgsFeature,
} from '../../src/test/fixtures/earthquakes.ts';
import { getEmscDetailFeature } from '../../src/test/fixtures/emsc-detail.ts';
import { usgsPanamaDetail } from '../../src/test/fixtures/usgs-detail.ts';

export const USGS_ID = 'us6000u18k';
export const EMSC_ID = '20261013_0000326';

const USGS_HOST = 'earthquake.usgs.gov';
const EMSC_HOST = 'www.seismicportal.eu';
const SMOKE_LIST_SENTINEL = 'smokelistsentinel';

function getUsgsResponse(id) {
  if (id === USGS_ID) return Response.json(usgsPanamaDetail);
  return new Response(null, { status: 404 });
}

function getEmscResponse(id) {
  if (id === EMSC_ID) return Response.json(getEmscDetailFeature({ id }));
  return new Response(null, { status: 204 });
}

function getListResponse(url) {
  const log = process.env.SMOKE_UPSTREAM_LOG;
  if (log) appendFileSync(log, `${url.href}\n`);
  const getFeature = url.hostname === USGS_HOST ? getUsgsFeature : getEmscFeature;
  return Response.json(getFeatureCollection([getFeature({ id: SMOKE_LIST_SENTINEL })]));
}

function getRequestUrl(input) {
  if (input instanceof Request) return new URL(input.url);
  return new URL(String(input));
}

export function getUpstreamResponse(input, isUpstreamDown) {
  const url = getRequestUrl(input);
  const id = url.searchParams.get('eventid');
  const isUpstream = url.hostname === USGS_HOST || url.hostname === EMSC_HOST;
  if (!isUpstream) throw new Error(`Smoke test: unexpected request to ${url.href}`);
  if (isUpstreamDown) return new Response(null, { status: 503 });
  if (id === null) return getListResponse(url);
  if (url.hostname === USGS_HOST) return getUsgsResponse(id);
  return getEmscResponse(id);
}
