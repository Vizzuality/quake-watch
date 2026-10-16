import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

export function DetailError({
  sourceLabel,
  onRetry,
}: {
  sourceLabel: string;
  onRetry: () => void;
}) {
  return (
    <Alert hint={m.detail_error_hint()} action={<Button onClick={onRetry}>{m.retry()}</Button>}>
      {m.error_source_unreachable({ source: sourceLabel })}
    </Alert>
  );
}
