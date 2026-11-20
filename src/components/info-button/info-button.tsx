import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { listenForTooltipEscape } from '@/containers/globe/use-hovered-quake';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

type InfoLabelProps = {
  label: string;
  info: string;
  labelId?: string;
  className?: string;
};

const TOOLTIP_WIDTH = 230;
const TOOLTIP_OFFSET_X = -8;
const TOOLTIP_OFFSET_Y = 24;
const VIEWPORT_MARGIN = 8;

function getTooltipLeft(rowLeft: number): number {
  const maxLeft = window.innerWidth - VIEWPORT_MARGIN - TOOLTIP_WIDTH;
  return Math.max(VIEWPORT_MARGIN, Math.min(rowLeft + TOOLTIP_OFFSET_X, maxLeft));
}

function getIconClassName(isOpen: boolean): string {
  return isOpen ? 'text-accent' : 'text-muted';
}

function InfoIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 13 13"
      fill="currentColor"
      className={cn('size-[13px] transition-colors', getIconClassName(isOpen))}
    >
      <path d="M7.21094 8.9375C7.21094 9.01831 7.17884 9.09581 7.1217 9.15295C7.06456 9.21009 6.98706 9.24219 6.90625 9.24219C6.7177 9.24219 6.53687 9.16729 6.40354 9.03396C6.27021 8.90063 6.19531 8.7198 6.19531 8.53125V6.5C6.19531 6.47306 6.18461 6.44723 6.16557 6.42818C6.14652 6.40914 6.12069 6.39844 6.09375 6.39844C6.01294 6.39844 5.93544 6.36634 5.8783 6.3092C5.82116 6.25206 5.78906 6.17456 5.78906 6.09375C5.78906 6.01294 5.82116 5.93544 5.8783 5.8783C5.93544 5.82116 6.01294 5.78906 6.09375 5.78906C6.2823 5.78906 6.46313 5.86396 6.59646 5.99729C6.72979 6.13062 6.80469 6.31145 6.80469 6.5V8.53125C6.80469 8.55819 6.81539 8.58402 6.83443 8.60307C6.85348 8.62211 6.87931 8.63281 6.90625 8.63281C6.98706 8.63281 7.06456 8.66491 7.1217 8.72205C7.17884 8.77919 7.21094 8.85669 7.21094 8.9375ZM6.29688 4.77344C6.39731 4.77344 6.49549 4.74365 6.579 4.68786C6.66251 4.63206 6.7276 4.55275 6.76603 4.45996C6.80447 4.36717 6.81452 4.26506 6.79493 4.16656C6.77534 4.06805 6.72697 3.97757 6.65595 3.90655C6.58493 3.83553 6.49445 3.78716 6.39594 3.76757C6.29744 3.74798 6.19533 3.75803 6.10254 3.79647C6.00975 3.8349 5.93044 3.89999 5.87464 3.9835C5.81885 4.06701 5.78906 4.16519 5.78906 4.26562C5.78906 4.40031 5.84256 4.52947 5.9378 4.6247C6.03303 4.71994 6.1622 4.77344 6.29688 4.77344ZM11.6797 6.5C11.6797 7.52445 11.3759 8.52589 10.8068 9.37768C10.2376 10.2295 9.42864 10.8934 8.48218 11.2854C7.53572 11.6774 6.49425 11.78 5.48949 11.5802C4.48473 11.3803 3.5618 10.887 2.83741 10.1626C2.11302 9.4382 1.6197 8.51527 1.41984 7.51051C1.21998 6.50575 1.32255 5.46428 1.71459 4.51782C2.10663 3.57136 2.77052 2.7624 3.62232 2.19325C4.47411 1.6241 5.47555 1.32031 6.5 1.32031C7.87324 1.32193 9.18978 1.86816 10.1608 2.83919C11.1318 3.81022 11.6781 5.12676 11.6797 6.5ZM11.0703 6.5C11.0703 5.59608 10.8023 4.71245 10.3001 3.96087C9.79788 3.20929 9.0841 2.6235 8.24898 2.27758C7.41387 1.93167 6.49493 1.84116 5.60838 2.0175C4.72182 2.19385 3.90747 2.62913 3.2683 3.2683C2.62913 3.90747 2.19385 4.72182 2.0175 5.60838C1.84116 6.49493 1.93167 7.41387 2.27758 8.24898C2.6235 9.0841 3.20929 9.79788 3.96087 10.3001C4.71245 10.8023 5.59608 11.0703 6.5 11.0703C7.71171 11.069 8.87341 10.587 9.73022 9.73022C10.587 8.87341 11.069 7.71171 11.0703 6.5Z" />
    </svg>
  );
}

export function InfoLabel({ label, info, labelId, className }: InfoLabelProps) {
  const tooltipId = useId();
  const rowRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const isOpen = (isHovered || isFocused) && !isDismissed;

  function handlePointerEnter() {
    setIsHovered(true);
    setIsDismissed(false);
  }

  function handleFocus() {
    setIsFocused(true);
    setIsDismissed(false);
  }

  useLayoutEffect(() => {
    const row = rowRef.current;
    const tooltip = tooltipRef.current;
    if (!row || !tooltip) return;
    if (!isOpen) {
      tooltip.hidePopover();
      return;
    }
    const rect = row.getBoundingClientRect();
    tooltip.style.left = `${getTooltipLeft(rect.left)}px`;
    tooltip.style.top = `${rect.top + TOOLTIP_OFFSET_Y}px`;
    tooltip.showPopover();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    return listenForTooltipEscape(() => setIsDismissed(true));
  }, [isOpen]);

  return (
    <span ref={rowRef} className="flex max-w-full min-w-0 items-center gap-1.5">
      <span id={labelId} className={cn('min-w-0 truncate', className)}>
        {label}
      </span>
      <button
        type="button"
        aria-label={m.info_button_label({ label })}
        aria-describedby={tooltipId}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={() => setIsHovered(false)}
        onFocus={handleFocus}
        onBlur={() => setIsFocused(false)}
        className="pointer-events-auto -m-3.5 flex size-11 shrink-0 cursor-help items-center justify-center rounded-full md:-m-1 md:size-6"
      >
        <InfoIcon isOpen={isOpen} />
      </button>
      <span
        id={tooltipId}
        ref={tooltipRef}
        role="tooltip"
        popover="manual"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={() => setIsHovered(false)}
        className="pointer-events-auto fixed inset-auto m-0 w-[230px] overflow-visible border border-line glass-tooltip px-3.5 py-3 text-body-s font-normal tracking-normal whitespace-normal text-foreground normal-case before:absolute before:inset-x-0 before:-top-2 before:h-2"
      >
        {info}
      </span>
    </span>
  );
}
