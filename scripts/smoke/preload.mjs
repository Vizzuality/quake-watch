import { getUpstreamResponse } from './upstream-double.mjs';

const isUpstreamDown = process.env.SMOKE_UPSTREAM === 'down';

globalThis.fetch = async (input) => getUpstreamResponse(input, isUpstreamDown);
