import { getEmscDetailFeature } from '../../src/test/fixtures/emsc-detail.ts';
import { usgsPanamaDetail } from '../../src/test/fixtures/usgs-detail.ts';

export const USGS_ID = 'us6000u18k';
export const USGS_ESCAPE_ID = 'us6000escape';
export const ESCAPE_PLACE = 'Tom & Jerry <Bay>';
export const USGS_SCRIPT_ID = 'us6000script';
export const SCRIPT_PLACE = '</script><script>alert(1)</script>';
export const EMSC_ID = '20261013_0000326';

const USGS_HOST = 'earthquake.usgs.gov';
const EMSC_HOST = 'www.seismicportal.eu';

const USGS_PLACES = new Map([
  [USGS_ESCAPE_ID, ESCAPE_PLACE],
  [USGS_SCRIPT_ID, SCRIPT_PLACE],
]);

function getUsgsResponse(id) {
  if (id === USGS_ID) return Response.json(usgsPanamaDetail);
  const place = USGS_PLACES.get(id);
  if (!place) return new Response(null, { status: 404 });
  return Response.json({
    ...usgsPanamaDetail,
    id,
    properties: { ...usgsPanamaDetail.properties, place },
  });
}

function getEmscResponse(id) {
  if (id === EMSC_ID) return Response.json(getEmscDetailFeature({ id }));
  return new Response(null, { status: 204 });
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
  if (url.hostname === USGS_HOST) return getUsgsResponse(id);
  return getEmscResponse(id);
}
