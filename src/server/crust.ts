import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';

import { crustCellsInputSchema, getCrust1Cells } from '@/lib/crust/crust1-binary';

import crust1DataUrl from '../../data/crust1.bin?url&inline';

let crust1View: DataView | undefined;

function getCrust1View(): DataView {
  if (!crust1View) {
    const bytes = Buffer.from(crust1DataUrl.slice(crust1DataUrl.indexOf(',') + 1), 'base64');
    crust1View = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return crust1View;
}

export const getCrustCells = createServerFn({ method: 'GET' })
  .validator(crustCellsInputSchema)
  .handler(({ data }) => {
    setResponseHeader('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
    return getCrust1Cells(getCrust1View(), data);
  });
