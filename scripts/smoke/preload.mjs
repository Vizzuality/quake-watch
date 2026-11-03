import { appendFileSync } from 'node:fs';

import { getUpstreamResponse, waitForSlowUpstream } from './upstream-double.mjs';

const upstream = process.env.SMOKE_UPSTREAM;
const fetchLog = process.env.SMOKE_FETCH_LOG;

function getInputUrl(input) {
  return input instanceof Request ? input.url : String(input);
}

function getInputSignal(input, init) {
  if (init?.signal) return init.signal;
  return input instanceof Request ? input.signal : undefined;
}

globalThis.fetch = async (input, init) => {
  if (fetchLog) appendFileSync(fetchLog, `${getInputUrl(input)}\n`);
  if (upstream === 'slow') await waitForSlowUpstream(getInputSignal(input, init));
  return getUpstreamResponse(input, upstream === 'down');
};
