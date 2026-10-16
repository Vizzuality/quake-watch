import { m } from '@/paraglide/messages';

export function DetailNotFound() {
  return (
    <div className="flex max-w-prose flex-col items-start gap-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {m.detail_not_found_title()}
      </h1>
      <p className="text-muted">{m.detail_not_found_body()}</p>
    </div>
  );
}
