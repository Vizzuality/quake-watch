import { appendFileSync } from 'node:fs';

import { getUpstreamResponse } from './upstream-double.mjs';

const isUpstreamDown = process.env.SMOKE_UPSTREAM === 'down';
const fetchLog = process.env.SMOKE_FETCH_LOG;

function getInputUrl(input) {
  return input instanceof Request ? input.url : String(input);
}

globalThis.fetch = async (input) => {
  if (fetchLog) appendFileSync(fetchLog, `${getInputUrl(input)}\n`);
  return getUpstreamResponse(input, isUpstreamDown);
};
