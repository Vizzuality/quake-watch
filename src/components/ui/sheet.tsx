import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

import { m } from '@/paraglide/messages';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;

export function SheetContent({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
      <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-line bg-canvas p-4">
        <div className="mb-4 flex items-center justify-between">
          <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
          <Dialog.Close className="text-xs text-muted hover:text-fg">{m.close()}</Dialog.Close>
        </div>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
