import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

import { m } from '@/paraglide/messages';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;

export function SheetContent({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 md:bg-black/20" />
      <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-lg border-t border-line-strong bg-canvas px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-y-0 md:right-auto md:max-h-none md:w-96 md:rounded-none md:border-t-0 md:border-r md:pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-between">
          <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
          <Dialog.Close className="inline-flex min-h-10 items-center px-2 text-sm text-muted hover:text-fg">
            {m.close()}
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
