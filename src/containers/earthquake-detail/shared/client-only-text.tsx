import { ClientOnly } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export function ClientOnlyText({
  placeholder,
  children,
}: {
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <span
      data-placeholder={placeholder}
      className="inline-grid before:invisible before:col-start-1 before:row-start-1 before:content-[attr(data-placeholder)]"
    >
      <ClientOnly>
        <span className="col-start-1 row-start-1">{children}</span>
      </ClientOnly>
    </span>
  );
}
