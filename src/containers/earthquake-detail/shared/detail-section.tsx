import { useId } from 'react';
import type { ReactNode } from 'react';

import { SectionExplainer } from '@/components/ui/explainer';

export function DetailSection({
  title,
  explainer,
  children,
}: {
  title: string;
  explainer: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight text-balance text-fg">
          {title}
        </h2>
        <SectionExplainer>{explainer}</SectionExplainer>
      </div>
      {children}
    </section>
  );
}
