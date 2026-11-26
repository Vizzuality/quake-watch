import type { ReactNode } from 'react';

export function RightRail({ children }: { children: ReactNode }) {
  return (
    <div className="contents md:pointer-events-none md:absolute md:top-[159px] md:right-14 md:bottom-[114px] md:z-10 md:flex md:flex-col md:items-end md:gap-3">
      {children}
    </div>
  );
}
