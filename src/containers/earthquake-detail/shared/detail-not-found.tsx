import { Link } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

export function DetailNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{m.detail_not_found_title()}</h1>
      <p className="max-w-prose text-sm leading-relaxed text-muted">{m.detail_not_found_body()}</p>
      <Link to="/" className={buttonVariants()}>
        {m.detail_back_to_list()}
      </Link>
    </div>
  );
}
