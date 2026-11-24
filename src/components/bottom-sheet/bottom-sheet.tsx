import {
  type PointerEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useRef,
  useState,
} from 'react';

import { isSheetDragToggle } from '@/lib/layout/sheet-drag';
import { cn } from '@/lib/utils';

const TAP_SLOP_PX = 8;

type DragStart = { y: number; time: number };

type BottomSheetProps = {
  label?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  collapsedTop: number | undefined;
  expandedTop: number | undefined;
  handleLabels: { open: string; close: string };
  handleRef?: Ref<HTMLButtonElement>;
  bodyRef?: Ref<HTMLDivElement>;
  className?: string;
  children: ReactNode;
};

function getDraggedTop(
  top: number | undefined,
  offset: number,
  expandedTop: number | undefined,
  collapsedTop: number | undefined,
): number | undefined {
  if (top === undefined || expandedTop === undefined || collapsedTop === undefined) return top;
  return Math.min(collapsedTop, Math.max(expandedTop, top + offset));
}

function getTransitionClassName(isDragging: boolean): string {
  return isDragging
    ? 'transition-none'
    : 'motion-safe:transition-[top] motion-safe:duration-350 motion-safe:ease-[cubic-bezier(.2,.8,.2,1)]';
}

export function BottomSheet({
  label,
  isOpen,
  onOpenChange,
  collapsedTop,
  expandedTop,
  handleLabels,
  handleRef,
  bodyRef,
  className,
  children,
}: BottomSheetProps) {
  const dragStartRef = useRef<DragStart | null>(null);
  const didDragRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const restingTop = isOpen ? expandedTop : collapsedTop;
  const top = getDraggedTop(restingTop, dragOffset ?? 0, expandedTop, collapsedTop);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { y: event.clientY, time: event.nativeEvent.timeStamp };
    didDragRef.current = false;
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    const offset = event.clientY - start.y;
    if (Math.abs(offset) > TAP_SLOP_PX) didDragRef.current = true;
    setDragOffset(offset);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    dragStartRef.current = null;
    setDragOffset(null);
    const offset = event.clientY - start.y;
    if (Math.abs(offset) <= TAP_SLOP_PX) return;
    didDragRef.current = true;
    if (isSheetDragToggle(offset, event.nativeEvent.timeStamp - start.time, isOpen))
      onOpenChange(!isOpen);
  }

  function handlePointerCancel() {
    dragStartRef.current = null;
    setDragOffset(null);
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail !== 0 && didDragRef.current) return;
    onOpenChange(!isOpen);
  }

  return (
    <section
      aria-label={label}
      data-dragging={dragOffset !== null || undefined}
      style={{ top }}
      className={cn(
        'group/sheet absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-sheet border-t border-line-sheet glass-sheet short:left-auto short:w-80 short:rounded-none short:border-t-0 short:border-l md:contents',
        getTransitionClassName(dragOffset !== null),
        className,
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? handleLabels.close : handleLabels.open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        onClick={handleClick}
        className="relative z-10 -mt-[18px] flex h-11 w-full shrink-0 cursor-grab touch-none justify-center pt-[29px] select-none active:cursor-grabbing md:hidden"
      >
        <span className="h-1 w-[38px] rounded-handle bg-handle" />
      </button>
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto overscroll-contain px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] md:contents short:pr-[max(1.25rem,env(safe-area-inset-right))]"
      >
        {children}
      </div>
    </section>
  );
}
